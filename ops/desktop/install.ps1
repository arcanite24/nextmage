# Installs (or updates) Playmat on Windows and starts it. In PowerShell:
#
#   irm https://github.com/arcanite24/playmat/releases/latest/download/install.ps1 | iex
#
# Same as downloading and running Playmat-Setup-Windows-x64.exe, without the browser's download warnings.
# Installs for the current user only: no administrator prompt.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is far slower with its progress bar

$base = if ($env:PLAYMAT_DOWNLOAD_BASE) { $env:PLAYMAT_DOWNLOAD_BASE } else { 'https://github.com/arcanite24/playmat/releases/latest/download' }
$setup = Join-Path $env:TEMP 'Playmat-Setup-Windows-x64.exe'

Write-Host 'Downloading Playmat...' -ForegroundColor Yellow
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -UseBasicParsing -Uri "$base/Playmat-Setup-Windows-x64.exe" -OutFile $setup

Write-Host 'Installing...' -ForegroundColor Yellow
$process = Start-Process -FilePath $setup -ArgumentList '/SILENT', '/SUPPRESSMSGBOXES', '/CLOSEAPPLICATIONS', '/NORESTART' -Wait -PassThru
Remove-Item $setup -ErrorAction SilentlyContinue
if ($process.ExitCode -ne 0) { throw "The installer stopped with code $($process.ExitCode)" }

$app = Join-Path $env:LOCALAPPDATA 'Programs\Playmat'
Write-Host 'Playmat is installed. Starting it...' -ForegroundColor Green
Start-Process -FilePath (Join-Path $app 'runtime\bin\javaw.exe') -ArgumentList '-jar', "`"$app\app\playmat-launcher.jar`"" -WorkingDirectory $app
