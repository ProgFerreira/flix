# Dispara POST /api/cron/billing com o CRON_SECRET do .env.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-billing-cron.ps1
# O Agendador de Tarefas chama este arquivo (veja install-billing-cron.ps1).

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $Root ".env"
$LogDir = Join-Path $Root "logs"
$LogFile = Join-Path $LogDir "billing-cron.log"

function Get-DotEnvValue {
  param([string]$Name, [string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
    $trim = $line.Trim()
    if ($trim -eq "" -or $trim.StartsWith("#")) { continue }
    $eq = $trim.IndexOf("=")
    if ($eq -lt 1) { continue }
    $key = $trim.Substring(0, $eq).Trim()
    if ($key -ne $Name) { continue }
    $val = $trim.Substring($eq + 1).Trim()
    if ($val.Length -ge 2) {
      $q = $val[0]
      if (($q -eq [char]34 -or $q -eq [char]39) -and $val[-1] -eq $q) {
        $val = $val.Substring(1, $val.Length - 2)
      }
    }
    return $val
  }
  return $null
}

function Write-CronLog {
  param([string]$Message)
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
}

if (-not (Test-Path $EnvFile)) {
  Write-CronLog "ERRO: .env nao encontrado em $Root"
  exit 1
}

$secret = Get-DotEnvValue -Name "CRON_SECRET" -Path $EnvFile
$base = Get-DotEnvValue -Name "NEXTAUTH_URL" -Path $EnvFile

if ([string]::IsNullOrWhiteSpace($secret)) {
  Write-CronLog "ERRO: CRON_SECRET vazio ou ausente no .env - o endpoint recusa o pedido"
  exit 1
}

if ([string]::IsNullOrWhiteSpace($base)) {
  $base = "http://localhost:3003"
}
$base = $base.TrimEnd("/")
$url = "$base/api/cron/billing"

try {
  $resp = Invoke-WebRequest -Uri $url -Method POST -Headers @{
    Authorization = "Bearer $secret"
  } -ContentType "application/json" -UseBasicParsing -TimeoutSec 120
  Write-CronLog ("{0} {1}" -f [int]$resp.StatusCode, $resp.Content)
  if ([int]$resp.StatusCode -ne 200) { exit 1 }
} catch {
  $status = $null
  if ($_.Exception.Response) {
    $status = [int]$_.Exception.Response.StatusCode
  }
  if ($status) {
    Write-CronLog "ERRO HTTP $status ao chamar $url - $($_.Exception.Message)"
  } else {
    Write-CronLog "ERRO ao chamar $url - $($_.Exception.Message)"
  }
  exit 1
}
