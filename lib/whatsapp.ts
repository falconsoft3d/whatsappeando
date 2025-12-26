import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
  Contact,
  Chat,
  WAMessage,
  proto
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { prisma } from './prisma';

// Ruta para guardar las sesiones (usar /tmp en producción/Vercel)
const BASE_AUTH_DIR = (process.env.NODE_ENV === 'production' || process.env.VERCEL)
  ? path.join(os.tmpdir(), 'auth_sessions')
  : path.join(process.cwd(), 'auth_sessions');

// Asegurar que el directorio base existe
if (!fs.existsSync(BASE_AUTH_DIR)) {
  try {
    fs.mkdirSync(BASE_AUTH_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating BASE_AUTH_DIR:', err);
  }
}

// Implementación local de makeInMemoryStore para Baileys v7
function makeInMemoryStore(config: { logger?: any }) {
  const chats: { [id: string]: Chat } = {};
  const contacts: { [id: string]: Contact } = {};
  const messages: { [jid: string]: any[] } = {};

  return {
    chats,
    contacts,
    messages,
    bind: (ev: any) => {
      ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest }: any) => {
        if (isLatest) {
          Object.keys(chats).forEach(id => delete chats[id]);
          Object.keys(contacts).forEach(id => delete contacts[id]);
          Object.keys(messages).forEach(id => delete messages[id]);
        }
        newChats?.forEach((chat: any) => {
          if (chat.id) chats[chat.id] = { ...(chats[chat.id] || {}), ...chat };
        });
        newContacts?.forEach((contact: any) => {
          if (contact.id) contacts[contact.id] = { ...(contacts[contact.id] || {}), ...contact };
        });
        newMessages?.forEach((msg: any) => {
          const jid = msg.key.remoteJid;
          if (jid) {
            if (!messages[jid]) messages[jid] = [];
            const exists = messages[jid].find(m => m.key.id === msg.key.id);
            if (!exists) {
              messages[jid].push(msg);
            }
          }
        });
        console.log(`📜 History set: ${newChats?.length || 0} chats, ${newContacts?.length || 0} contacts, ${newMessages?.length || 0} messages`);
      });

      ev.on('chats.set', ({ chats: newChats }: any) => {
        newChats?.forEach((chat: any) => {
          if (chat.id) chats[chat.id] = { ...(chats[chat.id] || {}), ...chat };
        });
        console.log(`📜 Chats set: ${newChats?.length || 0} chats`);
      });

      ev.on('contacts.set', ({ contacts: newContacts }: any) => {
        newContacts?.forEach((contact: any) => {
          if (contact.id) contacts[contact.id] = { ...(contacts[contact.id] || {}), ...contact };
        });
        console.log(`📜 Contacts set: ${newContacts?.length || 0} contacts`);
      });

      ev.on('chats.upsert', (newChats: Chat[]) => {
        newChats.forEach(chat => {
          if (chat.id) chats[chat.id] = { ...(chats[chat.id] || {}), ...chat };
        });
      });
      ev.on('chats.update', (updates: any[]) => {
        updates.forEach(update => {
          if (update.id && chats[update.id]) {
            chats[update.id] = { ...chats[update.id], ...update };
          }
        });
      });
      ev.on('contacts.upsert', (newContacts: Contact[]) => {
        newContacts.forEach(contact => {
          if (contact.id) contacts[contact.id] = { ...(contacts[contact.id] || {}), ...contact };
        });
      });
      ev.on('contacts.update', (updates: any[]) => {
        updates.forEach(update => {
          if (update.id && contacts[update.id]) {
            contacts[update.id] = { ...contacts[update.id], ...update };
          }
        });
      });
      ev.on('messages.upsert', ({ messages: newMessages, type }: any) => {
        if (type === 'append' || type === 'notify') {
          newMessages.forEach((msg: any) => {
            const jid = msg.key.remoteJid;
            if (jid) {
              if (!messages[jid]) messages[jid] = [];
              const exists = messages[jid].find(m => m.key.id === msg.key.id);
              if (!exists) {
                messages[jid].push(msg);
                messages[jid].sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));
                if (messages[jid].length > 100) messages[jid].shift();
              }
            }
          });
        }
      });
    },
    loadMessages: async (jid: string, count: number) => {
      return (messages[jid] || []).slice(-count);
    },
    writeToFile: (path: string) => { },
    readFromFile: (path: string) => { }
  };
}
export interface MediaAttachment {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  filename?: string;
  mimetype?: string;
}


