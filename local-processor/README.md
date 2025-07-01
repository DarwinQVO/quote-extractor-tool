# Local Audio Processor - Hybrid Architecture

## Concepto
- **Cloud**: Frontend, database, metadata, UI (Railway)
- **Local**: Audio extraction + transcripción (yt-dlp + Whisper)
- **Usuario**: Experiencia transparente, no sabe que es híbrido

## Arquitectura

```
[Usuario] → [Frontend/Railway] → [Local Agent] → [Railway Database]
                ↑                      ↓
          [UI + Metadata]        [yt-dlp + Whisper]
```

## Flujo de Trabajo

1. **Usuario añade video** → Railway frontend
2. **Railway llama a local agent** → WebSocket/HTTP
3. **Local agent descarga audio** → yt-dlp (IP doméstica)
4. **Local agent transcribe** → OpenAI Whisper
5. **Local agent envía transcript** → Railway database
6. **Frontend muestra resultado** → Usuario ve transcript

## Implementación

### Local Agent (Node.js)
- Servidor local en puerto fijo (ej: 3001)
- API endpoints para audio processing
- WebSocket para progress updates
- Auto-start con el sistema

### Railway Integration
- Detecta si local agent está disponible
- Fallback a cloud processing si no hay local
- UI indica método usado (opcional)

## Beneficios

✅ **Evita IP blocks** - yt-dlp corre en IP doméstica
✅ **Cloud benefits** - UI, database, metadata en Railway  
✅ **Transparente** - Usuario no nota diferencia
✅ **Fallback** - Si local no disponible, usa cloud
✅ **Performance** - Audio processing local es más rápido