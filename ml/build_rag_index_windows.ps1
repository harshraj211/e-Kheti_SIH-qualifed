$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (!(Test-Path $PythonExe)) {
  & (Join-Path $PSScriptRoot "setup_windows.ps1")
}

& $PythonExe (Join-Path $PSScriptRoot "build_rag_index.py") `
  --docs-dir (Join-Path $PSScriptRoot "rag_docs") `
  --output (Join-Path $PSScriptRoot "rag_index.jsonl")
