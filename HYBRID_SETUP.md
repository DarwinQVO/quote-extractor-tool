# 🏗️ Hybrid Architecture - Local Processing + Cloud UI

## ¿Qué es esto?

Un sistema **híbrido** que resuelve el problema de IP restrictions de YouTube:

- **🌐 Cloud (Railway)**: Frontend, UI, database, metadata
- **🏠 Local**: Audio extraction + transcripción (yt-dlp + Whisper)
- **👤 Usuario**: Experiencia transparente, no nota diferencia

## ¿Por qué?

YouTube bloquea IPs de servidores cloud para yt-dlp, pero **tu IP doméstica funciona perfecto**.

## Instalación (5 minutos)

### 1. Instalar Local Processor

```bash
cd local-processor
./setup.sh
```

### 2. Configurar OpenAI API Key

```bash
export OPENAI_API_KEY="sk-tu-api-key-aqui"
```

### 3. Iniciar Local Processor

```bash
npm start
```

Verás:
```
🏠 LOCAL AUDIO PROCESSOR running on http://localhost:3001
🔗 Ready to process videos for Railway app
```

## Uso

1. **Ve a tu app Railway**: https://quote-extractor-tool-production.up.railway.app
2. **Añade videos normalmente** - el sistema detecta automáticamente si tienes local processor
3. **Si local está disponible**: Usa tu IP doméstica (sin restricciones)
4. **Si local no está**: Fallback a cloud processing

## Indicadores

- **🏠 "Local Processing"**: Usando tu IP doméstica
- **☁️ "Cloud Processing"**: Usando Railway servers
- **🔄 "Processing..."**: El sistema está trabajando

## Beneficios

✅ **Evita IP blocks** - yt-dlp usa tu IP doméstica
✅ **Cloud benefits** - UI y database en Railway
✅ **Transparente** - Usuario no nota diferencia  
✅ **Fallback automático** - Si local no disponible, usa cloud
✅ **Performance** - Audio processing local es más rápido
✅ **Confiable** - yt-dlp funciona 100% en local

## Arquitectura

```
[Usuario Web] → [Railway Frontend] ←→ [Local Processor] 
      ↓                ↓                      ↓
  [Añade video]   [UI + Database]     [yt-dlp + Whisper]
      ↓                ↓                      ↓
  [Ve transcript] [Almacena datos]    [Procesa en local]
```

## Estado del Sistema

- **✅ Local + Cloud**: Funcionalidad completa, sin restricciones
- **⚠️ Solo Cloud**: Funcional pero con posibles IP blocks de YouTube
- **❌ Sin APIs**: Fallback a transcripts demo

## Troubleshooting

### Local processor no inicia
```bash
# Verificar dependencias
node --version  # Debe ser 18+
yt-dlp --version
ffmpeg -version

# Reinstalar
cd local-processor
./setup.sh
```

### Railway no detecta local
- Verificar que local processor esté en puerto 3001
- Verificar que no haya firewall bloqueando
- Ver logs en Railway para debugging

## Para Desarrolladores

### Local Processor API

- `GET /health` - Health check
- `POST /process-video` - Process video locally

### Railway Integration

- Auto-detección de local processor
- Fallback automático a cloud
- `/api/local-transcript` - Receive transcripts from local

Este sistema te da **lo mejor de ambos mundos**: tu IP doméstica para yt-dlp + la infraestructura cloud de Railway.