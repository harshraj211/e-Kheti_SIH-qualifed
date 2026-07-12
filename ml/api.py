import base64
import io
import json
import os
import re
from pathlib import Path
from typing import Literal
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
DISEASE_MODEL_DIR = Path(os.getenv("DISEASE_MODEL_DIR", ROOT / "outputs" / "disease-classifier"))
ADVISORY_MODEL_DIR = Path(os.getenv("ADVISORY_MODEL_DIR", ROOT / "outputs" / "advisory-lora"))
ADVISORY_BASE_MODEL = os.getenv("ADVISORY_BASE_MODEL", "Qwen/Qwen3-0.6B")
RAG_INDEX_PATH = Path(os.getenv("RAG_INDEX_PATH", ROOT / "rag_index.jsonl"))
RAG_SOURCES_PATH = Path(os.getenv("RAG_SOURCES_PATH", ROOT / "rag_docs" / "SOURCES.md"))
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "4"))
DISEASE_CONFIDENCE_THRESHOLD = float(os.getenv("DISEASE_CONFIDENCE_THRESHOLD", "0.45"))
DISEASE_MARGIN_THRESHOLD = float(os.getenv("DISEASE_MARGIN_THRESHOLD", "0.12"))
WEATHER_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY") or os.getenv("NEXT_PUBLIC_OPENWEATHERMAP_API_KEY") or ""
WEATHER_API_BASE = os.getenv("OPENWEATHERMAP_API_BASE", "https://api.openweathermap.org/data/2.5/weather")
MARKET_API_KEY = (
    os.getenv("AGMARKNET_API_KEY")
    or os.getenv("DATA_GOV_API_KEY")
    or os.getenv("NEXT_PUBLIC_DATA_GOV_API_KEY")
    or ""
)
MARKET_API_BASE = os.getenv(
    "AGMARKNET_API_BASE",
    "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
)
ENABLE_CPU_TEXT_MODEL = os.getenv("ENABLE_CPU_TEXT_MODEL", "false").lower() == "true"
HF_QWEN_API_URL = os.getenv("HF_QWEN_API_URL", "").rstrip("/")
HF_API_TOKEN = os.getenv("HF_API_TOKEN") or os.getenv("HF_TOKEN") or ""
HF_QWEN_MODEL = os.getenv("HF_QWEN_MODEL", "Qwen/Qwen3-4B-Instruct-2507")
HF_QWEN_TIMEOUT_SECONDS = int(os.getenv("HF_QWEN_TIMEOUT_SECONDS", "150"))

app = FastAPI(title="eKheti Local AI")

_disease_model = None
_disease_labels = None
_disease_image_size = 224
_text_pipeline = None
_text_tokenizer = None
_rag_chunks = None
_rag_source_map = None
_weather_cache = {}
_market_cache = {}

FRUIT_PLANTS = {
    "apple",
    "blueberry",
    "cherry",
    "grape",
    "orange",
    "peach",
    "raspberry",
    "strawberry",
}

CROP_PLANTS = {
    "bell pepper",
    "corn",
    "maize",
    "pepper",
    "potato",
    "soybean",
    "squash",
    "tomato",
}

STOPWORDS = {
    "a",
    "about",
    "after",
    "and",
    "are",
    "as",
    "at",
    "be",
    "because",
    "before",
    "can",
    "could",
    "crop",
    "do",
    "for",
    "from",
    "have",
    "how",
    "i",
    "if",
    "in",
    "is",
    "it",
    "my",
    "of",
    "on",
    "or",
    "should",
    "soil",
    "the",
    "this",
    "to",
    "what",
    "when",
    "with",
}

LOCATION_PREFIXES = (
    "in",
    "at",
    "near",
    "around",
    "from",
)

MARKET_QUERY_TERMS = {
    "price",
    "prices",
    "market",
    "mandi",
    "rate",
    "rates",
    "sell",
    "selling",
    "profit",
    "modal",
}

CROP_KEYWORDS = {
    "rice",
    "paddy",
    "wheat",
    "maize",
    "corn",
    "potato",
    "onion",
    "tomato",
    "cotton",
    "sugarcane",
    "soybean",
    "mustard",
    "chilli",
    "banana",
    "apple",
    "grape",
    "cauliflower",
    "cabbage",
    "brinjal",
    "okra",
    "groundnut",
    "turmeric",
}


def load_env_file(path: Path):
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


for env_path in (PROJECT_ROOT / ".env", ROOT / ".env"):
    load_env_file(env_path)

