param()

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Soccer Stats - Requirements Check" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$checks = @()

# Node.js
$nodeOk = Get-Command node -ErrorAction SilentlyContinue
if ($nodeOk) {
    $ver = node -v
    Write-Host "✓ Node.js: $ver" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ Node.js: NOT FOUND" -ForegroundColor Red
    $checks += $false
}

# npm
$npmOk = Get-Command npm -ErrorAction SilentlyContinue
if ($npmOk) {
    $ver = npm -v
    Write-Host "✓ npm: $ver" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ npm: NOT FOUND" -ForegroundColor Red
    $checks += $false
}

# Java
$javaOk = Get-Command java -ErrorAction SilentlyContinue
if ($javaOk) {
    Write-Host "✓ Java: FOUND" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ Java: NOT FOUND" -ForegroundColor Red
    $checks += $false
}

# JAVA_HOME
if ($env:JAVA_HOME) {
    Write-Host "✓ JAVA_HOME: SET" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ JAVA_HOME: NOT SET" -ForegroundColor Red
    $checks += $false
}

# ANDROID_HOME
if ($env:ANDROID_HOME) {
    Write-Host "✓ ANDROID_HOME: SET" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ ANDROID_HOME: NOT SET" -ForegroundColor Red
    $checks += $false
}

# Android SDK path
if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    Write-Host "✓ Android SDK: PATH EXISTS" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ Android SDK: PATH NOT FOUND" -ForegroundColor Red
    $checks += $false
}

# Capacitor
$capOk = Get-Command npx -ErrorAction SilentlyContinue
if ($capOk) {
    Write-Host "✓ Capacitor: AVAILABLE" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ Capacitor: NOT AVAILABLE" -ForegroundColor Red
    $checks += $false
}

# capacitor.config.json
if (Test-Path "capacitor.config.json") {
    Write-Host "✓ capacitor.config.json: FOUND" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ capacitor.config.json: NOT FOUND" -ForegroundColor Red
    $checks += $false
}

# android folder
if (Test-Path "android") {
    Write-Host "✓ android folder: FOUND" -ForegroundColor Green
    $checks += $true
} else {
    Write-Host "❌ android folder: NOT FOUND" -ForegroundColor Red
    $checks += $false
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan

$allOk = $checks | Where-Object { $_ -eq $false }
if ($allOk.Count -eq 0) {
    Write-Host "✓ All requirements OK!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next: .\build-apk-debug.ps1" -ForegroundColor Cyan
} else {
    Write-Host "❌ Missing: $($allOk.Count) requirements" -ForegroundColor Red
    Write-Host ""
    Write-Host "See: APK_GUIDE.md" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
