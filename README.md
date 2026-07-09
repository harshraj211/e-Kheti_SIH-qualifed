# eKheti

eKheti is an AI-assisted farming platform built for hackathon and demo use cases around practical crop support for Indian farmers. It combines a Next.js dashboard with a local ML API for disease detection, retrieval-backed advisory answers, live weather context, mandi price lookup, and a lightweight community forum.

## What the project does

- Disease detection from crop and fruit leaf images
- Advisory generation using a local LLM flow instead of Gemini
- RAG-backed answers grounded in public agriculture PDFs
- Weather-aware crop suggestions using OpenWeatherMap
- Market price lookup from mandi data
- Crop simulation and basic farm utilities
- Community forum with image uploads through Cloudinary
- Multi-language UI support

## Current stack

### Frontend

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS
- Radix UI

### AI and backend services

- FastAPI local ML service
- PyTorch
- Hugging Face Transformers
- PEFT / LoRA
- Retrieval over agriculture PDFs

### External services

- OpenWeatherMap for live weather
- data.gov.in / Agmarknet mandi price dataset
- NewsData for agri news
- Cloudinary for community image hosting

## Major modules

### 1. Local AI chatbot

The chatbot now uses the local Python API in `ml/api.py` rather than Gemini. It can:

- answer farming questions
- use retrieved agriculture guide chunks
- use detected location and live weather
- use mandi price data for market-related questions
- attach source citations to responses

### 2. Disease detection

The image pipeline supports multiple backbones, including:

- `mobilenet_v3_small`
- `efficientnet_b0`
- `efficientnet_b3`
- `convnext_tiny`

The current setup is designed for local Windows training on an RTX 4050 and stronger training on Kaggle or cloud GPUs.

### 3. RAG knowledge base

The advisory layer uses locally indexed agriculture PDFs from sources like:

- ICAR
- TNAU
- PAU
- NHB
- NFSM

These are chunked into `ml/rag_index.jsonl` and used to ground responses with references.

### 4. Market prices

The market price dashboard reads current mandi data through the official data API and now uses an internal Next API route for better reliability.

### 5. Community forum

The forum currently supports:

- local post persistence in browser storage
- comments
- likes
- image upload to Cloudinary

This is a temporary hybrid approach. Images are persisted remotely, while post records are still local. A later step can move posts and comments to MongoDB or another database.

## Project structure

```text
src/
  app/
    dashboard/
    api/
  components/
  ai/
  lib/
ml/
  api.py
  train_disease_classifier.py
  train_advisory.py
  rag_docs/
  rag_index.jsonl
```

## Environment variables

Create a `.env` file in the project root.

```env
LOCAL_AI_BASE_URL=http://127.0.0.1:8000

NEXT_PUBLIC_OPENWEATHERMAP_API_KEY=
OPENWEATHERMAP_API_KEY=

AGMARKNET_API_KEY=
DATA_GOV_API_KEY=

NEWSDATA_API_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Notes:

- `NEXT_PUBLIC_*` keys are used by the Next.js app where needed.
- backend-safe keys like `OPENWEATHERMAP_API_KEY`, `DATA_GOV_API_KEY`, and Cloudinary secrets are used server-side.

## Local setup

### 1. Install frontend dependencies

```powershell
npm install
```

### 2. Start the frontend

```powershell
npm run dev
```

Frontend runs at:

```text
http://localhost:9002
```

### 3. Set up the Python environment

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
.\ml\setup_windows.ps1
```

### 4. Build the RAG index

```powershell
.\ml\build_rag_index_windows.ps1
```

### 5. Start the local AI API

```powershell
.\ml\start_api_windows.ps1
```

Local AI API runs at:

```text
http://127.0.0.1:8000
```

## Training workflows

### Disease model

Recommended local training:

```powershell
.\ml\train_disease_windows.ps1
```

Stronger ConvNeXt training:

```powershell
.\ml\train_disease_strong_windows.ps1
```

Manual examples:

```powershell
.\.venv\Scripts\python.exe .\ml\train_disease_classifier.py --architecture efficientnet_b0 --batch-size 24
.\.venv\Scripts\python.exe .\ml\train_disease_classifier.py --architecture convnext_tiny --batch-size 8
```

### Advisory model

Train the local advisory adapter:

```powershell
.\ml\train_advisory_windows.ps1
```

For larger runs, Kaggle or cloud GPUs are recommended.

## Recommended datasets

### Disease classification

- PlantVillage / New Plant Diseases Dataset
- PlantDoc
- Tomato leaf disease datasets
- Rice leaf disease datasets

### Advisory fine-tuning

- agricultural instruction datasets such as `AI71ai/agrillm-train-146k`

## Current implementation notes

- Gemini has been removed from the core advisory path
- source citations are appended to chatbot answers
- weather lookup is integrated into the local AI layer
- market price fetch is available through both UI and chatbot context
- community forum route mismatch has been fixed
- community image uploads now use Cloudinary

## Known limitations

- Forum posts and comments are still stored in local browser storage
- The disease model still benefits from more field-image training data
- Advisory answers can still be improved further with stronger prompt control and better crop-specific filtering
- The forum is not yet multi-user persistent until a real database is added

## Suggested next upgrades

- move community posts/comments to MongoDB or Firebase
- improve crop-specific retrieval ranking
- add better weather-first rendering in advisory answers
- train the disease model on mixed PlantVillage + PlantDoc style data
- add stronger advisory fine-tuning on larger GPUs

## Demo checklist

- start frontend on port `9002`
- start local AI API on port `8000`
- verify weather page
- verify market prices page
- verify disease detection
- verify chatbot source citations
- verify community image upload and refresh behavior

## License

This project is currently in active hackathon development. Add a formal license before public distribution if needed.