WEATHER_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY") or os.getenv("NEXT_PUBLIC_OPENWEATHERMAP_API_KEY") or WEATHER_API_KEY
MARKET_API_KEY = (
    os.getenv("AGMARKNET_API_KEY")
    or os.getenv("DATA_GOV_API_KEY")
    or os.getenv("NEXT_PUBLIC_DATA_GOV_API_KEY")
    or MARKET_API_KEY
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class ChatRequest(BaseModel):
    query: str
    managementType: Literal["Crops", "Fruits"] = "Crops"
    history: list[ChatMessage] = []
    documentContent: str | None = None
    language: str | None = None
    location: str | None = None


class ChatResponse(BaseModel):
    advice: str


class Weather(BaseModel):
    temperature: float
    condition: str
    humidity: float
    windSpeed: float


class AdvisoryRequest(BaseModel):
    cropType: str
    soilDetails: str
    currentStageOfCrop: str
    location: str
    advisory: str
    language: str | None = None
    weather: Weather | None = None


class AdvisoryResponse(BaseModel):
    integratedAdvisory: str


class DiseaseRequest(BaseModel):
    photoDataUri: str
    itemType: Literal["Crop", "Fruit"] = "Crop"
    language: str | None = None


class DiseaseResponse(BaseModel):
    diseaseDetected: bool
    diseaseName: str
    confidenceLevel: float
    suggestedSolutions: str


class CurrentWeather(BaseModel):
    location: str
    temperature: float
    condition: str
    humidity: float
    wind_speed: float
    precipitation_1h: float


class MarketPrice(BaseModel):
    crop_name: str
    variety: str
    market: str
    state: str
    district: str
    min_price: float
    max_price: float
    modal_price: float
    arrival_date: str


def decode_data_uri(data_uri: str):
    from PIL import Image

    if "," not in data_uri:
        raise ValueError("Expected a data URI with base64 image data.")
    encoded = data_uri.split(",", 1)[1]
    image_bytes = base64.b64decode(encoded)
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def load_disease_model():
    global _disease_model, _disease_labels, _disease_image_size
    if _disease_model is not None:
        return _disease_model, _disease_labels, _disease_image_size

    model_path = DISEASE_MODEL_DIR / "model.pt"
    if not model_path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Disease model not found at {model_path}. Run ml/train_disease_windows.ps1 first.",
        )

    from torch import nn
    from torchvision import models

    checkpoint = torch.load(model_path, map_location="cpu")
    labels = checkpoint["labels"]
    image_size = int(checkpoint.get("image_size", 224))
    architecture = checkpoint.get("architecture", "mobilenet_v3_small")
    model = build_vision_model(models, nn, architecture, len(labels))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    if torch.cuda.is_available():
        model = model.cuda()

    _disease_model = model
    _disease_labels = labels
    _disease_image_size = image_size
    return model, labels, image_size


def build_vision_model(models, nn, architecture: str, num_labels: int):
    if architecture == "efficientnet_b0":
        model = models.efficientnet_b0(weights=None)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_labels)
        return model
    if architecture == "efficientnet_b3":
        model = models.efficientnet_b3(weights=None)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_labels)
        return model
    if architecture == "convnext_tiny":
        model = models.convnext_tiny(weights=None)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, num_labels)
        return model

    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_labels)
    return model


def load_text_pipeline():
    global _text_pipeline, _text_tokenizer
    if _text_pipeline is not None:
        return _text_pipeline, _text_tokenizer

    if not torch.cuda.is_available() and not ENABLE_CPU_TEXT_MODEL:
        print("Text model disabled on CPU host; using rule fallback.")
        _text_pipeline = False
        _text_tokenizer = None
        return _text_pipeline, None

    try:
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

        adapter_config = ADVISORY_MODEL_DIR / "adapter_config.json"
        model_name = ADVISORY_BASE_MODEL
        tokenizer_source = ADVISORY_MODEL_DIR if (ADVISORY_MODEL_DIR / "tokenizer_config.json").exists() else model_name
        tokenizer = AutoTokenizer.from_pretrained(tokenizer_source, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=dtype,
            device_map="auto" if torch.cuda.is_available() else None,
            trust_remote_code=True,
        )
        if adapter_config.exists():
            model = PeftModel.from_pretrained(model, ADVISORY_MODEL_DIR)

        _text_pipeline = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=220,
            temperature=0.4,
            do_sample=True,
            return_full_text=False,
        )
        _text_tokenizer = tokenizer
        return _text_pipeline, tokenizer
    except Exception as exc:
        print(f"Text model unavailable, using rule fallback: {exc}")
        _text_pipeline = False
        _text_tokenizer = None
        return _text_pipeline, None


def tokenize(text: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9]+", text.lower())
        if len(token) > 2 and token not in STOPWORDS
    ]


def looks_like_location(candidate: str) -> bool:
    cleaned = candidate.strip(" ,.;:-")
    if len(cleaned) < 3 or len(cleaned) > 60:
        return False
    lower = cleaned.lower()
    if any(token in lower for token in ["nitrogen", "phosphorus", "potassium", "tillering", "humidity", "temperature"]):
        return False
    if any(token in lower for token in ["field", "farm", "plot", "acre", "acres", "soil", "crop", "paddy"]):
        return False
    words = [word for word in re.split(r"\s+", cleaned) if word]
    return 1 <= len(words) <= 5 and all(re.match(r"^[A-Za-z][A-Za-z .-]*$", word) for word in words)


