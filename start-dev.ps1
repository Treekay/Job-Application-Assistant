$ErrorActionPreference = "Stop"

$pathValue = [Environment]::GetEnvironmentVariable("Path", "Process")
if ([string]::IsNullOrWhiteSpace($pathValue)) {
  $pathValue = [Environment]::GetEnvironmentVariable("PATH", "Process")
}
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", $pathValue, "Process")

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiUrl = "http://localhost:5043/api/health"
$clientUrl = "http://localhost:5173"
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$ports = @(5043, 5173)
$processIds = Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if ($processIds) {
  Stop-Process -Id $processIds -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

function Test-Url($url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Wait-Url($name, $url) {
  for ($i = 0; $i -lt 30; $i++) {
    if (Test-Url $url) {
      Write-Host "$name ready: $url"
      return
    }
    Start-Sleep -Seconds 1
  }
  Write-Host "$name did not respond yet. Check logs in $logs"
}

Start-Process -FilePath "dotnet" `
  -ArgumentList @("run", "--no-restore", "--project", "api/JobWorkflow.Api", "--launch-profile", "http") `
  -WorkingDirectory $root `
  -RedirectStandardOutput (Join-Path $logs "api.out.log") `
  -RedirectStandardError (Join-Path $logs "api.err.log") `
  -WindowStyle Hidden | Out-Null

Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("run", "dev", "--workspace", "client") `
  -WorkingDirectory $root `
  -RedirectStandardOutput (Join-Path $logs "client.out.log") `
  -RedirectStandardError (Join-Path $logs "client.err.log") `
  -WindowStyle Hidden | Out-Null

Wait-Url "API" $apiUrl
Wait-Url "Client" $clientUrl

Write-Host ""
Write-Host "JobWorkflow is ready."
Write-Host "API:    http://localhost:5043"
Write-Host "Client: http://localhost:5173"
Write-Host "Logs:   $logs"
Write-Host "Stop:   ./stop-dev.sh  or  .\stop-dev.ps1"
