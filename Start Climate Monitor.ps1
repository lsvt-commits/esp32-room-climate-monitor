$projectRoot = $PSScriptRoot
try {
    $status = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/status' -TimeoutSec 2
    if ($null -ne $status.settings.city) {
        Write-Output 'ESP32 Room Climate Monitor is already running: http://localhost:8000'
        exit
    }
} catch {}
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
Start-Process -FilePath $nodeExecutable -ArgumentList 'server.cjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot 'monitor.log') -RedirectStandardError (Join-Path $projectRoot 'monitor-error.log')
Write-Output 'ESP32 Room Climate Monitor: http://localhost:8000'
