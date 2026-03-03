# 📱 Generador de APK - Soccer Stats

## ⚡ Quick Start

### 1️⃣ Verifica los requisitos instalados
```powershell
.\check-requirements.ps1
```

Esta herramienta te mostrará si tienes:
- ✓ Node.js y npm
- ✓ Java JDK
- ✓ Android SDK
- ✓ Variables de entorno configuradas

### 2️⃣ Si faltan requisitos, instálalos
Sigue la guía detallada en `APK_GUIDE.md` para:
- Descargar e instalar Java JDK
- Descargar e instalar Android SDK
- Configurar variables de entorno

### 3️⃣ Genera el APK
```powershell
.\build-apk-debug.ps1
```

El APK estará en: `android\app\build\outputs\apk\debug\app-debug.apk`

## 📋 Archivos Incluidos

| Archivo | Descripción |
|---------|-------------|
| `APK_GUIDE.md` | Guía completa detallada |
| `check-requirements.ps1` | Verifica que todo esté instalado |
| `build-apk-debug.ps1` | Script para compilar APK de debug |
| `build-apk-debug.bat` | Versión batch del script |
| `capacitor.config.json` | Configuración de Capacitor |
| `android/` | Proyecto Android nativo |

## 🚀 Pasos Detallados

### Instalación de Herramientas (Primera vez)

#### A. Java JDK
1. Descarga desde: https://www.oracle.com/java/technologies/javase/jdk21-archive-downloads.html
2. O usa Open JDK: https://jdk.java.net/
3. Instala normalmente

#### B. Android SDK
1. Descarga Android Studio: https://developer.android.com/studio
2. Instala normalmente
3. Abre Android Studio y completa la instalación del SDK

#### C. Configurar Variables de Entorno (PowerShell como Admin)
```powershell
# Java
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-21", "Machine")

# Android
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\sdk", "Machine")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "C:\Android\sdk", "Machine")

# Reinicia PowerShell para que los cambios tomen efecto
```

### Compilar APK

```powershell
# 1. Verifica herramientas
.\check-requirements.ps1

# 2. Si todo está OK, compila
.\build-apk-debug.ps1

# 3. El APK se encuentra en:
# android\app\build\outputs\apk\debug\app-debug.apk
```

## 📱 Instalar en Dispositivo o Emulador

### Con Emulador
```powershell
# Abre Android Studio y crea un emulador virtual

# Luego:
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

### Con Dispositivo Real
1. Conecta tu teléfono por USB
2. Habilita "Depuración USB" en Configuración > Opciones de Desarrollo
3. Ejecuta:
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

## 🔧 Troubleshooting

### "ANDROID_HOME not defined"
```powershell
# Configura manualmente
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\sdk", "Machine")
```

### "Gradle wrapper not found"
```bash
cd android
./gradlew --version  # Descarga automáticamente
cd ..
```

### "Build fails with SDK error"
```powershell
# Crea local.properties manualmente en la carpeta android:
echo sdk.dir=C:\\Android\\sdk > android\local.properties
```

## 📚 Documentación Completa

Consulta `APK_GUIDE.md` para:
- Instrucciones detalladas
- Generar APK de release (para publicar)
- Firmar APKs
- Troubleshooting avanzado

## 🎯 Próximos Pasos

1. ✅ Ejecuta `check-requirements.ps1`
2. ✅ Instala las herramientas que falten
3. ✅ Ejecuta `build-apk-debug.ps1`
4. ✅ Prueba el APK en un dispositivo o emulador

## 💡 Tips

- El primer build toma más tiempo (descarga dependencias)
- Usa emulador de Android Studio para probar
- Para distribución, genera APK de release (vé `APK_GUIDE.md`)
- Mantén gradle actualizado: `./gradlew --version` en carpeta android

---

**¿Necesitas ayuda?** Consulta `APK_GUIDE.md` o la documentación de Capacitor: https://capacitorjs.com/docs/android
