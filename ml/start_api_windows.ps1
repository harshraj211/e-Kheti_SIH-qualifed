$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (!(Test-Path $PythonExe)) {
  & (Join-Path $PSScriptRoot "setup_windows.ps1")
}

$env:DISEASE_MODEL_DIR = Join-Path $PSScriptRoot "outputs\disease-classifier"
$env:ADVISORY_MODEL_DIR = Join-Path $PSScriptRoot "outputs\advisory-lora"
$env:ADVISORY_BASE_MODEL = "Qwen/Qwen3-0.6B"

& $PythonExe (Join-Path $PSScriptRoot "api.py")
