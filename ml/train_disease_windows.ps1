$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (!(Test-Path $PythonExe)) {
  & (Join-Path $PSScriptRoot "setup_windows.ps1")
}

& $PythonExe (Join-Path $PSScriptRoot "train_disease_classifier.py") `
  --architecture efficientnet_b0 `
  --epochs 10 `
  --batch-size 24 `
  --output-dir (Join-Path $PSScriptRoot "outputs\disease-classifier")
