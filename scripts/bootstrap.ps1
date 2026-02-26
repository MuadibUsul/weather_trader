# 中文说明：开发与运维辅助脚本。

param(
  [switch]$UseUv = $false
)

if (Test-Path .env.example -and -not (Test-Path .env)) {
  Copy-Item .env.example .env
}

if ($UseUv) {
  uv pip install -r requirements.txt
} else {
  python -m pip install -r requirements.txt
}

Push-Location frontend
npm install
Pop-Location

Write-Host "Bootstrap completed"