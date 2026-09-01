# Aether Native Messaging Host Registration for Mozilla Firefox
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$HostDir = Join-Path $ProjectRoot "host"
$ManifestPath = Join-Path $HostDir "com.antigravity.browser_bridge.firefox.json"
$RunHostBat = Join-Path $HostDir "run-host.bat"

Write-Host "Registering Aether Native Messaging Host for Firefox..." -ForegroundColor Cyan

# 1. Update manifest absolute path to run-host.bat
$ManifestContent = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$ManifestContent.path = $RunHostBat
$ManifestContent | ConvertTo-Json -Depth 5 | Set-Content $ManifestPath -Encoding UTF8
Write-Host "Updated Firefox host manifest: $ManifestPath" -ForegroundColor Green

# 2. Register in Windows Registry under HKCU:\Software\Mozilla\NativeMessagingHosts
$RegPath = "HKCU:\Software\Mozilla\NativeMessagingHosts\com.antigravity.browser_bridge"

if (!(Test-Path $RegPath)) {
    New-Item -Path $RegPath -Force | Out-Null
}

Set-ItemProperty -Path $RegPath -Name "(Default)" -Value $ManifestPath
Write-Host "Registered in Registry: $RegPath -> $ManifestPath" -ForegroundColor Green
Write-Host "Firefox Native Host installation complete!" -ForegroundColor Cyan
