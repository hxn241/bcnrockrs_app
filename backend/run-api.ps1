# Desde la carpeta backend: .\run-api.ps1
# Si falla, activa antes el venv: .\.venv\Scripts\Activate.ps1
Set-Location $PSScriptRoot
python -m uvicorn app.main:app --host 0.0.0.0 --port 8002
