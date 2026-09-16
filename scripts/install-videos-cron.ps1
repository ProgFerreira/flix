# Instala (ou remove) a tarefa de reenfileiramento de videos no Agendador do Windows.
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-videos-cron.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-videos-cron.ps1 -Uninstall

param(
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Runner = Join-Path $PSScriptRoot "run-process-videos-cron.ps1"
$EnvFile = Join-Path $Root ".env"
$TaskName = "FlixVideosCron"

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "Tarefa '$TaskName' removida (se existia)."
  exit 0
}

if (-not (Test-Path $Runner)) {
  throw "Nao achei $Runner"
}

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

if (-not (Test-Path $EnvFile)) {
  throw ".env nao encontrado em $Root. Copie .env.example e preencha as chaves."
}

$secret = Get-DotEnvValue -Name "CRON_SECRET" -Path $EnvFile
if ([string]::IsNullOrWhiteSpace($secret)) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $generated = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
  Add-Content -Path $EnvFile -Value "`nCRON_SECRET=`"$generated`"" -Encoding UTF8
  Write-Output "CRON_SECRET ausente: gerei um valor aleatorio e gravei no .env."
} else {
  Write-Output "CRON_SECRET ja definido no .env."
}

$arg = '-NoProfile -ExecutionPolicy Bypass -File "' + $Runner + '"'
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration ([TimeSpan]::FromDays(3650))
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 15) `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Flix: reenfileira uploads travados em processing (POST /api/cron/process-videos)." `
  -Force | Out-Null

Write-Output "Tarefa '$TaskName' agendada a cada 30 minutos."
Write-Output "O app precisa estar no ar (npm start). Log: logs\process-videos-cron.log"
Write-Output "Teste agora: powershell -NoProfile -ExecutionPolicy Bypass -File `"$Runner`""
Write-Output "Remover: powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Uninstall"
