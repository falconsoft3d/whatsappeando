'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';

interface Account {
  id: number;
  name: string;
  phoneNumber: string;
  status: 'connected' | 'disconnected';
  sessionId?: string;
}

interface Chat {
  id: string;
  name: string;
  lastMessage?: number;
  unreadCount: number;
  timestamp?: number;
}

interface Contact {
  id: string;
  name: string;
  notify?: string;
  imgUrl?: string;
}

interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  status?: number;
}

function ChatContent() {
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('sessionId');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isPrivateMode, setIsPrivateMode] = useState(false);

  useEffect(() => {
    const checkPrivateMode = () => {
      setIsPrivateMode(localStorage.getItem('privateMode') === 'true');
    };
    checkPrivateMode();
    window.addEventListener('storage', checkPrivateMode);
    return () => window.removeEventListener('storage', checkPrivateMode);
  }, []);

  const maskText = (text: string) => {
    if (!isPrivateMode || !text) return text;
    // Si es un ID de WhatsApp (ej: 34662470645@s.whatsapp.net), ocultar la parte del número
    if (text.includes('@')) {
      return '********@wa.net';
    }
    return '********';
  };

  // Cargar cuentas conectadas
  useEffect(() => {
    const savedAccounts = localStorage.getItem('whatsappAccounts');
    if (savedAccounts) {
      try {
        const parsedAccounts = JSON.parse(savedAccounts);
        const connectedAccounts = parsedAccounts.filter(
          (acc: Account) => acc.status === 'connected' && acc.sessionId
        );
        setAccounts(connectedAccounts);

        if (connectedAccounts.length > 0) {
          // Si hay un sessionId en la URL, seleccionar esa cuenta
          if (sessionIdFromUrl) {
            const accountToSelect = connectedAccounts.find(
              (acc: Account) => acc.sessionId === sessionIdFromUrl
            );
            if (accountToSelect) {
              setSelectedAccount(accountToSelect);
            } else {
              setSelectedAccount(connectedAccounts[0]);
            }
          } else {
            setSelectedAccount(connectedAccounts[0]);
          }
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    }
  }, [sessionIdFromUrl]);

  // Cargar chats y contactos cuando se selecciona una cuenta
  useEffect(() => {
    if (selectedAccount?.sessionId) {
      loadChats(selectedAccount.sessionId);
      loadContacts(selectedAccount.sessionId);
    }
  }, [selectedAccount]);

  // Cargar mensajes cuando se selecciona un chat
  useEffect(() => {
    if (selectedAccount?.sessionId && selectedChat) {
      loadMessages(selectedAccount.sessionId, selectedChat.id);
    }
  }, [selectedChat, selectedAccount]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChats = async (sessionId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/whatsapp/chats/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats);
        // Seleccionar automáticamente el primer chat si no hay uno seleccionado
        if (data.chats.length > 0 && !selectedChat) {
          setSelectedChat(data.chats[0]);
        }
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/whatsapp/contacts/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadMessages = async (sessionId: string, chatId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/whatsapp/messages/${sessionId}/${encodeURIComponent(chatId)}`
      );
      if (response.ok) {
        const data = await response.json();
        const loadedMessages = data.messages.reverse();
        // Filtrar duplicados por ID
        const uniqueMessages = loadedMessages.filter((msg: any, index: number, self: any[]) =>
          index === self.findIndex((m) => m.id === msg.id)
        );
        setMessages(uniqueMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedAccount?.sessionId || !selectedChat) {
      return;
    }

    setSending(true);

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: selectedAccount.sessionId,
          phoneNumber: selectedChat.id,
          message: newMessage.trim(),
        }),
      });

      if (response.ok) {
        // El mensaje real llegará vía socket/actualización si está implementado,
        // pero por ahora lo dejamos como optimista. 
        // Si ya existe un mensaje con este ID (muy raro con Date.now), no lo agregamos.
        const sentMessage: Message = {
          id: `sent-${Date.now()}`,
          fromMe: true,
          text: newMessage.trim(),
          timestamp: Date.now() / 1000,
        };
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
      } else {
        const errorData = await response.json();
        Swal.fire({
          title: 'Error al enviar',
          text: errorData.error || 'Desconocido',
          icon: 'error',
          background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    const ts = typeof timestamp === 'number' ? timestamp : Number(timestamp);
    if (isNaN(ts)) return '';

    const date = new Date(ts * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.id.includes(searchQuery)
  );

  if (accounts.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-8">
        <div className="text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white">
            No hay cuentas conectadas
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Conecta una cuenta de WhatsApp para empezar a chatear
          </p>
          <a
            href="/dashboard/accounts"
            className="mt-6 inline-block rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700"
          >
            Conectar Cuenta
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar - Lista de chats */}
      <div className="w-[380px] flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10 shadow-lg">
        {/* Header del sidebar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Chats
            </h2>
            {accounts.length > 1 && (
              <select
                value={selectedAccount?.id || ''}
                onChange={(e) => {
                  const account = accounts.find(acc => acc.id === Number(e.target.value));
                  setSelectedAccount(account || null);
                  setSelectedChat(null);
                }}
                className="text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Buscador */}
          <div className="relative mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'chats' ? "Buscar chats..." : "Buscar contactos..."}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 pl-10 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'chats'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'contacts'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Contactos
            </button>
          </div>
        </div>

        {/* Lista de chats o contactos */}
        <div className="flex-1 overflow-y-auto">
          {loading && (activeTab === 'chats' ? chats.length === 0 : contacts.length === 0) ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
            </div>
          ) : activeTab === 'chats' ? (
            filteredChats.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No se encontraron chats' : 'No hay chats disponibles'}
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors ${selectedChat?.id === chat.id ? 'bg-gray-50 dark:bg-gray-700' : ''
                    }`}
                >
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                      <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {chat.name[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {maskText(chat.name || chat.id)}
                      </h3>
                      {chat.timestamp && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimestamp(chat.timestamp)}
                        </span>
                      )}
                    </div>
                    {chat.unreadCount > 0 && (
                      <span className="inline-block mt-1 bg-green-600 text-white text-xs rounded-full px-2 py-0.5">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )
          ) : (
            filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No se encontraron contactos' : 'No hay contactos disponibles'}
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => {
                    setSelectedChat({
                      id: contact.id,
                      name: contact.name,
                      unreadCount: 0
                    });
                    setActiveTab('chats');
                  }}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors ${selectedChat?.id === contact.id ? 'bg-gray-50 dark:bg-gray-700' : ''
                    }`}
                >
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                      <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {contact.name[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {maskText(contact.name || contact.notify || contact.id)}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {maskText(contact.id.split('@')[0])}
                    </p>
                  </div>
                </button>
              ))
            )
          )}
        </div>
      </div>

      {/* Área de chat */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-slate-950 relative overflow-hidden">
          {/* Fondo decorativo (opcional) */}
          <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.03] pointer-events-none bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e71a7a3274530.png')] bg-repeat" />

          {/* Header del chat */}
          <div className="bg-white dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 z-10">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                {selectedChat.name[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 dark:text-white">
                {maskText(selectedChat.name || selectedChat.id)}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {maskText(selectedChat.id.split('@')[0])}
              </p>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading && messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No hay mensajes en este chat
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 shadow ${message.fromMe
                      ? 'bg-green-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                      }`}
                  >
                    <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
                    <span
                      className={`text-xs mt-1 block ${message.fromMe ? 'text-green-100' : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de mensaje */}
          <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="rounded-full bg-green-600 p-3 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <svg
              className="mx-auto h-24 w-24 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white">
              Selecciona un chat
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Elige una conversación de la lista para empezar a chatear
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
