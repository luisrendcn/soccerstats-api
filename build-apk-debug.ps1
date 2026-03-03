# Script para construir APK de debug
# Soccer Stats - APK Builder (PowerShell)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Soccer Stats - APK Debug Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica que estemos en el directorio correcto
if (-not (Test-Path "capacitor.config.json")) {
    Write-Host "❌ Error: No se encontro capacitor.config.json" -ForegroundColor Red
    Write-Host "Ejecuta este script desde la raiz del proyecto" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Verifica que Android SDK este disponible
if (-not $env:ANDROID_HOME) {
    Write-Host "❌ Error: ANDROID_HOME no esta definida" -ForegroundColor Red
    Write-Host "Por favor, configura las variables de entorno" -ForegroundColor Red
    Write-Host "Consulta APK_GUIDE.md para instrucciones" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "✓ Variables de entorno OK" -ForegroundColor Green
Write-Host ""

try {
    Write-Host "Paso 1: Compilando cliente..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Error en la compilacion del cliente"
    }
    Write-Host "✓ Cliente compilado" -ForegroundColor Green

    Write-Host ""
    Write-Host "Paso 2: Sincronizando con Android..." -ForegroundColor Yellow
    npx cap sync android
    if ($LASTEXITCODE -ne 0) {
        throw "Error al sincronizar con Android"
    }
    Write-Host "✓ Sincronizacion exitosa" -ForegroundColor Green

    Write-Host ""
    Write-Host "Paso 3: Construyendo APK de debug..." -ForegroundColor Yellow
    Set-Location android
    .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
        throw "Error al construir el APK"
    }
    Set-Location ..
    Write-Host "✓ APK generado" -ForegroundColor Green

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ BUILD EXITOSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    Write-Host "Tu APK esta en:" -ForegroundColor Cyan
    Write-Host "  $apkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "Para instalar en tu dispositivo (si esta conectado por USB):" -ForegroundColor Cyan
    Write-Host "  adb install $apkPath" -ForegroundColor White
    Write-Host ""
    
    if (Test-Path $apkPath) {
        Write-Host "Tamaño del APK: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor Cyan
    }

} catch {
    Write-Host ""
    Write-Host "❌ ERROR: $_" -ForegroundColor Red
    Write-Host ""
}

Read-Host "Presiona Enter para salir"
