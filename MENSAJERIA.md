# 📱 Módulo de Mensajería WhatsApp

## ✨ Características

- ✅ Envío de mensajes a números de WhatsApp
- ✅ Selección de cuenta conectada para enviar
- ✅ Historial de mensajes enviados
- ✅ Notificaciones de éxito/error
- ✅ Validación de formato de números
- ✅ Interfaz intuitiva y responsive

## 🚀 Uso

### 1. Acceder al Módulo de Mensajes

Navega a **Dashboard > Mensajes** o accede directamente a `/dashboard/messages`

### 2. Seleccionar Cuenta

- El sistema mostrará automáticamente todas las cuentas de WhatsApp conectadas
- Selecciona la cuenta desde la que quieres enviar el mensaje
- Solo aparecerán cuentas con estado "conectado"

### 3. Enviar un Mensaje

1. **Selecciona la cuenta** de envío (si tienes varias)
2. **Ingresa el número de destino** con código de país:
   - Formato correcto: `+51987654321`
   - Formato correcto: `+1234567890`
   - ❌ Sin código: `987654321` (se intentará agregar automáticamente)

3. **Escribe tu mensaje** en el área de texto
4. **Click en "Enviar Mensaje"**

### 4. Verificar Envío

- ✅ **Éxito**: Verás una notificación verde y el mensaje aparecerá en el historial
- ❌ **Error**: Verás una notificación roja con detalles del error

## 📋 Historial de Mensajes

El panel lateral muestra:
- Últimos mensajes enviados
- Número de destino
- Contenido del mensaje
- Fecha y hora de envío
- Estado (enviado ✓ o fallido ✗)

**Nota**: El historial se guarda en localStorage del navegador

## 🔧 API Endpoint

### POST `/api/whatsapp/send`

Envía un mensaje de WhatsApp.

**Request Body**:
```json
{
  "sessionId": "1766724897883-1766728726366",
  "phoneNumber": "+51987654321",
  "message": "Hola, este es un mensaje de prueba"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Mensaje enviado correctamente"
}
```

**Errores comunes**:
- `400`: Faltan parámetros requeridos
- `500`: Sesión no conectada o error al enviar

## 🐛 Solución de Problemas

### "Sesión no conectada"
- Verifica que la cuenta esté conectada en `/dashboard/accounts`
- Reconecta la cuenta escaneando el QR nuevamente

### "Error al enviar mensaje"
- Verifica que el número tenga el formato correcto
- Asegúrate de que el número existe en WhatsApp
- Revisa la conexión de internet

### "No hay cuentas conectadas"
- Ve a `/dashboard/accounts`
- Agrega y conecta una cuenta de WhatsApp primero

## 📝 Formato de Números

El sistema acepta varios formatos y los normaliza automáticamente:

| Formato de Entrada | Se Convierte a |
|-------------------|----------------|
| `+51987654321` | `51987654321@s.whatsapp.net` |
| `51987654321` | `51987654321@s.whatsapp.net` |
| `987654321` | `987654321@s.whatsapp.net` |

**Recomendación**: Siempre incluir el código de país con `+`

## 🔒 Seguridad

- Los mensajes se envían desde las sesiones autenticadas
- No se almacenan mensajes en la base de datos por defecto
- El historial es local al navegador del usuario

## 🎯 Próximas Mejoras

- [ ] Envío masivo de mensajes
- [ ] Plantillas de mensajes
- [ ] Programación de mensajes
- [ ] Estadísticas de envío
- [ ] Guardar historial en base de datos
- [ ] Envío de imágenes y archivos
- [ ] Lista de contactos