interface WhatsAppSession {
  id: string;
  socket: WASocket | null;
  qr: string | null;
  status: 'pending' | 'connected' | 'disconnected' | 'error';
  phoneNumber?: string;
  timestamp: number;
  retryCount?: number;
  error?: string;
  contacts?: Contact[];
  chats?: Chat[];
  messageHandlers?: Set<(message: any) => void>;
  store?: ReturnType<typeof makeInMemoryStore>;
  webhookUrl?: string;
  apiToken?: string;
  apiEnabled?: boolean;
}

const globalForSessions = global as typeof globalThis & {
  whatsappSessions?: Map<string, WhatsAppSession>,
  webhookLogs?: any[]
}

const sessions = globalForSessions.whatsappSessions ?? new Map<string, WhatsAppSession>();
const webhookLogs = globalForSessions.webhookLogs ?? [];

if (process.env.NODE_ENV !== 'production') {
  globalForSessions.whatsappSessions = sessions;
  globalForSessions.webhookLogs = webhookLogs;
}

const MAX_RETRY_COUNT = 3;

// Log al inicializar el módulo
console.log('🚀 Módulo whatsapp.ts inicializado. Sesiones:', sessions.size);

export async function generateQR(sessionId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Inicializar sesión ANTES de crear el socket
      const initialSession: WhatsAppSession = {
        id: sessionId,
        socket: null,
        qr: null,
        status: 'pending',
        timestamp: Date.now(),
        retryCount: 0
      };
      sessions.set(sessionId, initialSession);
      console.log('📝 Sesión inicializada:', sessionId, 'Total sesiones:', sessions.size);

      // Obtener la última versión de Baileys
      const { version } = await fetchLatestBaileysVersion();

      // Crear store para almacenar contactos, chats y mensajes
      const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

      // Ruta absoluta para auth_sessions
      const authDir = path.join(BASE_AUTH_DIR, sessionId);
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'error' }), // Solo errores
        browser: ['Whatsappeando', 'Desktop', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      // Vincular el store al socket
      store.bind(sock.ev);

      sock.ev.on('creds.update', saveCreds);

      // Listener para mensajes nuevos
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
          for (const message of messages) {
            const formattedMessage = {
              id: message.key.id,
              from: message.key.remoteJid,
              fromMe: message.key.fromMe,
              text: message.message?.conversation ||
                message.message?.extendedTextMessage?.text ||
                '[Media]',
              timestamp: message.messageTimestamp,
              pushName: message.pushName
            };

            console.log('📨 Nuevo mensaje:', formattedMessage);
            notifyMessageHandlers(sessionId, formattedMessage);
          }
        }
      });

      sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        console.log('Connection update:', { connection, hasQR: !!qr });

        if (qr) {
          // Generar QR como imagen
          const qrCodeDataURL = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });

          console.log('QR generado para sesión:', sessionId);

          const session = sessions.get(sessionId);
          if (session) {
            session.qr = qrCodeDataURL;
            session.socket = sock;
            session.store = store;
            sessions.set(sessionId, session);
          } else {
            sessions.set(sessionId, {
              id: sessionId,
              socket: sock,
              qr: qrCodeDataURL,
              status: 'pending',
              timestamp: Date.now(),
              store
            });
          }

          // Resolver la promesa con el QR
          resolve(qrCodeDataURL);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log('Conexión cerrada:', {
            statusCode,
            shouldReconnect,
            reason: DisconnectReason[statusCode as unknown as keyof typeof DisconnectReason] || 'Unknown',
            error: lastDisconnect?.error?.message
          });

          const session = sessions.get(sessionId);
          if (!session) return;

          // Cerrar el socket anterior
          if (session.socket) {
            try {
              session.socket.end(undefined);
            } catch (e) {
              console.log('Error cerrando socket:', e);
            }
          }

          if (statusCode === DisconnectReason.loggedOut) {
            // Sesión cerrada permanentemente
            console.log('❌ Sesión cerrada permanentemente - limpiando');
            session.status = 'error';
            session.error = 'Sesión cerrada. Genera un nuevo QR.';
            sessions.set(sessionId, session);
            return;
          }

          // Errores que requieren reconexión
          if (statusCode === DisconnectReason.restartRequired ||
            statusCode === 515) {
            console.log('⚠️ Reinicio requerido - Reconectando automáticamente...');

            const retryCount = (session.retryCount || 0) + 1;

            if (retryCount <= MAX_RETRY_COUNT) {
              session.retryCount = retryCount;
              session.status = 'pending';
              session.error = undefined;
              sessions.set(sessionId, session);

              // Esperar 2 segundos antes de reconectar
              setTimeout(async () => {
                try {
                  console.log(`🔄 Reintento ${retryCount}/${MAX_RETRY_COUNT} para sesión ${sessionId}`);
                  await reconnectSession(sessionId);
                } catch (error) {
                  console.error('Error en reconexión:', error);
                }
              }, 2000);
            } else {
              console.log('❌ Máximo de reintentos alcanzado');
              session.status = 'error';
              session.error = 'No se pudo conectar. Por favor, genera un nuevo QR.';
              sessions.set(sessionId, session);
            }
          } else if (statusCode === DisconnectReason.connectionClosed ||
            statusCode === DisconnectReason.connectionLost ||
            statusCode === DisconnectReason.timedOut) {
            console.log('⚠️ Error de conexión temporal - Marcando como desconectado');
            session.status = 'disconnected';
            session.error = 'Conexión perdida';
            sessions.set(sessionId, session);
          } else {
            session.status = 'disconnected';
            sessions.set(sessionId, session);
          }
        } else if (connection === 'open') {
          const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id;
          console.log('✅ Conectado exitosamente:', phoneNumber);
          const currentSession = sessions.get(sessionId);
          console.log('📍 Sesión encontrada en conexión inicial:', !!currentSession, 'SessionId:', sessionId);
          if (currentSession) {
            currentSession.status = 'connected';
            currentSession.phoneNumber = phoneNumber;
            currentSession.retryCount = 0;
            currentSession.error = undefined;
            currentSession.socket = sock;
            currentSession.store = store;
            sessions.set(sessionId, currentSession);
            console.log('💾 Sesión actualizada a connected (inicial):', sessionId);

            // Cargar contactos y chats después de conectar
            setTimeout(() => {
              syncContactsAndChats(sessionId);
            }, 2000);
          }
        }
      });

      // Timeout de 120 segundos para generar QR
      setTimeout(() => {
        const session = sessions.get(sessionId);
        if (!session?.qr) {
          reject(new Error('Timeout esperando QR'));
        }
      }, 120000);

    } catch (error) {
      console.error('Error generating QR:', error);
      reject(error);
    }
  });
}

