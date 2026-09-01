# Antigravity Browser Bridge - Chrome Native Messaging Registration Script
param(
    [string]$ExtensionId
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$manifestPath = Join-Path $projectRoot "host\com.antigravity.browser_bridge.json"
$batPath = Join-Path $projectRoot "host\run-host.bat"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Antigravity Browser Bridge - Native Messaging Installer" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Update Manifest with exact Windows path
if (Test-Path $manifestPath) {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $manifest.path = $batPath
    
    if ($ExtensionId) {
        $origin = "chrome-extension://$ExtensionId/"
        if (-not ($manifest.allowed_origins -contains $origin)) {
            $manifest.allowed_origins += $origin
        }
        Write-Host "[+] Registered allowed origin for Extension ID: $ExtensionId" -ForegroundColor Green
    }

    $manifest | ConvertTo-Json -Depth 5 | Set-Content $manifestPath
    Write-Host "[+] Updated host manifest path: $manifestPath" -ForegroundColor Green
} else {
    Write-Error "Host manifest not found at $manifestPath"
}

# 2. Register in Windows Registry (HKCU - No admin rights required)
$registryKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.antigravity.browser_bridge"

if (-not (Test-Path $registryKey)) {
    New-Item -Path $registryKey -Force | Out-Null
    Write-Host "[+] Created registry key: $registryKey" -ForegroundColor Green
}

Set-ItemProperty -Path $registryKey -Name "(default)" -Value $manifestPath -Type String
Write-Host "[+] Set registry value pointing to $manifestPath" -ForegroundColor Green

Write-Host ""
Write-Host " Registration Complete!" -ForegroundColor Green
Write-Host "Chrome Native Messaging host is now active for Antigravity." -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
