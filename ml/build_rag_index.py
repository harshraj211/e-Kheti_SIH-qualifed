import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"(\w)-\s+(\w)", r"\1\2", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text: str, chunk_words: int, overlap_words: int):
    words = text.split()
    if not words:
        return

    step = max(1, chunk_words - overlap_words)
    for start in range(0, len(words), step):
        chunk = words[start : start + chunk_words]
        if len(chunk) < 40:
            continue
        yield " ".join(chunk)


def extract_pdf(pdf_path: Path):
    reader = PdfReader(str(pdf_path))
    for page_index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as exc:
            print(f"Warning: failed page {page_index} in {pdf_path.name}: {exc}")
            continue
        text = clean_text(text)
        if text:
            yield page_index, text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs-dir", default="ml/rag_docs")
    parser.add_argument("--output", default="ml/rag_index.jsonl")
    parser.add_argument("--chunk-words", type=int, default=220)
    parser.add_argument("--overlap-words", type=int, default=50)
    args = parser.parse_args()

    docs_dir = Path(args.docs_dir)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(docs_dir.rglob("*.pdf"))
    if not pdfs:
        raise RuntimeError(f"No PDFs found under {docs_dir}")

    count = 0
    with output_path.open("w", encoding="utf-8") as out:
        for pdf_path in pdfs:
            category = pdf_path.parent.name
            source = pdf_path.relative_to(docs_dir).as_posix()
            print(f"Indexing {source}")
            for page, text in extract_pdf(pdf_path):
                for chunk_id, chunk in enumerate(chunk_text(text, args.chunk_words, args.overlap_words), start=1):
                    record = {
                        "id": f"{source}:p{page}:c{chunk_id}",
                        "source": source,
                        "category": category,
                        "page": page,
                        "text": chunk,
                    }
                    out.write(json.dumps(record, ensure_ascii=False) + "\n")
                    count += 1

    print(f"Wrote {count} chunks to {output_path}")


if __name__ == "__main__":
    main()