export function getSession(sessionId: string): WhatsAppSession | undefined {
  const session = sessions.get(sessionId);
  console.log('🔍 getSession llamado:', sessionId, 'Encontrado:', !!session, 'Total sesiones:', sessions.size);
  return session;
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
    // Si se conecta exitosamente, resetear contadores de error
    if (status === 'connected') {
      session.retryCount = 0;
      session.error = undefined;
    }
    sessions.set(sessionId, session);
  }
}

export function disconnectSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session?.socket) {
    session.socket.end(undefined);
  }
  sessions.delete(sessionId);
}

// Eliminar sesión completa (memoria + disco)
export function deleteSession(sessionId: string): void {
  disconnectSession(sessionId);
  try {
    const authDir = path.join(BASE_AUTH_DIR, sessionId);
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('🗑️ Directorio de sesión eliminado:', authDir);
    }
  } catch (err) {
    console.error('❌ Error al eliminar directorio de sesión:', err);
  }
}

export async function reconnectSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    console.log('Sesión no encontrada para reconectar:', sessionId);
    return;
  }

  try {
    const { version } = await fetchLatestBaileysVersion();

    // Crear nuevo store para la reconexión
    const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

    const authDir = path.join(BASE_AUTH_DIR, sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'error' }),
      browser: ['Whatsappeando', 'Desktop', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000
    });

    // Vincular el store al socket
    store.bind(sock.ev);

    // Actualizar el socket y store en la sesión
    session.socket = sock;
    session.store = store;
    sessions.set(sessionId, session);

    sock.ev.on('creds.update', saveCreds);

    // Listener para mensajes nuevos en reconexión
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const message of messages) {
          const formattedMessage = {
            id: message.key.id,
            from: message.key.remoteJid,
            fromMe: message.key.fromMe,
            text: message.message?.conversation ||
              message.message?.extendedTextMessage?.text ||
              '[Media]',
            timestamp: message.messageTimestamp,
            pushName: message.pushName
          };

          console.log('📨 Nuevo mensaje (reconexión):', formattedMessage);
          notifyMessageHandlers(sessionId, formattedMessage);
        }
      }
    });

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect } = update;

      console.log('Reconexión - Connection update:', { connection, sessionId });

      if (connection === 'open') {
        const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id;
        console.log('✅ Reconexión exitosa:', phoneNumber);
        const currentSession = sessions.get(sessionId);
        console.log('📍 Sesión encontrada en reconexión:', !!currentSession, 'SessionId:', sessionId);
        if (currentSession) {
          currentSession.status = 'connected';
          currentSession.phoneNumber = phoneNumber;
          currentSession.retryCount = 0;
          currentSession.error = undefined;
          currentSession.socket = sock;
          currentSession.store = store;
          sessions.set(sessionId, currentSession);
          console.log('💾 Sesión actualizada a connected:', sessionId);

          // Cargar contactos y chats después de reconectar
          setTimeout(() => {
            syncContactsAndChats(sessionId);
          }, 2000);
        } else {
          console.error('❌ No se encontró sesión para actualizar:', sessionId);
        }
      } else if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        console.log('Reconexión fallida:', { statusCode, sessionId });

        const currentSession = sessions.get(sessionId);
        if (currentSession) {
          currentSession.status = 'error';
          currentSession.error = 'No se pudo reconectar';
          sessions.set(sessionId, currentSession);
        }
      }
    });

  } catch (error) {
    console.error('Error en reconexión:', error);
    const currentSession = sessions.get(sessionId);
    if (currentSession) {
      currentSession.status = 'error';
      currentSession.error = 'Error al reconectar';
      sessions.set(sessionId, currentSession);
    }
  }
}

