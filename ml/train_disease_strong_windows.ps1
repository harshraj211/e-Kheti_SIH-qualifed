$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (!(Test-Path $PythonExe)) {
  & (Join-Path $PSScriptRoot "setup_windows.ps1")
}

& $PythonExe (Join-Path $PSScriptRoot "train_disease_classifier.py") `
  --architecture convnext_tiny `
  --epochs 12 `
  --batch-size 8 `
  --output-dir (Join-Path $PSScriptRoot "outputs\disease-classifier")
