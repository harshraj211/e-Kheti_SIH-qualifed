import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--api-url', default='http://127.0.0.1:8000')
    parser.add_argument('--dataset', default='ml/evals/agriculture_eval.json')
    args = parser.parse_args()

    cases = json.loads(Path(args.dataset).read_text(encoding='utf-8'))
    passed = 0
    failures = []
    for case in cases:
        body = json.dumps({'query': case['query'], 'managementType': 'Crops'}).encode('utf-8')
        request = Request(f"{args.api_url.rstrip('/')}/chat", data=body, headers={'Content-Type': 'application/json'})
        try:
            with urlopen(request, timeout=180) as response:
                answer = json.loads(response.read().decode('utf-8'))['advice']
        except Exception as exc:
            failures.append((case['id'], f'API error: {exc}'))
            continue

        lower = answer.lower()
        missing = [term for term in case['required'] if term.lower() not in lower]
        forbidden = [term for term in case['forbidden'] if term.lower() in lower]
        if not missing and not forbidden:
            passed += 1
            print(f"PASS {case['id']}")
        else:
            failures.append((case['id'], f'missing={missing}, forbidden={forbidden}'))
            print(f"FAIL {case['id']}: missing={missing}, forbidden={forbidden}")

    print(f"\nResult: {passed}/{len(cases)} passed")
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
