$ErrorActionPreference = "SilentlyContinue"

$ports = @(5043, 5173)
$processIds = Get-NetTCPConnection -LocalPort $ports -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique

if (-not $processIds) {
  Write-Host "No JobWorkflow dev servers found on ports 5043 or 5173."
  exit 0
}

Stop-Process -Id $processIds -Force
Write-Host "Stopped JobWorkflow dev servers on ports 5043 and 5173."