// Asegurar que una sesión esté en memoria y conectada
async function ensureSession(sessionId: string): Promise<WhatsAppSession> {
  let session = sessions.get(sessionId);
  if (!session) {
    console.log('🔍 Sesión no encontrada en memoria, buscando en DB:', sessionId);
    const account = await prisma.whatsAppAccount.findUnique({
      where: { sessionId }
    }) as any;

    if (account && account.sessionId) {
      console.log('🔄 Intentando restaurar sesión desde archivos:', sessionId);
      const newSession: WhatsAppSession = {
        id: sessionId,
        socket: null,
        qr: null,
        status: 'pending',
        timestamp: Date.now(),
        apiEnabled: account.apiEnabled,
        apiToken: account.apiToken,
        webhookUrl: account.webhookUrl
      };
      sessions.set(sessionId, newSession);
      await reconnectSession(sessionId);

      // Esperar hasta 10 segundos a que conecte
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const s = sessions.get(sessionId);
        if (s?.status === 'connected' && s.socket) {
          return s;
        }
      }
      session = sessions.get(sessionId);
    }
  }

  if (!session) {
    throw new Error('Sesión no encontrada o no vinculada');
  }

  if (!session.socket || session.status !== 'connected') {
    // Si la sesión está en memoria pero no conectada, intentar reconectar y esperar un poco
    if (session.status !== 'pending') {
      await reconnectSession(sessionId);
    }

    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const s = sessions.get(sessionId);
      if (s?.status === 'connected' && s.socket) return s;
    }

    throw new Error(`Sesión no conectada (Estado: ${session.status})`);
  }

  return session;
}

