$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$VenvPath = Join-Path $ProjectRoot ".venv"
$PythonExe = Join-Path $VenvPath "Scripts\python.exe"

if (!(Test-Path $PythonExe)) {
  python -m venv $VenvPath
}

& $PythonExe -m pip install --upgrade pip
& $PythonExe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
& $PythonExe -m pip install -r (Join-Path $PSScriptRoot "requirements.txt")

Write-Host "ML environment ready at $VenvPath"
