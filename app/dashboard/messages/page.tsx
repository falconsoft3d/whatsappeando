'use client';

import { useState, useEffect } from 'react';

interface Account {
  id: number | string;
  name: string;
  phoneNumber: string;
  description: string;
  status: 'connected' | 'disconnected';
  sessionId?: string;
  createdAt: string;
}

interface Message {
  id: number;
  to: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'failed';
}

export default function MessagesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'send' | 'webhook'>('send');
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);

  useEffect(() => {
    const checkPrivateMode = () => {
      setIsPrivateMode(localStorage.getItem('privateMode') === 'true');
    };
    checkPrivateMode();
    window.addEventListener('storage', checkPrivateMode);
    return () => window.removeEventListener('storage', checkPrivateMode);
  }, []);

  const maskText = (text: string) => isPrivateMode ? '********' : text;

  // Cargar cuentas e historial desde localStorage
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
          setSelectedAccount(connectedAccounts[0]);
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    }

    const savedHistory = localStorage.getItem('messageHistory');
    if (savedHistory) {
      try {
        setMessageHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Error loading history:', error);
      }
    }
  }, []);

  // Polling para logs de webhooks
  useEffect(() => {
    let interval: any;
    if (activeTab === 'webhook') {
      const fetchLogs = async () => {
        try {
          const res = await fetch('/api/whatsapp/webhooks/logs');
          if (res.ok) {
            const data = await res.json();
            setWebhookLogs(data.logs);
          }
        } catch (err) {
          console.error('Error fetching webhook logs:', err);
        }
      };
      fetchLogs();
      interval = setInterval(fetchLogs, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  // Guardar historial cuando cambie
  useEffect(() => {
    if (messageHistory.length > 0) {
      localStorage.setItem('messageHistory', JSON.stringify(messageHistory));
    }
  }, [messageHistory]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccount || !selectedAccount.sessionId) {
      showNotification('error', 'Por favor selecciona una cuenta conectada');
      return;
    }

    if (!phoneNumber.trim() || !message.trim()) {
      showNotification('error', 'Por favor completa todos los campos');
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
          phoneNumber: phoneNumber.trim(),
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showNotification('success', '✅ Mensaje enviado correctamente');

        const newMessage: Message = {
          id: Date.now(),
          to: phoneNumber,
          content: message,
          timestamp: new Date(),
          status: 'sent',
        };
        setMessageHistory([newMessage, ...messageHistory]);
        setPhoneNumber('');
        setMessage('');
      } else {
        showNotification('error', data.error || 'Error al enviar mensaje');
        const failedMessage: Message = {
          id: Date.now(),
          to: phoneNumber,
          content: message,
          timestamp: new Date(),
          status: 'failed',
        };
        setMessageHistory([failedMessage, ...messageHistory]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification('error', 'Error de conexión al enviar mensaje');
    } finally {
      setSending(false);
    }
  };

  const clearHistory = () => {
    if (confirm('¿Estás seguro de borrar todo el historial?')) {
      setMessageHistory([]);
      localStorage.removeItem('messageHistory');
      showNotification('success', 'Historial borrado');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Gestión de Mensajes
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Envía mensajes y monitorea la actividad de tu API en tiempo real
        </p>
      </div>

      {notification && (
        <div className={`mb-6 rounded-lg p-4 ${notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {notification.message}
        </div>
      )}

      <div className="mb-6 flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'send'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          Enviar Mensajes
        </button>
        <button
          onClick={() => setActiveTab('webhook')}
          className={`px-6 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'webhook'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          Monitor Webhooks (Incoming)
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800">
          <p>No hay cuentas conectadas. Ve a la sección de Cuentas para vincular una.</p>
          <a href="/dashboard/accounts" className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg">Ir a Cuentas</a>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {activeTab === 'send' ? (
            <>
              <div className="lg:col-span-2">
                <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                  <h3 className="mb-4 text-xl font-semibold">Nuevo Mensaje</h3>
                  <form onSubmit={handleSendMessage} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cuenta</label>
                      <select
                        value={selectedAccount?.id || ''}
                        onChange={(e) => {
                          const acc = accounts.find(a => String(a.id) === String(e.target.value));
                          setSelectedAccount(acc || null);
                        }}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{maskText(acc.name)} ({maskText(acc.phoneNumber)})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Número de Destino</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        placeholder="+51987654321"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Mensaje</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none"
                        rows={4}
                      />
                    </div>
                    <button disabled={sending} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-lg dark:shadow-green-900/20 transition-all flex items-center justify-center gap-2">
                      {sending && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>}
                      {sending ? 'Enviando...' : 'Enviar Mensaje'}
                    </button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-1">
                <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Historial</h3>
                    <button onClick={clearHistory} className="text-sm text-red-500">Limpiar</button>
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {messageHistory.length === 0 ? (
                      <p className="text-center text-sm text-gray-500 py-8">No hay mensajes aún</p>
                    ) : (
                      messageHistory.map(msg => (
                        <div key={msg.id} className={`p-4 rounded-xl border transition-all ${msg.status === 'sent'
                          ? 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800/30'
                          : 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/30'
                          }`}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{maskText(msg.to)}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${msg.status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                              {msg.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-300 break-words">{msg.content}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="lg:col-span-3">
              <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Monitor de Webhooks</h3>
                    <p className="text-sm text-gray-500">Logs de peticiones salientes a tu Webhook configurado.</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-blue-600">URL de Prueba recomendada:</p>
                    <code className="text-xs font-mono">http://localhost:3000/api/whatsapp/webhooks/test</code>
                  </div>
                </div>

                <div className="space-y-4">
                  {webhookLogs.length === 0 ? (
                    <div className="text-center py-10 opacity-50 italic">Esperando eventos...</div>
                  ) : (
                    webhookLogs.map(log => (
                      <div key={log.id} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                        <div className={`px-4 py-2 flex justify-between items-center ${log.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                          <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{log.url}</span>
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${log.success ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>{log.status || 'ERROR'}</span>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/40">
                          <pre className="text-[10px] font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
