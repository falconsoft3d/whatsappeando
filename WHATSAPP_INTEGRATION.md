# Integración de WhatsApp Real

El sistema actualmente usa códigos QR simulados. Para conectar con WhatsApp real, sigue estos pasos:

## Opción 1: Baileys (Recomendado)

### 1. Instalar Dependencias
```bash
npm install @whiskeysockets/baileys@latest
npm install pino
```

### 2. Crear Directorio de Autenticación
```bash
mkdir -p auth_sessions
```

### 3. Actualizar `lib/whatsapp.ts`

```typescript
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket 
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import pino from 'pino';

interface WhatsAppSession {
  id: string;
  socket: WASocket | null;
  qr: string | null;
  status: 'pending' | 'connected' | 'disconnected';
  phoneNumber?: string;
  timestamp: number;
}

const sessions = new Map<string, WhatsAppSession>();

export async function generateQR(sessionId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(`./auth_sessions/${sessionId}`);
      
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
      });

      sock.ev.on('creds.update', saveCreds);
      
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          // Generar QR como imagen
          const qrCodeDataURL = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2
          });
          
          const session = sessions.get(sessionId);
          if (session) {
            session.qr = qrCodeDataURL;
            session.socket = sock;
            sessions.set(sessionId, session);
          }
          
          resolve(qrCodeDataURL);
        }
        
        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          
          if (shouldReconnect) {
            // Reconectar
            await generateQR(sessionId);
          } else {
            updateSessionStatus(sessionId, 'disconnected');
          }
        } else if (connection === 'open') {
          const phoneNumber = sock.user?.id.split(':')[0];
          updateSessionStatus(sessionId, 'connected', phoneNumber);
        }
      });

      // Inicializar sesión
      sessions.set(sessionId, {
        id: sessionId,
        socket: sock,
        qr: null,
        status: 'pending',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error generating QR:', error);
      reject(error);
    }
  });
}

export function getSession(sessionId: string): WhatsAppSession | undefined {
  return sessions.get(sessionId);
}

export function updateSessionStatus(
  sessionId: string,
  status: WhatsAppSession['status'],
  phoneNumber?: string
): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = status;
    if (phoneNumber) {
      session.phoneNumber = phoneNumber;
    }
    sessions.set(sessionId, session);
  }
}

export async function sendMessage(
  sessionId: string,
  to: string,
  message: string
): Promise<boolean> {
  const session = sessions.get(sessionId);
  
  if (!session?.socket || session.status !== 'connected') {
    throw new Error('Sesión no conectada');
  }

  try {
    await session.socket.sendMessage(`${to}@s.whatsapp.net`, { text: message });
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

export function disconnectSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session?.socket) {
    session.socket.end(undefined);
  }
  sessions.delete(sessionId);
}
```

### 4. Actualizar `.gitignore`
```
auth_sessions/
```

### 5. Agregar Modelo a Prisma (Opcional)

```prisma
model WhatsAppSession {
  id          String   @id @default(uuid())
  userId      String
  sessionId   String   @unique
  phoneNumber String?
  credentials Json?
  status      String   @default("disconnected")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("whatsapp_sessions")
}
```

## Opción 2: whatsapp-web.js

⚠️ **Advertencia**: Requiere Puppeteer (pesado, ~300MB)

```bash
npm install whatsapp-web.js
```

Similar a Baileys pero más pesado. Usa la API de ejemplo en su documentación oficial.

## Funcionalidades Adicionales

Una vez integrado, podrás:

1. **Enviar mensajes individuales**
2. **Enviar mensajes masivos**
3. **Recibir mensajes**
4. **Gestionar grupos**
5. **Enviar multimedia**
6. **Obtener lista de contactos**

## Testing

Para probar la integración:

1. Ejecuta el servidor: `npm run dev`
2. Ve a `/dashboard/accounts`
3. Agrega una cuenta
4. Haz clic en "Conectar"
5. Escanea el QR con WhatsApp en tu móvil
6. ¡Listo! El estado cambiará a "Conectado"

## Troubleshooting

- **QR no aparece**: Verifica que Baileys esté correctamente instalado
- **Desconexión constante**: Guarda las credenciales en base de datos
- **Error de permisos**: El directorio `auth_sessions` debe tener permisos de escritura
- **Multi-device**: Asegúrate de usar WhatsApp Multi-Device (versión reciente)

## Recursos

- [Baileys Docs](https://github.com/WhiskeySockets/Baileys)
- [WhatsApp Web.js Docs](https://wwebjs.dev/)
- [WhatsApp Multi-Device](https://faq.whatsapp.com/1324084875005764)
