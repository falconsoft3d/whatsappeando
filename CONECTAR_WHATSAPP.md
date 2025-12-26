# Cómo Conectar WhatsApp

## Paso a paso para conectar correctamente:

### 1. Preparar WhatsApp en tu teléfono
- **IMPORTANTE**: Asegúrate de tener WhatsApp actualizado a la última versión
- Debes tener WhatsApp Multi-Device habilitado

### 2. Generar el QR
1. Ve a `/dashboard/accounts`
2. Haz clic en "Agregar Cuenta"
3. Rellena los datos
4. Haz clic en "Conectar"
5. Espera a que aparezca el código QR

### 3. Escanear RÁPIDO (importante)
**El QR expira en aproximadamente 20-30 segundos**

1. Abre WhatsApp en tu móvil
2. Ve a: 
   - **Android**: Menú (3 puntos) > Dispositivos vinculados > Vincular un dispositivo
   - **iOS**: Configuración > Dispositivos vinculados > Vincular un dispositivo
3. **Escanea INMEDIATAMENTE** el código QR
4. Espera a que diga "¡Conectado exitosamente!"

### 4. Problemas comunes

#### "QR refs attempts ended"
- **Causa**: El QR expiró sin ser escaneado
- **Solución**: Cierra el modal y vuelve a hacer clic en "Conectar"

#### "Stream Errored (restart required)"
- **Causa**: Error temporal de conexión
- **Solución**: Cierra el modal y vuelve a intentar

#### El QR no se escanea
- Verifica que tu WhatsApp esté actualizado
- Asegúrate de tener Multi-Device habilitado
- Prueba con mejor conexión a internet
- Cierra y abre WhatsApp si es necesario

### 5. Tips para éxito
- ✅ Ten WhatsApp abierto antes de generar el QR
- ✅ Escanea en menos de 20 segundos
- ✅ Mantén buena conexión en ambos dispositivos
- ✅ Si falla, intenta de nuevo (es normal en la primera vez)

### 6. Una vez conectado
- La cuenta aparecerá como "Conectado" en verde
- Las credenciales se guardan en `auth_sessions/`
- No necesitarás volver a escanear el QR
- La sesión persiste entre reinicios del servidor

## Notas técnicas

### Qué pasa cuando conectas:
1. Se crea un socket WebSocket con WhatsApp
2. Se genera un QR único para tu sesión
3. Al escanear, WhatsApp envía credenciales
4. Las credenciales se guardan localmente
5. La conexión se mantiene activa

### Archivos importantes:
- `lib/whatsapp.ts` - Lógica de conexión
- `auth_sessions/` - Credenciales guardadas (NO subir a git)
- `app/dashboard/accounts/page.tsx` - UI de cuentas

### Para desarrolladores:
```typescript
// Ver logs en la terminal del servidor
// Los mensajes de "Connection update" y "Conexión cerrada" te ayudan a debug

// Para limpiar una sesión:
rm -rf auth_sessions/[sessionId]

// Para limpiar todas las sesiones:
rm -rf auth_sessions/*
```
