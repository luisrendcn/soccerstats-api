@echo off
REM Script para construir APK de debug
REM Soccer Stats - APK Builder

echo.
echo ========================================
echo  Soccer Stats - APK Debug Build
echo ========================================
echo.

REM Verifica que estemos en el directorio correcto
if not exist "capacitor.config.json" (
    echo Error: No se encontro capacitor.config.json
    echo Ejecuta este script desde la raiz del proyecto
    pause
    exit /b 1
)

REM Verifica que Android SDK este disponible
if not defined ANDROID_HOME (
    echo Error: ANDROID_HOME no esta definida
    echo Por favor, configura las variables de entorno
    echo Consulta APK_GUIDE.md para instrucciones
    pause
    exit /b 1
)

echo Paso 1: Compilando cliente...
call npm run build
if errorlevel 1 (
    echo Error en la compilacion del cliente
    pause
    exit /b 1
)

echo.
echo Paso 2: Sincronizando con Android...
call npx cap sync android
if errorlevel 1 (
    echo Error al sincronizar con Android
    pause
    exit /b 1
)

echo.
echo Paso 3: Construyendo APK de debug...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo Error al construir el APK
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================
echo  BUILD EXITOSO!
echo ========================================
echo.
echo Tu APK esta en:
echo   android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Para instalar en tu dispositivo (si esta conectado por USB):
echo   adb install android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
