import argparse
import json
from pathlib import Path

import torch
from datasets import Dataset, load_dataset
from huggingface_hub import snapshot_download
from peft import LoraConfig, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)


def iter_json_records(path):
    if path.suffix == ".jsonl":
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    yield json.loads(line)
    elif path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            yield from data
        elif isinstance(data, dict):
            for value in data.values():
                if isinstance(value, list):
                    yield from value


def load_records(dataset_name, split, max_samples):
    try:
        dataset = load_dataset(dataset_name, split=split)
        records = list(dataset)
    except Exception as exc:
        print(f"datasets.load_dataset failed, using raw file fallback: {exc}")
        snapshot = Path(snapshot_download(repo_id=dataset_name, repo_type="dataset"))
        records = []
        for path in snapshot.rglob("*"):
            if path.suffix in {".json", ".jsonl"}:
                records.extend(iter_json_records(path))

    if max_samples:
        records = records[:max_samples]
    return records


def first_text(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(first_text(item) for item in value if first_text(item))
    if isinstance(value, dict):
        return "\n".join(first_text(item) for item in value.values() if first_text(item))
    return str(value)


def record_to_messages(record):
    system = first_text(
        record.get("system")
        or record.get("system_prompt")
        or record.get("context")
        or "You are eKheti, a practical agricultural advisor for Indian farmers."
    )

    if isinstance(record.get("messages"), list):
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        for message in record["messages"]:
            role = message.get("role", "user")
            content = first_text(message.get("content") or message.get("text"))
            if content:
                messages.append({"role": role, "content": content})
        return messages if len(messages) >= 2 else None

    turns = record.get("turns")
    if isinstance(turns, list):
        messages = [{"role": "system", "content": system}]
        for turn in turns:
            user = first_text(turn.get("user") or turn.get("human") or turn.get("question"))
            assistant = first_text(turn.get("assistant") or turn.get("answer") or turn.get("response"))
            if user:
                messages.append({"role": "user", "content": user})
            if assistant:
                messages.append({"role": "assistant", "content": assistant})
        return messages if len(messages) >= 3 else None

    instruction = first_text(record.get("instruction") or record.get("prompt") or record.get("question") or record.get("input"))
    response = first_text(record.get("output") or record.get("response") or record.get("answer") or record.get("target"))
    if instruction and response:
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": instruction},
            {"role": "assistant", "content": response},
        ]

    return None


def format_messages(tokenizer, messages):
    if tokenizer.chat_template:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)

    formatted = []
    for message in messages:
        role = message["role"].upper()
        formatted.append(f"{role}: {message['content']}")
    return "\n".join(formatted) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-name", default="Qwen/Qwen3-0.6B")
    parser.add_argument("--dataset", default="AI71ai/agrillm-train-146k")
    parser.add_argument("--split", default="train")
    parser.add_argument("--output-dir", default="ml/outputs/advisory-lora")
    parser.add_argument("--max-samples", type=int, default=5000)
    parser.add_argument("--max-length", type=int, default=768)
    parser.add_argument("--max-steps", type=int, default=800)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    records = load_records(args.dataset, args.split, args.max_samples)
    texts = []
    for record in records:
        messages = record_to_messages(record)
        if messages:
            texts.append({"text": format_messages(tokenizer, messages)})

    if not texts:
        raise RuntimeError("No usable prompt/response records were found in the dataset.")

    dataset = Dataset.from_list(texts)

    def tokenize(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=args.max_length,
            padding=False,
        )

    tokenized = dataset.map(tokenize, batched=True, remove_columns=["text"])

    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForCausalLM.from_pretrained(
        args.model_name,
        torch_dtype=dtype,
        device_map="auto" if torch.cuda.is_available() else None,
        trust_remote_code=True,
    )
    model.config.use_cache = False

    lora_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        max_steps=args.max_steps,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        learning_rate=args.learning_rate,
        fp16=torch.cuda.is_available(),
        logging_steps=20,
        save_steps=200,
        save_total_limit=2,
        report_to=[],
        remove_unused_columns=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )
    trainer.train()
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    (output_dir / "training_config.json").write_text(
        json.dumps(vars(args), indent=2),
        encoding="utf-8",
    )
    print(f"Saved LoRA adapter to {output_dir}")


if __name__ == "__main__":
    main()