export async function sendMessage(
  sessionId: string,
  to: string,
  message?: string,
  media?: MediaAttachment
): Promise<boolean> {
  console.log('📤 Intentando enviar mensaje:', {
    sessionId,
    to,
    hasMessage: !!message,
    hasMedia: !!media
  });

  const session = await ensureSession(sessionId);

  if (!session.socket) {
    console.error('❌ Socket no disponible para sesión:', sessionId);
    throw new Error('Socket no disponible');
  }

  if (session.status !== 'connected') {
    console.error('❌ Sesión no conectada. Estado:', session.status);
    throw new Error(`Sesión no conectada. Estado: ${session.status}`);
  }

  try {
    // Formatear número de teléfono
    let jid = to;
    if (!jid.includes('@')) {
      const cleanNumber = to.replace(/\D/g, '');
      // Baileys usa @g.us para grupos y @s.whatsapp.net para individuos
      // Si el número es largo y no parece un teléfono normal, podría ser un ID de grupo
      // Pero usualmente los números de teléfono son < 15 dígitos
      jid = cleanNumber.length > 15 ? `${cleanNumber}@g.us` : `${cleanNumber}@s.whatsapp.net`;
    }

    console.log('📱 Enviando a JID:', jid);

    if (media) {
      const content: any = { caption: message || media.caption };

      switch (media.type) {
        case 'image':
          content.image = { url: media.url };
          break;
        case 'video':
          content.video = { url: media.url };
          break;
        case 'audio':
          content.audio = { url: media.url };
          content.mimetype = media.mimetype || 'audio/mp4';
          content.ptt = false; // true if it should be a voice note
          break;
        case 'document':
          content.document = { url: media.url };
          content.fileName = media.filename || 'document';
          content.mimetype = media.mimetype || 'application/pdf';
          break;
        default:
          throw new Error('Tipo de media no soportado: ' + media.type);
      }

      await session.socket.sendMessage(jid, content);
    } else {
      if (!message) throw new Error('Debe proporcionar un mensaje o un archivo adjunto');
      await session.socket.sendMessage(jid, { text: message });
    }

    console.log('✅ Mensaje enviado exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

// Sincronizar contactos y chats desde WhatsApp
async function syncContactsAndChats(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);

  if (!session?.socket || !session.store || session.status !== 'connected') {
    console.log('⚠️ No se pueden sincronizar: sesión no lista');
    return;
  }

  try {
    console.log('🔄 Sincronizando contactos y chats para sesión:', sessionId);

    // Los contactos y chats se sincronizan automáticamente a través del store
    // que está vinculado al socket mediante store.bind(sock.ev)

    // Esperar un momento para que se carguen
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Obtener y guardar contactos del store
    if (session.store.contacts) {
      const contactsObj = session.store.contacts;
      const contactsList = Object.keys(contactsObj).map(id => ({
        ...contactsObj[id],
        id,
        name: contactsObj[id]?.name || contactsObj[id]?.notify || id.split('@')[0]
      }));
      if (contactsList.length > 0) {
        session.contacts = contactsList as Contact[];
        console.log(`✅ ${contactsList.length} contactos persistidos en sesión ${sessionId}`);
      }
    }

    // Obtener y guardar chats del store
    if (session.store.chats) {
      const chatsObj = session.store.chats;
      const chatsList = Object.values(chatsObj) as Chat[];
      if (chatsList.length > 0) {
        session.chats = chatsList;
        console.log(`✅ ${chatsList.length} chats persistidos en sesión ${sessionId}`);
      }
    }

    sessions.set(sessionId, session);
  } catch (error) {
    console.error('Error sincronizando contactos y chats:', error);
  }
}

// Obtener contactos de una sesión
export async function getContacts(sessionId: string): Promise<Contact[]> {
  const session = await ensureSession(sessionId);

  try {
    // Si ya tenemos contactos en caché, devolverlos
    if (session.contacts && session.contacts.length > 0) {
      return session.contacts;
    }

    // Si está recién conectado, esperar un poco para que el store se llene
    if (!session.store || Object.keys(session.store.contacts).length === 0) {
      console.log('⏳ Esperando sincronización inicial de contactos...');
      await new Promise(r => setTimeout(r, 2000));
    }

    // Intentar cargar desde el store
    if (session.store?.contacts) {
      const contactsObj = session.store.contacts;
      const contactsList = Object.keys(contactsObj).map(id => ({
        ...contactsObj[id],
        id,
        name: contactsObj[id]?.name || contactsObj[id]?.notify || id.split('@')[0]
      }));
      session.contacts = contactsList as Contact[];
      sessions.set(sessionId, session);
      return contactsList as Contact[];
    }

    return session.contacts || [];
  } catch (error) {
    console.error('Error getting contacts:', error);
    return session.contacts || [];
  }
}

// Obtener chats de una sesión
export async function getChats(sessionId: string): Promise<any[]> {
  const session = await ensureSession(sessionId);

  try {
    // Si está recién conectado, esperar un poco para que el store se llene
    if (!session.store || Object.keys(session.store.chats).length === 0) {
      console.log('⏳ Esperando sincronización inicial de chats...');
      await new Promise(r => setTimeout(r, 2000));
    }

    // Obtener chats del store
    const chats = session.store?.chats;
    if (chats) {
      const chatList = Object.values(chats);
      const formattedChats = chatList.map((chat: any) => {
        const timestamp = chat.conversationTimestamp || chat.lastMessageRecievedAntigravityTimestamp || 0;
        return {
          id: chat.id,
          name: chat.name || chat.id.split('@')[0],
          lastMessage: timestamp,
          unreadCount: chat.unreadCount || 0,
          timestamp: typeof timestamp === 'number' ? timestamp : Number(timestamp)
        };
      });
      return formattedChats.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    return [];
  } catch (error) {
    console.error('Error getting chats:', error);
    return [];
  }
}

// Obtener mensajes de un chat específico
export async function getChatMessages(
  sessionId: string,
  chatId: string,
  limit: number = 50
): Promise<any[]> {
  const session = await ensureSession(sessionId);

  try {
    const messages = await session.store?.loadMessages(chatId, limit);
    if (messages) {
      return messages.map((msg: any) => ({
        id: msg.key.id,
        fromMe: msg.key.fromMe,
        text: msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.conversation ||
          '[Media]',
        timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : Number(msg.messageTimestamp || 0),
        status: msg.status
      }));
    }
    return [];
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
}

// Suscribirse a mensajes nuevos
export function subscribeToMessages(
  sessionId: string,
  callback: (message: any) => void
): () => void {
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error('Sesión no encontrada');
  }

  if (!session.messageHandlers) {
    session.messageHandlers = new Set();
  }

  session.messageHandlers.add(callback);

  // Retornar función para cancelar suscripción
  return () => {
    session.messageHandlers?.delete(callback);
  };
}

// Función interna para notificar a los handlers de mensajes e iniciar webhooks
async function notifyMessageHandlers(sessionId: string, message: any) {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Notificar a los suscriptores internos (UI del Chat)
  if (session.messageHandlers) {
    session.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error en message handler:', error);
      }
    });
  }

  // Si no tenemos la configuración API en la sesión, intentar buscarla en la DB
  if (session.apiEnabled === undefined) {
    try {
      const account = await prisma.whatsAppAccount.findUnique({
        where: { sessionId }
      }) as any;
      if (account) {
        session.apiEnabled = account.apiEnabled;
        session.webhookUrl = account.webhookUrl || undefined;
        session.apiToken = account.apiToken || undefined;
        sessions.set(sessionId, session);
      }
    } catch (e) {
      console.error('Error fetching API settings:', e);
    }
  }

  // Enviar al webhook si está configurado y la API está activa
  if (session.apiEnabled && session.webhookUrl) {
    const payload = {
      sessionId,
      event: 'message.received',
      data: message,
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`🔗 Enviando mensaje a webhook: ${session.webhookUrl}`);
      const response = await fetch(session.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session.apiToken ? `Bearer ${session.apiToken}` : ''
        },
        body: JSON.stringify(payload)
      });

      const logEntry = {
        id: Date.now() + Math.random(),
        url: session.webhookUrl,
        payload,
        status: response.status,
        statusText: response.statusText,
        timestamp: new Date().toISOString(),
        success: response.ok
      };

      webhookLogs.unshift(logEntry);
      if (webhookLogs.length > 20) webhookLogs.pop();

    } catch (error) {
      console.error('Error enviando a webhook:', error);
      const logEntry = {
        id: Date.now() + Math.random(),
        url: session.webhookUrl,
        payload,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        success: false
      };
      webhookLogs.unshift(logEntry);
      if (webhookLogs.length > 20) webhookLogs.pop();
    }
  }
}

// Exportar logs para la API
export function getWebhookLogs() {
  return webhookLogs;
}

// Actualizar configuración de una sesión activa
export function updateSessionConfig(sessionId: string, config: { webhookUrl?: string, apiToken?: string, apiEnabled?: boolean }) {
  const session = sessions.get(sessionId);
  if (session) {
    if (config.webhookUrl !== undefined) session.webhookUrl = config.webhookUrl;
    if (config.apiToken !== undefined) session.apiToken = config.apiToken;
    if (config.apiEnabled !== undefined) session.apiEnabled = config.apiEnabled;
    sessions.set(sessionId, session);
    console.log(`⚙️ Configuración actualizada para sesión activa: ${sessionId}`);
  }
}
