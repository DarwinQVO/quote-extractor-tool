# 🌐 BrickData Integration Setup

## Qué es BrickData

Tu quote-extractor-tool ahora tiene integración con **BrickData proxy residencial** para evitar bloqueos de IP de YouTube y obtener transcripciones más confiables.

## Cómo Funciona

```
YouTube Video → BrickData Proxy → yt-dlp → ffmpeg → whisper.cpp → Transcript
```

1. **Usuario añade video** en tu interfaz web normal
2. **Sistema detecta** configuración BrickData 
3. **Usa proxy residencial** para descargar audio
4. **Transcribe con Whisper** de alta calidad
5. **Muestra resultado** en tu UI existente

## Variables de Entorno en Railway

Añade estas variables en tu dashboard de Railway:

```ini
# BrickData Proxy Configuration
PROXY_HOST=bricks.mx.smartproxy.com
PROXY_PORT=10000
PROXY_USER=tu_usuario_brickdata
PROXY_PASS=tu_password_brickdata

# Optional: Whisper model size
WHISPER_MODEL_SIZE=medium  # Para Railway (menor RAM)
```

## Uso

1. **Configura variables** en Railway dashboard
2. **Redeploy** tu aplicación  
3. **Añade videos normalmente** en tu interfaz web
4. **El sistema automáticamente**:
   - ✅ **Si BrickData configurado**: Usa proxy residencial
   - ⚠️ **Si no configurado**: Fallback a métodos existentes

## Indicadores en la UI

- **🌐 "BrickData Processing"**: Usando proxy residencial
- **🏠 "Local Processing"**: Usando procesador local
- **☁️ "Cloud Processing"**: Métodos tradicionales

## Prioridad de Transcripción

1. **BrickData Proxy** (si configurado) ← **NUEVO**
2. **Local Processor** (si disponible)
3. **YouTube Transcript API** 
4. **AssemblyAI/OpenAI** (fallback)

## Beneficios BrickData

✅ **IP Residencial**: Evita bloqueos de YouTube  
✅ **Alta Confiabilidad**: yt-dlp funciona siempre  
✅ **Integración Transparente**: Misma UI, mejor backend  
✅ **Whisper.cpp**: Transcripción local de alta calidad  
✅ **Sin Cambios de UI**: Tu interfaz funciona igual  

## Estructura de Archivos

```
quote-extractor-tool/
├── transcription/           # ← NUEVO
│   ├── main.py             # Python microservice
│   └── requirements.txt    # Python dependencies
├── app/api/transcribe-brickdata/  # ← NUEVO
│   └── route.ts            # BrickData endpoint
├── app/api/video-processor/
│   └── route.ts            # Updated with BrickData priority
├── Dockerfile              # Updated: Node.js + Python support
└── [resto de tu app...]    # Sin cambios
```

## Testing

```bash
# Local testing (necesitas credenciales BrickData)
PROXY_HOST=bricks.mx.smartproxy.com \
PROXY_PORT=10000 \
PROXY_USER=tu_usuario \
PROXY_PASS=tu_password \
python transcription/main.py dQw4w9WgXcQ
```

## Troubleshooting

### "BrickData proxy not configured"
- Verifica variables `PROXY_*` en Railway
- Redeploy después de añadir variables

### "Transcription timeout"  
- Video muy largo (>10 min)
- Usa `WHISPER_MODEL_SIZE=small` para mayor velocidad

### "No transcript text extracted"
- Video sin audio o música instrumental
- Verifica credenciales BrickData

---

**Tu app ahora tiene transcripción enterprise-grade con IP residencial** 🚀