# YouTube Audio Transcription Microservice

Micro-servicio CLI que streamea audio de YouTube con yt-dlp, lo re-muestrea con ffmpeg y lo transcribe con whisper.cpp **sin escribir nada en disco**. Todo funciona detrás de un proxy residencial BrickData.

## Variables de Entorno

Configura estas variables en Railway:

```ini
PROXY_HOST=bricks.mx.smartproxy.com
PROXY_PORT=10000
PROXY_USER=TU_USER
PROXY_PASS=TU_PASS
VIDEO_ID=dQw4w9WgXcQ

# Opcional: Modelo de Whisper (por defecto: large-v3)
WHISPER_MODEL_SIZE=medium  # Para sistemas con <3GB RAM
```

## Ejecución Local

```bash
# Configurar variables de entorno y ejecutar
PROXY_HOST=bricks.mx.smartproxy.com \
PROXY_PORT=10000 \
PROXY_USER=tu_usuario \
PROXY_PASS=tu_password \
python main.py dQw4w9WgXcQ
```

## Despliegue en Railway

1. Conecta este repositorio a Railway
2. Configura las variables de entorno en el dashboard
3. Railway ejecutará automáticamente con el `VIDEO_ID` especificado

## Características

- ✅ **Sin disco**: Todo el pipeline funciona en RAM
- ✅ **Proxy residencial**: BrickData para evitar bloqueos de IP
- ✅ **Retry infinito**: yt-dlp con reintentos automáticos
- ✅ **Streaming**: Audio se procesa mientras se descarga
- ✅ **Whisper.cpp**: Transcripción de alta calidad
- ✅ **Fallback inteligente**: Cambia a modelo medium si large falla

## Pipeline

```
YouTube → yt-dlp (proxy) → ffmpeg (resample) → whisper.cpp → transcript
```

## Modelos Whisper

- `large-v3`: Máxima calidad (recomendado para >3GB RAM)
- `medium`: Balance calidad/velocidad (recomendado para <3GB RAM)
- `small`: Más rápido pero menor calidad

## Ejemplo de Salida

```
🚀 Starting transcription for video: dQw4w9WgXcQ
🌐 Using BrickData proxy: bricks.mx.smartproxy.com:10000
🎯 Using Whisper model: large-v3
📡 Downloading audio stream via yt-dlp...
🔧 Resampling audio with ffmpeg...
📥 Reading resampled audio data...
✅ Audio pipeline complete. Received 4582912 bytes
🤖 Initializing Whisper model: large-v3
🎤 Transcribing audio with Whisper...
✅ Transcription completed successfully!
📝 Transcript:
--------------------------------------------------
[Contenido transcrito aquí]
--------------------------------------------------
```