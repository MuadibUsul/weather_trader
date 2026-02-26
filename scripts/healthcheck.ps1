# 中文说明：开发与运维辅助脚本。

$base = $env:FRONTEND_API_BASE
if (-not $base) { $base = "http://localhost:8000" }

try {
  $resp = Invoke-RestMethod -Uri "$base/health" -Method GET
  $resp | ConvertTo-Json -Depth 4
} catch {
  Write-Error $_
  exit 1
}