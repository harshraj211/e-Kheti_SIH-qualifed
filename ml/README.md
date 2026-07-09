# eKheti Local AI

This folder removes the need for Gemini by serving two local models:

1. Plant disease image classifier: EfficientNet/MobileNet/ConvNeXt trained on PlantVillage-style data.
2. Agricultural advisory model: Qwen3-0.6B with a LoRA adapter trained on agricultural instruction data.
3. Local RAG index built from public agriculture PDFs in `ml/rag_docs`.

## Recommended Model And Dataset

- Disease detection dataset: `BrandonFors/Plant-Diseases-PlantVillage-Dataset` on Hugging Face, or Kaggle `vipoooool/new-plant-diseases-dataset`.
- Better real-field image datasets to add next: PlantDoc / PlantDoc++ style field images. PlantVillage alone gives high validation accuracy but can fail on real phone photos because of domain shift.
- Advisory dataset: `AI71ai/agrillm-train-146k`.
- Laptop base LLM: `Qwen/Qwen3-0.6B` for training on 6GB VRAM.
- Better cloud base LLM: `Qwen/Qwen3-1.7B` or `HuggingFaceTB/SmolLM3-3B` if you use Kaggle/Colab/Google Cloud with more VRAM.

## Image Model Choices

The default Windows training script now uses `efficientnet_b0`. It is a better balance than MobileNetV3 for your RTX 4050.

```powershell
.\ml\train_disease_windows.ps1
```

For a stronger model, use ConvNeXt-Tiny:

```powershell
.\ml\train_disease_strong_windows.ps1
```

Manual options:

```powershell
.\.venv\Scripts\python.exe .\ml\train_disease_classifier.py --architecture mobilenet_v3_small --batch-size 32
.\.venv\Scripts\python.exe .\ml\train_disease_classifier.py --architecture efficientnet_b0 --batch-size 24
.\.venv\Scripts\python.exe .\ml\train_disease_classifier.py --architecture convnext_tiny --batch-size 8
```

Recommendation:

- RTX 4050 6GB: `efficientnet_b0`
- Kaggle T4/P100: `convnext_tiny`
- Hugging Face Space CPU inference: train `convnext_tiny` or `efficientnet_b0`, then serve it; inference is okay, training should be done elsewhere.

## Windows Quick Start

Run these from the project root:

```powershell
.\ml\setup_windows.ps1
.\ml\build_rag_index_windows.ps1
.\ml\train_disease_windows.ps1
.\ml\train_advisory_windows.ps1
.\ml\start_api_windows.ps1
```

In another terminal, run the Next.js app:

```powershell
npm install
npm run dev
```

Set this if your API runs elsewhere:

```powershell
$env:LOCAL_AI_BASE_URL="http://127.0.0.1:8000"
```

To let the local ML API fetch live weather inside chatbot answers, add your OpenWeather key in the project root `.env`:

```env
OPENWEATHERMAP_API_KEY=your_key_here
```

Then restart the Python API. The chatbot will try to detect the location from the user's question and combine live weather with RAG guidance.

If PowerShell blocks `.ps1` scripts, build the RAG index directly:

```powershell
.\.venv\Scripts\python.exe .\ml\build_rag_index.py --docs-dir .\ml\rag_docs --output .\ml\rag_index.jsonl
```

## RAG Knowledge Base

PDFs live in:

```text
ml/rag_docs/
```

The index file is:

```text
ml/rag_index.jsonl
```

Current knowledge base includes ICAR advisories, TNAU rice/tomato guides, PAU package-of-practices PDFs, NHB tomato disease notes, NFSM ready reckoner, and pesticide safety guidance. The API retrieves relevant chunks and appends source names to chatbot/advisory answers.

## Expected Time On RTX 4050 6GB

- Disease classifier, EfficientNet-B0, full PlantVillage-style dataset, 10 epochs: about 60-150 minutes.
- Disease classifier quick hackathon demo with `--max-train-samples 10000 --epochs 5`: about 15-35 minutes.
- ConvNeXt-Tiny, 12 epochs: about 2-4 hours locally, faster on Kaggle T4/P100.
- Advisory LoRA, Qwen3-0.6B, 5k samples, 800 steps: about 2-5 hours.
- Full 146k advisory dataset locally: not recommended; expect 1-2 days and possible VRAM issues.

## Kaggle Or Google Cloud?

- Your laptop is good for the disease model and a small LoRA demo.
- Kaggle T4/P100 is better for the advisory LoRA because it has more VRAM and fewer Windows CUDA package problems.
- Google Cloud is best only if you can use an L4/A10/A100 GPU and you need dependable runtime for a final training run.

For this hackathon, train disease detection locally, train advisory LoRA on Kaggle if time allows, then copy `ml/outputs/advisory-lora` back into this folder.

## Local Dataset Option

If you download a Kaggle image dataset, arrange it like:

```text
dataset/
  train/
    Tomato___Late_blight/
    Tomato___healthy/
  valid/
    Tomato___Late_blight/
    Tomato___healthy/
```

Then run:

```powershell
.\.venv\Scripts\python.exe .\ml\train_disease_classifier.py --data-dir C:\path\to\dataset --epochs 10
```
