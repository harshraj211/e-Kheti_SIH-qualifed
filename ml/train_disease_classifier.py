import argparse
import json
from pathlib import Path

import torch
from datasets import ClassLabel, Image as DatasetImage, load_dataset
from torch import nn
from torch.utils.data import DataLoader
from torchvision import models, transforms
from tqdm.auto import tqdm


def find_columns(dataset):
    features = dataset.features
    image_col = None
    label_col = None

    for name, feature in features.items():
        if isinstance(feature, DatasetImage) or name.lower() in {"image", "img", "photo"}:
            image_col = name
        if isinstance(feature, ClassLabel) or name.lower() in {"label", "labels", "class"}:
            label_col = name

    if image_col is None or label_col is None:
        raise ValueError(f"Could not find image/label columns. Columns: {list(features.keys())}")

    return image_col, label_col


def load_image_dataset(args):
    if args.data_dir:
        dataset = load_dataset("imagefolder", data_dir=args.data_dir)
    else:
        dataset = load_dataset(args.dataset)

    if "train" not in dataset:
        first_split = next(iter(dataset.keys()))
        dataset = dataset[first_split].train_test_split(test_size=0.2, seed=args.seed)
    elif "test" not in dataset and "validation" not in dataset:
        split = dataset["train"].train_test_split(test_size=0.2, seed=args.seed)
        dataset = {"train": split["train"], "test": split["test"]}

    eval_split = "validation" if "validation" in dataset else "test"
    train_ds = dataset["train"]
    eval_ds = dataset[eval_split]

    if args.max_train_samples:
        train_ds = train_ds.shuffle(seed=args.seed).select(range(min(args.max_train_samples, len(train_ds))))
    if args.max_eval_samples:
        eval_ds = eval_ds.shuffle(seed=args.seed).select(range(min(args.max_eval_samples, len(eval_ds))))

    return train_ds, eval_ds


def build_model(architecture, num_labels):
    if architecture == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.DEFAULT
        model = models.efficientnet_b0(weights=weights)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_labels)
        return model
    if architecture == "efficientnet_b3":
        weights = models.EfficientNet_B3_Weights.DEFAULT
        model = models.efficientnet_b3(weights=weights)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_labels)
        return model
    if architecture == "convnext_tiny":
        weights = models.ConvNeXt_Tiny_Weights.DEFAULT
        model = models.convnext_tiny(weights=weights)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_labels)
        return model

    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_labels)
    return model


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="BrandonFors/Plant-Diseases-PlantVillage-Dataset")
    parser.add_argument("--data-dir", default=None, help="Optional local imagefolder dataset path.")
    parser.add_argument("--output-dir", default="ml/outputs/disease-classifier")
    parser.add_argument(
        "--architecture",
        default="mobilenet_v3_small",
        choices=["mobilenet_v3_small", "efficientnet_b0", "efficientnet_b3", "convnext_tiny"],
        help="Use efficientnet_b0 or convnext_tiny for a stronger model that still runs on modest GPUs.",
    )
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--max-train-samples", type=int, default=None)
    parser.add_argument("--max-eval-samples", type=int, default=None)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    train_ds, eval_ds = load_image_dataset(args)
    image_col, label_col = find_columns(train_ds)
    label_feature = train_ds.features[label_col]
    labels = label_feature.names if isinstance(label_feature, ClassLabel) else sorted(set(train_ds[label_col]))
    label_to_id = {label: i for i, label in enumerate(labels)}

    tfm = transforms.Compose(
        [
            transforms.RandomResizedCrop(args.image_size, scale=(0.75, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.15, hue=0.03),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    eval_tfm = transforms.Compose(
        [
            transforms.Resize((args.image_size, args.image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    def convert_label(value):
        if isinstance(value, str):
            return label_to_id[value]
        return int(value)

    def train_transform(batch):
        batch["pixel_values"] = [tfm(image.convert("RGB")) for image in batch[image_col]]
        batch["labels"] = [convert_label(label) for label in batch[label_col]]
        return batch

    def eval_transform(batch):
        batch["pixel_values"] = [eval_tfm(image.convert("RGB")) for image in batch[image_col]]
        batch["labels"] = [convert_label(label) for label in batch[label_col]]
        return batch

    train_ds = train_ds.with_transform(train_transform)
    eval_ds = eval_ds.with_transform(eval_transform)

    def collate(batch):
        return {
            "pixel_values": torch.stack([item["pixel_values"] for item in batch]),
            "labels": torch.tensor([item["labels"] for item in batch], dtype=torch.long),
        }

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=0, collate_fn=collate)
    eval_loader = DataLoader(eval_ds, batch_size=args.batch_size, shuffle=False, num_workers=0, collate_fn=collate)

    model = build_model(args.architecture, len(labels)).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    scaler = torch.cuda.amp.GradScaler(enabled=device == "cuda")

    best_accuracy = 0.0
    history = []

    for epoch in range(1, args.epochs + 1):
        model.train()
        train_loss = 0.0
        progress = tqdm(train_loader, desc=f"Epoch {epoch}/{args.epochs}")
        for batch in progress:
            images = batch["pixel_values"].to(device)
            targets = batch["labels"].to(device)

            optimizer.zero_grad(set_to_none=True)
            with torch.cuda.amp.autocast(enabled=device == "cuda"):
                logits = model(images)
                loss = criterion(logits, targets)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()

            train_loss += loss.item()
            progress.set_postfix(loss=f"{loss.item():.4f}")

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for batch in eval_loader:
                images = batch["pixel_values"].to(device)
                targets = batch["labels"].to(device)
                predictions = model(images).argmax(dim=1)
                correct += (predictions == targets).sum().item()
                total += targets.numel()

        accuracy = correct / max(total, 1)
        epoch_loss = train_loss / max(len(train_loader), 1)
        history.append({"epoch": epoch, "loss": epoch_loss, "accuracy": accuracy})
        print(f"Epoch {epoch}: loss={epoch_loss:.4f}, eval_accuracy={accuracy:.4f}")

        if accuracy >= best_accuracy:
            best_accuracy = accuracy
            torch.save(
                {
                    "state_dict": model.state_dict(),
                    "labels": labels,
                    "image_size": args.image_size,
                    "architecture": args.architecture,
                },
                output_dir / "model.pt",
            )

    (output_dir / "labels.json").write_text(json.dumps(labels, indent=2), encoding="utf-8")
    (output_dir / "metrics.json").write_text(
        json.dumps({"best_accuracy": best_accuracy, "history": history}, indent=2),
        encoding="utf-8",
    )
    print(f"Saved best model to {output_dir / 'model.pt'}")


if __name__ == "__main__":
    main()
