# Start local HTTP server for the app (avoids CORS with file://).
# Run after reboot, or add to Startup / Task Scheduler so it starts at logon.
$port = 8080
$root = $PSScriptRoot
Set-Location $root
Write-Host "Serving $root at http://localhost:$port/ (Ctrl+C to stop)"
python -m http.server $port
