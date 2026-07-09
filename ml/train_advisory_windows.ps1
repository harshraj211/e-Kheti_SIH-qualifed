$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (!(Test-Path $PythonExe)) {
  & (Join-Path $PSScriptRoot "setup_windows.ps1")
}

& $PythonExe (Join-Path $PSScriptRoot "train_advisory_lora.py") `
  --model-name Qwen/Qwen3-0.6B `
  --dataset AI71ai/agrillm-train-146k `
  --max-samples 5000 `
  --max-steps 800 `
  --output-dir (Join-Path $PSScriptRoot "outputs\advisory-lora")
