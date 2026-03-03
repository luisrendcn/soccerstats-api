# Guía para Generar APK - Soccer Stats

## 📱 Requisitos Previos

Antes de generar el APK, necesitas instalar:

### 1. **Java Development Kit (JDK)**
- Descarga: https://www.oracle.com/java/technologies/javase/jdk21-archive-downloads.html
- O usa Open JDK: https://jdk.java.net/
- **Importante**: Necesitas JDK 11 o superior

**Instalación en Windows:**
```powershell
# Descarga e instala el JDK
# Luego, verifica la instalación:
java -version
javac -version
```

### 2. **Android SDK**
- Opción A: Descarga Android Studio (incluye SDK)
  - https://developer.android.com/studio
- Opción B: Descarga solo el SDK CLI
  - https://developer.android.com/studio/command-line/sdkmanager

**Instalación en Windows:**
```powershell
# Si usas Android Studio, la instalación es automática
# Si usas CLI, descarga y extrae en: C:\Android\sdk

# Verifica que esté instalado:
sdkmanager --list
```

### 3. **Variables de Entorno**
Configura las siguientes variables de entorno en Windows:

```powershell
# En PowerShell (ejecuta como administrador):
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-21", "Machine")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\sdk", "Machine")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "C:\Android\sdk", "Machine")

# Agrega a PATH:
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$newPath = "$currentPath;C:\Program Files\Java\jdk-21\bin;C:\Android\sdk\tools;C:\Android\sdk\platform-tools"
[Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")

# Verifica
java -version
adb version
```

## 🔨 Pasos para Generar el APK

### 1. Actualizar el proyecto
```bash
cd Soccer-Stats
npm run build
npx cap sync android
```

### 2. Generar APK de debug
```bash
cd android
./gradlew assembleDebug
```

El APK estará en: `android\app\build\outputs\apk\debug\app-debug.apk`

### 3. Generar APK de release (recomendado)
Primero, crea un archivo de firma (keystore):

```bash
cd android/app
# Windows PowerShell
keytool -genkey -v -keystore soccer-stats.keystore `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -alias soccer-stats-key

# Linux/Mac
keytool -genkey -v -keystore soccer-stats.keystore \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -alias soccer-stats-key
```

Luego, edita `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('soccer-stats.keystore')
            storePassword 'tu_password_aqui'
            keyAlias 'soccer-stats-key'
            keyPassword 'tu_password_aqui'
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

Finalmente, construye el APK de release:

```bash
./gradlew assembleRelease
```

El APK estará en: `android\app\build\outputs\apk\release\app-release.apk`

## 📲 Instalar en tu dispositivo

```bash
# Si tu teléfono está conectado por USB
adb install android\app\build\outputs\apk\debug\app-debug.apk

# Verifica que adb vea tu dispositivo:
adb devices
```

## 🐛 Troubleshooting

### Error: "ANDROID_HOME" no está establecido
```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Android\sdk", "Machine")
refreshenv
```

### Error: "java: command not found"
Verifica JAVA_HOME y agrega a PATH correctamente.

### Error: Gradle no encuentra SDK
```bash
cd android
# Crea local.properties
echo sdk.dir=C:\\Android\\sdk > local.properties
```

## 📋 Estructura del Proyecto

```
Soccer-Stats/
├── android/                    # Proyecto Android generado
│   ├── app/
│   │   ├── src/
│   │   ├── build.gradle
│   │   └── soccer-stats.keystore (una vez creado)
│   └── build.gradle
├── capacitor.config.json       # Configuración de Capacitor
├── dist/                       # Build files
└── ...
```

## 🚀 Próximos Pasos

1. Instala los requisitos previos (Java + Android SDK)
2. Configura las variables de entorno
3. **Define la URL del backend** (ver sección siguiente)
4. Ejecuta los comandos de build
5. ¡Prueba tu APK en un dispositivo o emulador!

## 🌐 Configurar la URL del backend
El cliente usa una variable de entorno de Vite para saber a qué servidor
conectarse. Cuando desarrolles o empaquetes el APK asegúrate de establecerla
adecuadamente:

```bash
# desarrollo en emulador Android (puede permanecer vacío para web)
export VITE_API_BASE="http://10.0.2.2:3000"
# o en Windows PowerShell
$env:VITE_API_BASE = "http://10.0.2.2:3000"

# en producción apunta a tu API en la nube
export VITE_API_BASE="https://api.soccerstats.example"
```

La variable se inyecta automáticamente durante `npm run build` y el helper
`apiFetch` añade el prefijo cuando la app corre dentro del APK. No olvides
reconstruir (`npm run build && npx cap sync`) cada vez que la cambies.

## 📞 Soporte Adicional

- Documentación de Capacitor: https://capacitorjs.com/docs/android
- Android Developer Docs: https://developer.android.com/
- Gradle Documentation: https://gradle.org/

---

**Nota**: La primera vez que ejecutes los comandos de gradle, descargará todas las dependencias. Esto puede tomar varios minutos.