def normalize_location_candidate(candidate: str) -> str:
    candidate = candidate.strip(" ,.;:-")
    candidate = re.split(
        r"\b(?:and|with|where|when|while|because|soil|crop|rain|rainfall|humidity|temperature|wind|forecast|expected|shows|showing|stage|today|tomorrow|currently|is|are)\b",
        candidate,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]
    candidate = candidate.strip(" ,.;:-")
    words = candidate.split()
    if len(words) > 3:
        candidate = " ".join(words[:3])
    return candidate


def extract_location_from_text(text: str) -> str | None:
    if not text:
        return None

    patterns = [
        r"\b(?:in|at|near|around|from)\s+([A-Za-z][A-Za-z-]*(?:\s+[A-Za-z][A-Za-z-]*){0,3})(?:,\s*[A-Za-z][A-Za-z-]*)?\b",
        r"\blocation\s*[:\-]\s*([A-Za-z][A-Za-z .,-]{2,60})",
        r"\b(?:village|district|city|state)\s*[:\-]\s*([A-Za-z][A-Za-z .,-]{2,60})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            candidate = normalize_location_candidate(match.group(1))
            if looks_like_location(candidate):
                return candidate.title()

    for line in text.splitlines():
        if any(line.lower().startswith(prefix + " ") for prefix in LOCATION_PREFIXES):
            candidate = normalize_location_candidate(
                re.sub(r"^(in|at|near|around|from)\s+", "", line.strip(), flags=re.IGNORECASE)
            )
            if looks_like_location(candidate):
                return candidate.title()
    return None


def find_best_location(request: ChatRequest) -> str | None:
    if request.location and looks_like_location(request.location):
        return request.location.strip()

    candidates = [request.query, request.documentContent or ""]
    candidates.extend(item.text for item in reversed(request.history[-8:]))
    for text in candidates:
        location = extract_location_from_text(text)
        if location:
            return location
    return None


def fetch_current_weather(location: str) -> CurrentWeather | None:
    if not WEATHER_API_KEY or not location:
        return None

    cache_key = location.strip().lower()
    if cache_key in _weather_cache:
        return _weather_cache[cache_key]

    url = f"{WEATHER_API_BASE}?q={quote_plus(location)}&appid={WEATHER_API_KEY}&units=metric"
    try:
        with urlopen(url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        weather = CurrentWeather(
            location=f"{payload.get('name', location)}, {payload.get('sys', {}).get('country', '')}".strip(", "),
            temperature=round(float(payload.get("main", {}).get("temp", 0.0)), 1),
            condition=(payload.get("weather", [{}])[0].get("description") or payload.get("weather", [{}])[0].get("main") or "Unknown").title(),
            humidity=float(payload.get("main", {}).get("humidity", 0.0)),
            wind_speed=round(float(payload.get("wind", {}).get("speed", 0.0)) * 3.6, 1),
            precipitation_1h=float(payload.get("rain", {}).get("1h", 0.0) or 0.0),
        )
        _weather_cache[cache_key] = weather
        return weather
    except Exception as exc:
        print(f"Weather lookup failed for '{location}': {exc}")
        return None


def weather_to_text(weather: CurrentWeather | None) -> str:
    if not weather:
        return "Live weather unavailable."
    rain_note = f", rainfall last 1h {weather.precipitation_1h} mm" if weather.precipitation_1h else ""
    return (
        f"Live weather for {weather.location}: {weather.temperature} C, {weather.condition}, "
        f"humidity {weather.humidity}%, wind {weather.wind_speed} km/h{rain_note}."
    )


def extract_crop_from_text(text: str) -> str | None:
    lower = text.lower()
    for crop in sorted(CROP_KEYWORDS, key=len, reverse=True):
        if re.search(rf"\b{re.escape(crop)}\b", lower):
            return "rice" if crop == "paddy" else crop
    return None


def is_market_query(text: str) -> bool:
    lower = text.lower()
    return any(re.search(rf"\b{re.escape(term)}\b", lower) for term in MARKET_QUERY_TERMS)


def fetch_market_prices(location: str, crop: str | None, limit: int = 8) -> list[MarketPrice]:
    if not MARKET_API_KEY or not location:
        return []

    cache_key = f"{location.strip().lower()}::{(crop or 'all').strip().lower()}::{limit}"
    if cache_key in _market_cache:
        return _market_cache[cache_key]

    url = (
        f"{MARKET_API_BASE}?api-key={quote_plus(MARKET_API_KEY)}&format=json&limit={limit}&offset=0"
        f"&filters[state]={quote_plus(location)}"
    )
    if crop and crop.lower() != "all":
        url += f"&filters[commodity]={quote_plus(crop.title())}"

    try:
        with urlopen(url, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        records = payload.get("records", []) or []
        prices = []
        for record in records:
            try:
                modal_price = float(record.get("modal_price", 0) or 0)
            except (TypeError, ValueError):
                modal_price = 0
            if modal_price <= 0:
                continue
            prices.append(
                MarketPrice(
                    crop_name=record.get("commodity", crop or "Unknown"),
                    variety=record.get("variety", ""),
                    market=record.get("market", ""),
                    state=record.get("state", ""),
                    district=record.get("district", ""),
                    min_price=float(record.get("min_price", 0) or 0),
                    max_price=float(record.get("max_price", 0) or 0),
                    modal_price=modal_price,
                    arrival_date=record.get("arrival_date", ""),
                )
            )
        _market_cache[cache_key] = prices
        return prices
    except Exception as exc:
        print(f"Market lookup failed for '{location}' / '{crop}': {exc}")
        return []


def market_prices_to_text(prices: list[MarketPrice]) -> str:
    if not prices:
        return "Live mandi price data unavailable."
    lines = []
    for price in prices[:5]:
        lines.append(
            f"{price.crop_name} at {price.market}, {price.district}: modal Rs {int(price.modal_price)}/quintal, "
            f"min Rs {int(price.min_price)}, max Rs {int(price.max_price)}, date {price.arrival_date}."
        )
    return "Live mandi prices:\n" + "\n".join(lines)


def load_rag_chunks():
    global _rag_chunks
    if _rag_chunks is not None:
        return _rag_chunks

    chunks = []
    if not RAG_INDEX_PATH.exists():
        print(f"RAG index not found at {RAG_INDEX_PATH}. Run ml/build_rag_index_windows.ps1.")
        _rag_chunks = []
        return _rag_chunks

    with RAG_INDEX_PATH.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            record = json.loads(line)
            tokens = tokenize(f"{record.get('source', '')} {record.get('category', '')} {record.get('text', '')}")
            record["_tokens"] = tokens
            record["_token_set"] = set(tokens)
            chunks.append(record)

    _rag_chunks = chunks
    print(f"Loaded {len(chunks)} RAG chunks from {RAG_INDEX_PATH}")
    return _rag_chunks


def infer_title_from_source(source: str) -> str:
    stem = Path(source).stem.replace("_", " ").replace("-", " ").strip()
    return stem.title()


def load_rag_source_map():
    global _rag_source_map
    if _rag_source_map is not None:
        return _rag_source_map

    mapping = {}
    if not RAG_SOURCES_PATH.exists():
        _rag_source_map = mapping
        return mapping

    lines = RAG_SOURCES_PATH.read_text(encoding="utf-8").splitlines()
    current_source = None
    for line in lines:
        source_match = re.match(r"- `(.+?)`", line.strip())
        if source_match:
            current_source = source_match.group(1)
            mapping[current_source] = {
                "title": infer_title_from_source(current_source),
                "url": "",
            }
            continue

        url_match = re.match(r"Source:\s*(https?://\S+)", line.strip())
        if current_source and url_match:
            mapping[current_source]["url"] = url_match.group(1)
            host = re.sub(r"^https?://", "", mapping[current_source]["url"]).split("/")[0]
            mapping[current_source]["host"] = host

    _rag_source_map = mapping
    return mapping


def retrieve_rag_context(query: str, top_k: int = RAG_TOP_K) -> tuple[str, list[dict]]:
    chunks = load_rag_chunks()
    if not chunks:
        return "", []

    query_tokens = tokenize(query)
    if not query_tokens:
        return "", []

    query_set = set(query_tokens)
    scored = []
    lower_query = query.lower()

    for chunk in chunks:
        token_set = chunk["_token_set"]
        overlap = query_set & token_set
        if not overlap:
            continue

        score = sum(2.5 if token in {"tomato", "rice", "paddy", "fungicide", "pesticide", "nitrogen", "irrigation", "blight"} else 1.0 for token in overlap)

        category = chunk.get("category", "")
        source = chunk.get("source", "").lower()
        if ("tomato" in lower_query or "blight" in lower_query) and ("tomato" in category or "tomato" in source):
            score += 5
        if ("rice" in lower_query or "paddy" in lower_query) and ("rice" in category or "rice" in source):
            score += 5
        if any(term in lower_query for term in ["pesticide", "fungicide", "spray"]) and "pesticide" in category:
            score += 4
        if any(term in lower_query for term in ["fertilizer", "nitrogen", "potassium", "nutrient"]) and "fertilizer" in category:
            score += 4

        scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    selected = [chunk for _, chunk in scored[:top_k]]

    if not selected:
        return "", []

    blocks = []
    sources = []
    source_map = load_rag_source_map()
    for chunk in selected:
        source = chunk["source"]
        page = chunk["page"]
        source_info = source_map.get(
            source,
            {"title": infer_title_from_source(source), "url": "", "host": ""},
        )
        sources.append(
            {
                "source": source,
                "title": source_info.get("title", infer_title_from_source(source)),
                "url": source_info.get("url", ""),
                "host": source_info.get("host", ""),
                "page": page,
            }
        )
        blocks.append(
            f"Source title: {source_info.get('title', infer_title_from_source(source))}, page {page}\n"
            f"Source URL: {source_info.get('url', '')}\n"
            f"{chunk['text'][:1200]}"
        )

    return "\n\n---\n\n".join(blocks), sources


def clean_generation(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"</?think>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^\s*(okay,?\s*)?(let'?s\s+)?(think|reason)\b.*?(?=(#{1,3}\s|\*\*|1\.|\n\n|$))", "", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"\n>\s*\*?\s*$", "", text)
    text = re.sub(r"[ \t]+", " ", text).strip()
    return text or "I need a little more detail to give a useful farming advisory."


def enforce_advisory_constraints(text: str, query: str) -> str:
    lower_query = query.lower()
    moisture_terms = ("soil moisture", "tensiometer", "standing water", "field is dry", "field is wet")
    if "irrigat" in lower_query and not any(term in lower_query for term in moisture_terms):
        text = re.sub(
            r"\*\*Do not irrigate(?: today| tomorrow)?\*\*\.?",
            "**Irrigation need cannot be confirmed yet**.",
            text,
            flags=re.IGNORECASE,
        )

    variety_terms = ("variety", "cultivar", "pr 126", "short-duration", "long-duration")
    if "fertiliz" in lower_query and not any(term in lower_query for term in variety_terms):
        text = re.sub(
            r"\*\*Do not apply fertilizer(?: today| tomorrow)?\*\*\.?",
            "**Fertilizer timing cannot be confirmed yet**.",
            text,
            flags=re.IGNORECASE,
        )

    symptom_terms = ("chlorosis", "iron deficiency", "yellow", "pale", "foliar", "ferrous", "potassium nitrate")
    if not any(term in lower_query for term in symptom_terms):
        text = re.sub(
            r"(?im)^.*(?:chlorosis|iron deficiency|foliar|ferrous sulphate|potassium nitrate).*(?:\n|$)",
            "",
            text,
        )
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def append_sources(text: str, sources: list[dict]) -> str:
    if not sources:
        return text
    text_without_sources = re.sub(r"\n\nSources:.*$", "", text.rstrip(), flags=re.IGNORECASE | re.DOTALL)
    unique_sources = []
    for source in sources:
        label = source["title"]
        if source.get("host"):
            label += f" ({source['host']})"
        if source.get("page"):
            label += f", p.{source['page']}"
        if source.get("url"):
            label += f" - {source['url']}"
        if label not in unique_sources:
            unique_sources.append(label)
    return text_without_sources + "\n\nSources: " + "; ".join(unique_sources[:4])


def add_agronomy_safety_note(text: str, query: str) -> str:
    lower_query = query.lower()
    if not any(term in lower_query for term in ("fungicide", "pesticide", "insecticide", "spray")):
        return text

    note = (
        "\n\nSafety check: Do not spray during rain, strong wind, or when leaves are wet. "
        "Spray only if the disease is confirmed, follow the product label, use protective gear, "
        "and verify dosage with a local agriculture officer or KVK."
    )
    lower_text = text.lower()
    if "rain" in lower_query and "do not spray during rain" not in lower_text:
        return text.rstrip() + note
    return text


def fallback_chat(query: str, crop_context: str = "crop") -> str:
    return (
        f"For {crop_context}, start with local soil and weather conditions, then verify the crop stage before taking action. "
        f"Based on your question ({query[:120]}), check leaf symptoms, irrigation, recent rain, and pest presence. "
        "Use low-risk steps first: remove infected leaves, avoid overwatering, improve airflow, and consult a local Krishi Vigyan Kendra for chemical dosage."
    )


def rule_based_agronomy_answer(query: str) -> str | None:
    lower = query.lower()

    if "tomato leaf" in lower and any(phrase in lower for phrase in ["can i eat", "is it edible", "eat this", "safe to eat"]):
        return (
            "Tomato leaves are generally not recommended for eating. They are not the edible part normally consumed, "
            "and if the leaf is diseased or has been sprayed, eating it is even less advisable.\n\n"
            "Practical answer:\n"
            "1. Do not eat a diseased tomato leaf.\n"
            "2. Do not use leaves from plants that may have pesticide or fungicide residue unless you are certain about the product and pre-harvest interval.\n"
            "3. Focus on whether the fruits are healthy. If the fruit is clean, mature, and disease-free, that is a separate assessment from the leaf.\n"
            "4. Remove visibly infected leaves from the plant and monitor disease spread.\n\n"
            "If you want, upload a clear close-up and ask whether the plant likely has early blight, late blight, or another leaf disease."
        )

    if "image analysis result:" in lower and "tomato" in lower:
        disease_match = re.search(r"image analysis result:\s*([^,.\n]+)", query, flags=re.IGNORECASE)
        disease_name = disease_match.group(1).strip() if disease_match else "a tomato leaf disease"
        return (
            f"The uploaded tomato leaf most likely matches {disease_name}.\n\n"
            "What to do next:\n"
            "1. Remove badly affected lower leaves and keep them out of the field.\n"
            "2. Avoid overhead irrigation and reduce leaf wetness.\n"
            "3. Improve spacing and airflow if the crop canopy is dense.\n"
            "4. Compare symptoms with official tomato disease guidance and confirm before spraying.\n"
            "5. If fungicide is needed, use only locally approved products at the label dose and avoid spraying during rain, strong wind, or on wet leaves.\n\n"
            "If you send one more message with field conditions like recent rain, humidity, and whether fruits are also affected, I can narrow the next step further."
        )

    if ("paddy" in lower or "rice" in lower) and "tillering" in lower and "nitrogen" in lower:
        return (
            "For paddy at tillering with low nitrogen, keep the plan simple and weather-aware.\n\n"
            "1. Nitrogen: Apply the next split only when the field is manageable and rain is not heavy. "
            "If only light rain is expected tomorrow, apply after the rain or when leaves are dry so fertilizer is not washed away.\n"
            "2. Potassium: If potassium is medium, avoid extra application unless your soil report or local package of practices specifically recommends a split dose.\n"
            "3. Irrigation: Maintain shallow standing water, around 2-5 cm, during tillering. If rain gives enough water, skip irrigation instead of adding more.\n"
            "4. Next 3-5 days: Watch leaf color and crop vigor. If leaves remain pale after the nitrogen split, confirm the exact area dose for your variety with the local KVK or agriculture officer.\n\n"
            "Precautions:\n"
            "- Do not broadcast urea into deep or fast-moving water.\n"
            "- Do not apply fertilizer just before heavy rainfall.\n"
            "- Avoid runoff carrying fertilizer out of the field."
        )

    if "tomato" in lower and any(word in lower for word in ["spot", "spots", "ring", "rings", "blight", "fungicide", "spray"]):
        return (
            "Tomato leaves with brown/yellow spots after continuous rain are commonly linked with fungal or bacterial leaf diseases "
            "such as early blight, Septoria leaf spot, or late blight. A photo/field check is needed before naming one disease confidently.\n\n"
            "What to do now:\n"
            "1. Remove badly infected lower leaves and keep them away from the field.\n"
            "2. Improve airflow; avoid overhead irrigation.\n"
            "3. Do not spray during rain, strong wind, or on wet leaves. If rain is likely tomorrow, wait until the leaves are dry unless a local expert confirms urgent action.\n"
            "4. If disease is confirmed, use a locally approved tomato fungicide/protectant at the label dose. Common protectants include copper-based products, mancozeb, or chlorothalonil, but use only what is legal and recommended in your area.\n"
            "5. For irrigation, skip tomorrow if soil already has enough moisture from rain. Check soil moisture first.\n\n"
            "If the spots are spreading fast with water-soaked lesions, take a close-up photo to the local KVK/agriculture officer because late blight can move quickly in humid weather."
        )

    return None


def extract_farmer_facts(query: str) -> list[str]:
    facts = []

    age_match = re.search(r"\b(\d{1,3})\s*days?\s*old\b", query, flags=re.IGNORECASE)
    if age_match:
        facts.append(f"crop age: {age_match.group(1)} days")

    stage_match = re.search(r"\bin\s+([a-z][a-z -]{2,40})\s+stage\b", query, flags=re.IGNORECASE)
    if stage_match:
        facts.append(f"crop stage: {stage_match.group(1).strip()} stage")

    nutrient_patterns = [
        (r"\blow\s+nitrogen\b", "soil nitrogen: low"),
        (r"\bmedium\s+nitrogen\b", "soil nitrogen: medium"),
        (r"\bhigh\s+nitrogen\b", "soil nitrogen: high"),
        (r"\blow\s+phosphorus\b", "soil phosphorus: low"),
        (r"\bmedium\s+phosphorus\b", "soil phosphorus: medium"),
        (r"\bhigh\s+phosphorus\b", "soil phosphorus: high"),
        (r"\blow\s+potassium\b", "soil potassium: low"),
        (r"\bmedium\s+potassium\b", "soil potassium: medium"),
        (r"\bhigh\s+potassium\b", "soil potassium: high"),
        (r"\blow\s+zinc\b", "soil zinc: low"),
        (r"\bmedium\s+zinc\b", "soil zinc: medium"),
        (r"\bhigh\s+zinc\b", "soil zinc: high"),
    ]
    for pattern, label in nutrient_patterns:
        if re.search(pattern, query, flags=re.IGNORECASE):
            facts.append(label)

    rain_match = re.search(r"\b(light|moderate|heavy)\s+rain\b", query, flags=re.IGNORECASE)
    if rain_match:
        facts.append(f"rain condition: {rain_match.group(1).lower()} rain")

    if "tomorrow" in query.lower():
        facts.append("time reference: tomorrow")

    location = extract_location_from_text(query)
    if location:
        facts.append(f"location: {location}")

    return facts


def generate_with_hf_qwen(messages: list[dict]) -> str | None:
    if not HF_QWEN_API_URL:
        return None

    headers = {"Content-Type": "application/json"}
    if HF_API_TOKEN:
        headers["Authorization"] = f"Bearer {HF_API_TOKEN}"

    payload = json.dumps(
        {
            "model": HF_QWEN_MODEL,
            "messages": messages[-16:],
            "temperature": 0.2,
            "max_tokens": 700,
        }
    ).encode("utf-8")

    try:
        request = Request(HF_QWEN_API_URL, data=payload, headers=headers, method="POST")
        with urlopen(request, timeout=HF_QWEN_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
        answer = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        return answer or None
    except Exception as exc:
        print(f"Hugging Face Qwen unavailable, using local fallback: {exc}")
        return None


def generate_text(messages: list[dict], fallback_query: str) -> str:
    context_blob = "\n\n".join(
        m.get("content", "")
        for m in messages
        if m.get("role") == "user" and m.get("content")
    )
    fallback_context = f"{fallback_query}\n\n{context_blob}".strip()

    remote_answer = generate_with_hf_qwen(messages)
    if remote_answer:
        cleaned = enforce_advisory_constraints(clean_generation(remote_answer), fallback_query)
        return add_agronomy_safety_note(cleaned, fallback_query)

    rule_answer = rule_based_agronomy_answer(fallback_context)
    if rule_answer:
        return rule_answer

    pipe, tokenizer = load_text_pipeline()
    if not pipe:
        return fallback_chat(fallback_context)

    if tokenizer and tokenizer.chat_template:
        try:
            prompt = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
                enable_thinking=False,
            )
        except TypeError:
            prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    else:
        prompt = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages) + "\nASSISTANT:"

    try:
        output = pipe(prompt)[0]["generated_text"]
        return add_agronomy_safety_note(clean_generation(output), fallback_query)
    except Exception as exc:
        print(f"Text generation failed, using rule fallback: {exc}")
        return fallback_chat(fallback_context)


@app.get("/health")
def health():
    return {
        "ok": True,
        "disease_model": str(DISEASE_MODEL_DIR / "model.pt"),
        "advisory_model": str(ADVISORY_MODEL_DIR),
        "base_model": ADVISORY_BASE_MODEL,
        "rag_index": str(RAG_INDEX_PATH),
        "rag_chunks": len(load_rag_chunks()),
        "cuda": torch.cuda.is_available(),
        "weather_api_configured": bool(WEATHER_API_KEY),
        "market_api_configured": bool(MARKET_API_KEY),
        "hf_qwen_configured": bool(HF_QWEN_API_URL),
    }


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    location = find_best_location(request)
    live_weather = fetch_current_weather(location) if location else None
    weather_text = weather_to_text(live_weather)
    fact_lines = extract_farmer_facts(request.query)
    crop = extract_crop_from_text(
        "\n".join([request.query, request.documentContent or "", " ".join(item.text for item in request.history[-6:])])
    )
    market_prices = fetch_market_prices(location, crop) if location and is_market_query(request.query) else []
    market_text = market_prices_to_text(market_prices)

    rag_context, rag_sources = retrieve_rag_context(
        f"{request.query}\n{request.documentContent or ''}\n{request.managementType}\n"
        f"{location or ''}\n{weather_text}\n{market_text}\n{crop or ''}"
    )
    system = (
        "You are eKheti, an expert agricultural advisor for Indian farmers. "
        "If asked who created you, answer Harsh Raj. Give concise, actionable, safe advice. "
        "If facts are uncertain, say what to verify locally. "
        "Never reveal hidden reasoning, chain-of-thought, or <think> tags. "
        "For pesticide or fungicide advice, avoid exact chemical dosage unless trusted context provides it. "
        "Warn farmers not to spray during rain, wind, or wet leaves. "
        "When trusted RAG context is provided, use it as the primary source and mention uncertainty clearly. "
        "If live weather is available, use it directly and connect it to irrigation, fertilizer timing, and disease risk. "
        "Never decide whether irrigation is needed from weather alone; use field moisture, standing water, or a trusted threshold. "
        "CRITICAL: If those measurements are missing, never say irrigate or do not irrigate; state that irrigation need cannot be confirmed, then explain what to measure. "
        "If live mandi price data is available, use it for market-price, selling, or profit questions. "
        "Do not change user facts like crop age, soil nutrients, rainfall, crop stage, or location. "
        "Never swap phosphorus with potassium or invent missing numbers. "
        "Use this exact concise Markdown structure: **Assessment**, **What to do now**, "
        "**Next 7 days**, **Safety**, and **Missing information**. Omit a section only when it truly does not apply. "
        "Answer only what the farmer asked; never add unrelated chemical, foliar-spray, deficiency, or future-stage treatments even if they appear in retrieved context. "
        "CRITICAL: When timing depends on crop variety and the variety is missing, never call an application due, overdue, passed, or not due. "
        "List the timing alternatives and ask for the variety instead of choosing one. "
        "Do not create a Sources section because verified source links are appended by the eKheti server."
    )
    if request.language:
        system += f" Reply in language code {request.language}."

    messages = [{"role": "system", "content": system}]
    for item in request.history[-8:]:
        messages.append({"role": item.role, "content": item.text})
    if request.documentContent:
        messages.append({"role": "user", "content": f"Document context:\n{request.documentContent[:4000]}"})
    if location or live_weather:
        messages.append(
            {
                "role": "user",
                "content": (
                    f"Detected location: {location or 'not found'}\n"
                    f"{weather_text}\n"
                    "Use this live weather only if it clearly matches the farmer's question."
                ),
            }
        )
    if market_prices:
        messages.append(
            {
                "role": "user",
                "content": (
                    f"Detected crop for market query: {crop or 'unknown'}\n"
                    f"{market_text}\n"
                    "Use this live mandi data only for market-price, selling, profit, or best-market questions."
                ),
            }
        )
    if rag_context:
        messages.append({"role": "user", "content": f"Trusted agriculture guide context:\n{rag_context[:5000]}"})
    messages.append(
        {
            "role": "user",
            "content": (
                f"Management type: {request.managementType}\n"
                f"Farmer question: {request.query}\n"
                f"Farmer facts to preserve exactly:\n- " + "\n- ".join(fact_lines if fact_lines else ["No structured facts extracted."]) + "\n"
                "Start by briefly restating the farmer facts correctly before giving advice. "
                "If a fact is missing, say it is missing instead of inventing it."
            ),
        }
    )
    advice = generate_text(messages, request.query)
    return {"advice": append_sources(advice, rag_sources)}


@app.post("/advisory", response_model=AdvisoryResponse)
def advisory(request: AdvisoryRequest):
    weather = "Weather data unavailable."
    if request.weather:
        weather = (
            f"Temperature {request.weather.temperature} C, {request.weather.condition}, "
            f"humidity {request.weather.humidity}%, wind {request.weather.windSpeed} km/h."
        )
    elif request.location:
        live_weather = fetch_current_weather(request.location)
        weather = weather_to_text(live_weather)

    query = (
        f"{request.cropType} {request.soilDetails} {request.currentStageOfCrop} "
        f"{request.location} {request.advisory} {weather}"
    )
    rag_context, rag_sources = retrieve_rag_context(query)

    messages = [
        {
            "role": "system",
            "content": (
                "You are eKheti, a precise agricultural advisor. Give practical, stage-wise advice. "
                "Never reveal hidden reasoning or <think> tags. Do not recommend spraying during rain, "
                "wind, or wet leaves."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Crop/fruit: {request.cropType}\nSoil: {request.soilDetails}\n"
                f"Stage: {request.currentStageOfCrop}\nLocation: {request.location}\n"
                f"Weather: {weather}\nLanguage: {request.language or 'same as user'}\n"
                f"Trusted agriculture guide context:\n{rag_context[:5000] if rag_context else 'No retrieved context.'}\n"
                "Give a short weather-aware advisory with irrigation, pest/disease, and next action."
            ),
        },
    ]
    advisory_text = generate_text(messages, query)
    return {"integratedAdvisory": append_sources(advisory_text, rag_sources)}


@app.post("/disease", response_model=DiseaseResponse)
def disease(request: DiseaseRequest):
    from torchvision import transforms

    model, labels, image_size = load_disease_model()
    image = decode_data_uri(request.photoDataUri)
    transform = transforms.Compose(
        [
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    tensor = transform(image).unsqueeze(0)
    if torch.cuda.is_available():
        tensor = tensor.cuda()

    with torch.no_grad():
        probabilities = torch.softmax(model(tensor), dim=1)[0]
        candidate_probabilities = filter_probabilities_by_item_type(probabilities, labels, request.itemType)
        top_values, top_indices = torch.topk(candidate_probabilities, k=min(2, len(labels)))
        confidence = top_values[0]
        index = top_indices[0]
        runner_up = top_values[1] if len(top_values) > 1 else torch.tensor(0.0, device=confidence.device)

    raw_label = labels[int(index.item())]
    disease_name = raw_label.replace("___", " - ").replace("_", " ")
    disease_detected = "healthy" not in disease_name.lower()
    confidence_level = float(confidence.item())
    margin = float((confidence - runner_up).item())

    if confidence_level < DISEASE_CONFIDENCE_THRESHOLD or margin < DISEASE_MARGIN_THRESHOLD:
        return {
            "diseaseDetected": False,
            "diseaseName": "Uncertain / unknown",
            "confidenceLevel": confidence_level,
            "suggestedSolutions": (
                "The model is not confident enough to identify this disease. Upload a clearer close-up leaf image "
                "with good lighting, include the crop name, and confirm with a local agriculture officer before spraying."
            ),
        }

    if disease_detected:
        solution = (
            f"Detected {disease_name}. Isolate affected leaves, avoid overhead watering, improve airflow, "
            "and compare with local extension guidance before spraying. Use crop-specific fungicide or pesticide only at the labelled dose."
        )
    else:
        solution = "The leaf appears healthy. Continue regular monitoring, balanced irrigation, and field sanitation."

    return {
        "diseaseDetected": disease_detected,
        "diseaseName": disease_name,
        "confidenceLevel": confidence_level,
        "suggestedSolutions": solution,
    }


def plant_name_from_label(label: str) -> str:
    name = label.replace("___", " ").replace("_", " ").lower()
    first = name.split(" ", 1)[0]
    if first == "bell":
        return "bell pepper"
    return first


def filter_probabilities_by_item_type(probabilities, labels, item_type: str):
    allowed = FRUIT_PLANTS if item_type == "Fruit" else CROP_PLANTS
    mask = torch.tensor(
        [plant_name_from_label(label) in allowed for label in labels],
        device=probabilities.device,
        dtype=torch.bool,
    )
    if not torch.any(mask):
        return probabilities

    filtered = probabilities.clone()
    filtered[~mask] = 0
    return filtered


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
