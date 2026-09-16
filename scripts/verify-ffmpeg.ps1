# Confere se ffmpeg/ffprobe respondem e se o encoder libx264 existe.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ffmpeg.ps1

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $Root ".env"

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

function Resolve-Bin {
  param([string]$EnvName, [string]$FallbackName, [string]$DefaultPath)
  $fromEnv = Get-DotEnvValue -Name $EnvName -Path $EnvFile
  if (-not [string]::IsNullOrWhiteSpace($fromEnv) -and (Test-Path $fromEnv)) { return $fromEnv }
  if (Test-Path $DefaultPath) { return $DefaultPath }
  $cmd = Get-Command $FallbackName -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$ffmpeg = Resolve-Bin -EnvName "FFMPEG_PATH" -FallbackName "ffmpeg" -DefaultPath "C:\ffmpeg\bin\ffmpeg.exe"
$ffprobe = Resolve-Bin -EnvName "FFPROBE_PATH" -FallbackName "ffprobe" -DefaultPath "C:\ffmpeg\bin\ffprobe.exe"

if (-not $ffmpeg) {
  Write-Error "ffmpeg nao encontrado. Instale o build essentials e defina FFMPEG_PATH no .env."
}
if (-not $ffprobe) {
  Write-Error "ffprobe nao encontrado. Instale o build essentials e defina FFPROBE_PATH no .env."
}

Write-Output "ffmpeg: $ffmpeg"
& $ffmpeg -version 2>&1 | Select-Object -First 1 | ForEach-Object { Write-Output $_ }
Write-Output "ffprobe: $ffprobe"
& $ffprobe -version 2>&1 | Select-Object -First 1 | ForEach-Object { Write-Output $_ }

$encoders = & $ffmpeg -hide_banner -encoders 2>&1 | Out-String
if ($encoders -notmatch "(?m)^\s*V\S*\s+libx264\s") {
  Write-Error "ffmpeg respondeu, mas o encoder libx264 nao esta disponivel. Use o build essentials da Gyan."
}

Write-Output "libx264: ok"
Write-Output "FFmpeg pronto para miniatura e variante 480p."
