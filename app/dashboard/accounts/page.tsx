'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

interface Account {
  id: number;
  name: string;
  phoneNumber: string;
  description: string;
  status: 'connected' | 'disconnected';
  sessionId?: string;
  webhookUrl?: string;
  apiToken?: string;
  apiEnabled: boolean;
  createdAt: string;
}

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('pending');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    description: '',
    webhookUrl: '',
    apiToken: '',
    apiEnabled: false,
  });
  const [activeConfigTab, setActiveConfigTab] = useState<'config' | 'docs'>('config');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [serverError, setServerError] = useState<{ message: string, details?: string } | null>(null);
  const [isPrivateMode, setIsPrivateMode] = useState(false);

  useEffect(() => {
    const checkPrivateMode = () => {
      setIsPrivateMode(localStorage.getItem('privateMode') === 'true');
    };
    checkPrivateMode();
    window.addEventListener('storage', checkPrivateMode);
    return () => window.removeEventListener('storage', checkPrivateMode);
  }, []);

  const maskText = (text: string) => isPrivateMode ? '********' : text;

  // Cargar cuentas desde el servidor y sincronizar con localStorage
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('/api/whatsapp/accounts', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts);
          localStorage.setItem('whatsappAccounts', JSON.stringify(data.accounts));
        } else {
          // Si falla el servidor, probalemente el token expiró o algo, 
          // pero intentamos usar lo que hay en localStorage como respaldo parcial
          const savedAccounts = localStorage.getItem('whatsappAccounts');
          if (savedAccounts) {
            setAccounts(JSON.parse(savedAccounts));
          }
        }
      } catch (error) {
        console.error('Error loading accounts:', error);
        const savedAccounts = localStorage.getItem('whatsappAccounts');
        if (savedAccounts) {
          setAccounts(JSON.parse(savedAccounts));
        }
      }
    };

    fetchAccounts();
  }, []);

  // Guardar cuentas en localStorage cada vez que cambien
  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem('whatsappAccounts', JSON.stringify(accounts));
    }
  }, [accounts]);

  // Verificar estado de conexión cada 2 segundos
  useEffect(() => {
    if (showQRModal && sessionId) {
      let attempts = 0;
      const MAX_ATTEMPTS = 90; // 3 minutos (90 * 2 segundos)

      const checkStatus = setInterval(async () => {
        attempts++;

        // Timeout de seguridad
        if (attempts > MAX_ATTEMPTS) {
          clearInterval(checkStatus);
          setErrorMessage('Tiempo de espera agotado. Cierra y vuelve a intentar.');
          setTimeout(() => {
            setShowQRModal(false);
            setSelectedAccount(null);
            setConnectionStatus('pending');
            setErrorMessage('');
            setRetryCount(0);
          }, 5000);
          return;
        }

        try {
          const response = await fetch(`/api/whatsapp/status/${sessionId}`);

          if (response.status === 404) {
            setErrorMessage('Buscando sesión en el servidor...');
            return;
          }

          if (response.ok) {
            const data = await response.json();
            setConnectionStatus(data.status);
            setRetryCount(data.retryCount || 0);

            // Mostrar mensaje de reintento
            if (data.retryCount && data.retryCount > 0) {
              setErrorMessage(`Reconectando... (Intento ${data.retryCount}/3)`);
            } else if (data.error && data.status !== 'connected') {
              setErrorMessage(data.error);
            } else if (data.status === 'pending' && !data.error) {
              setErrorMessage(''); // Limpiar error si está en pending sin error
            }

            if (data.status === 'connected') {
              clearInterval(checkStatus);
              setErrorMessage('¡Conectado exitosamente!');

              // Recargar la página después de 2 segundos para actualizar todo el estado
              setTimeout(() => {
                setShowQRModal(false);
                window.location.reload();
              }, 2000);

              // Guardar cuenta en la base de datos (opcional)
              if (selectedAccount && data.phoneNumber) {
                try {
                  const token = localStorage.getItem('token');
                  if (token) {
                    const saveResponse = await fetch('/api/whatsapp/accounts', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        name: selectedAccount.name,
                        phoneNumber: data.phoneNumber,
                        description: selectedAccount.description,
                        sessionId: sessionId,
                        status: 'connected'
                      })
                    });

                    if (saveResponse.ok) {
                      console.log('✅ Cuenta guardada en la base de datos');
                    } else {
                      const errorData = await saveResponse.json();
                      console.warn('⚠️ No se pudo guardar en BD (no es crítico):', errorData.error);
                    }
                  } else {
                    console.warn('⚠️ Token no disponible, cuenta no guardada en BD');
                  }
                } catch (saveError) {
                  console.warn('⚠️ Error guardando cuenta en BD (no es crítico):', saveError);
                }
              }

              // Actualizar cuenta como conectada en el estado local
              if (selectedAccount) {
                setAccounts(prev => prev.map(acc =>
                  acc.id === selectedAccount.id
                    ? { ...acc, status: 'connected', sessionId, phoneNumber: data.phoneNumber }
                    : acc
                ));
              }

              // La página se recargará automáticamente según el timeout anterior
            } else if (data.status === 'error') {
              clearInterval(checkStatus);
              setErrorMessage(data.error || 'Error al conectar. Genera un nuevo QR.');
              // Cerrar modal después de 5 segundos
              setTimeout(() => {
                setShowQRModal(false);
                setSelectedAccount(null);
                setConnectionStatus('pending');
                setErrorMessage('');
                setRetryCount(0);
              }, 5000);
            } else if (data.status === 'disconnected' && !data.retryCount) {
              clearInterval(checkStatus);
              setErrorMessage('Conexión perdida.');
              setTimeout(() => {
                setShowQRModal(false);
                setSelectedAccount(null);
                setConnectionStatus('pending');
                setErrorMessage('');
                setRetryCount(0);
              }, 3000);
            }
          } else if (response.status === 404) {
            // Sesión no encontrada - podría estar inicializándose aún
            console.log('Sesión no encontrada, esperando...');
            // No detener el intervalo, seguir consultando
          }
        } catch (error) {
          console.error('Error checking status:', error);
        }
      }, 2000);

      return () => {
        clearInterval(checkStatus);
      };
    }
  }, [showQRModal, sessionId, selectedAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (editingAccount) {
      const updatedAccounts = accounts.map(acc =>
        acc.id === editingAccount.id ? { ...acc, ...formData } : acc
      );
      setAccounts(updatedAccounts);
      localStorage.setItem('whatsappAccounts', JSON.stringify(updatedAccounts));

      // Sincronizar con el servidor
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/whatsapp/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            id: editingAccount.id,
            status: editingAccount.status,
            sessionId: editingAccount.sessionId
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setServerError({
            message: err.error,
            details: err.details
          });
        } else {
          // Refrescar lista desde el servidor para estar 100% seguros de los datos
          const data = await res.json();
          if (data.account) {
            setAccounts(prev => prev.map(acc => acc.id === editingAccount.id ? data.account : acc));
            setShowAddModal(false);
          }
        }
      } catch (err) {
        console.error('Error syncing updated account:', err);
        setServerError({
          message: 'Error de conexión',
          details: err instanceof Error ? err.message : String(err)
        });
      }
    } else {
      const newAccount: Account = {
        id: Date.now(),
        ...formData,
        status: 'disconnected',
        createdAt: new Date().toISOString(),
      };

      const updatedAccounts = [...accounts, newAccount];
      setAccounts(updatedAccounts);
      localStorage.setItem('whatsappAccounts', JSON.stringify(updatedAccounts));

      // Intentar crear en el servidor inmediatamente
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/whatsapp/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            status: 'disconnected'
          }),
        });
        if (res.ok) {
          const data = await res.json();
          // Actualizamos el ID local con el ID real del servidor
          setAccounts(prev => prev.map(acc => acc.id === newAccount.id ? data.account : acc));
          setShowAddModal(false);
        } else {
          const err = await res.json();
          setServerError({
            message: err.error,
            details: err.details
          });
        }
      } catch (err) {
        console.error('Error creating account on server:', err);
        setServerError({
          message: 'Error de conexión',
          details: err instanceof Error ? err.message : String(err)
        });
      }
    }

    setShowAddModal(false);
    setEditingAccount(null);
    setFormData({ name: '', phoneNumber: '', description: '', webhookUrl: '', apiToken: '', apiEnabled: false });
  };

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, apiToken: token }));
  };

  const handleConnect = async (account: Account) => {
    try {
      setSelectedAccount(account);

      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: account.id,
          phoneNumber: account.phoneNumber,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQrCode(data.qr);
        setSessionId(data.sessionId);
        setConnectionStatus('pending');
        setShowQRModal(true);
      }
    } catch (error) {
      console.error('Error connecting account:', error);
    }
  };

  const handleDisconnect = (accountId: number) => {
    setAccounts(prev => prev.map(acc =>
      acc.id === accountId
        ? { ...acc, status: 'disconnected', sessionId: undefined }
        : acc
    ));
  };

  const handleDelete = async (accountId: number | string) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción eliminará la cuenta y todos sus registros de forma permanente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
      color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/whatsapp/accounts?id=${accountId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          setAccounts(prev => prev.filter(acc => acc.id !== accountId));

          // También limpiar de localStorage
          const savedAccounts = localStorage.getItem('whatsappAccounts');
          if (savedAccounts) {
            const parsed = JSON.parse(savedAccounts);
            localStorage.setItem('whatsappAccounts', JSON.stringify(parsed.filter((acc: any) => acc.id !== accountId)));
          }

          Swal.fire({
            title: '¡Eliminado!',
            text: 'La cuenta ha sido eliminada correctamente.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
            color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
          });
        } else {
          const data = await res.json();
          Swal.fire({
            title: 'Error',
            text: data.error || 'No se pudo eliminar la cuenta.',
            icon: 'error',
            background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
            color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
          });
        }
      } catch (err) {
        console.error('Error deleting account:', err);
        Swal.fire({
          title: 'Error de conexión',
          text: 'Hubo un problema al conectar con el servidor.',
          icon: 'error',
          background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
        });
      }
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Cuentas de WhatsApp
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Administra tus cuentas conectadas
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar Cuenta
        </button>
      </div>

      {/* Lista de cuentas */}
      {accounts.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No hay cuentas conectadas
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Comienza agregando tu primera cuenta de WhatsApp
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 transition-colors"
          >
            Agregar Primera Cuenta
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-lg bg-white p-6 shadow dark:bg-gray-800 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/20">
                    <svg
                      className="h-6 w-6 text-green-600 dark:text-green-400"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {maskText(account.name)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {maskText(account.phoneNumber)}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${account.status === 'connected'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                  {account.status === 'connected' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              {account.description && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {account.description}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                {account.status === 'disconnected' ? (
                  <button
                    onClick={() => handleConnect(account)}
                    className="flex-1 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 flex items-center justify-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Conectar
                  </button>
                ) : (
                  <div className="flex-1 flex gap-2">
                    <button
                      onClick={() => handleDisconnect(account.id)}
                      className="flex-1 rounded-lg bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                    >
                      Desconectar
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/chat?sessionId=${account.sessionId}`)}
                      className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 flex items-center justify-center gap-2"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Abrir Chat
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setEditingAccount(account);
                    setFormData({
                      name: account.name,
                      phoneNumber: account.phoneNumber,
                      description: account.description || '',
                      webhookUrl: account.webhookUrl || '',
                      apiToken: account.apiToken || '',
                      apiEnabled: account.apiEnabled || false,
                    });
                    setActiveConfigTab('config');
                    setShowAddModal(true);
                  }}
                  className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400 dark:hover:bg-gray-900/30"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para agregar cuenta */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingAccount ? 'Configurar Cuenta' : 'Agregar Nueva Cuenta'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setServerError(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {serverError && (
              <div className="mb-4 overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20">
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-red-800 dark:text-red-400">
                      {serverError.message}
                    </h4>
                    <button
                      onClick={() => setServerError(null)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {serverError.details && (
                    <div className="mt-2">
                      <p className="text-xs text-red-700 dark:text-red-400 mb-1">Detalles técnicos:</p>
                      <div className="relative">
                        <textarea
                          readOnly
                          className="w-full h-24 rounded border border-red-100 bg-white/50 p-2 text-[10px] font-mono whitespace-pre dark:border-red-800 dark:bg-black/50 dark:text-red-300"
                          value={serverError.details}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(serverError.details || '');
                            Swal.fire({
                              title: '¡Copiado!',
                              text: 'Los detalles del error se han copiado al portapapeles.',
                              icon: 'success',
                              timer: 1500,
                              showConfirmButton: false,
                              background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
                              color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
                            });
                          }}
                          className="absolute bottom-2 right-2 rounded bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-200 dark:bg-red-800 dark:text-red-200"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {editingAccount && (
              <div className="mb-6 flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveConfigTab('config')}
                  className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeConfigTab === 'config'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                  Configuración
                </button>
                <button
                  onClick={() => setActiveConfigTab('docs')}
                  className={`flex-1 pb-2 text-sm font-medium transition-colors ${activeConfigTab === 'docs'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                  Documentación API
                </button>
              </div>
            )}

            {activeConfigTab === 'config' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre de la Cuenta
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 resolve-input dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Mi Cuenta"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Número de Teléfono
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 resolve-input dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Ej: 34600000000"
                    disabled={!!editingAccount}
                  />
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Configuración API</h4>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.apiEnabled}
                        onChange={(e) => setFormData({ ...formData, apiEnabled: e.target.checked })}
                      />
                      <div className={`h-6 w-11 rounded-full transition-colors ${formData.apiEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <div className={`absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${formData.apiEnabled ? 'translate-x-[20px]' : ''}`}></div>
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Activar API
                      </span>
                    </label>
                  </div>

                  {formData.apiEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Webhook URL (POST)
                        </label>
                        <input
                          type="url"
                          value={formData.webhookUrl}
                          onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resolve-input dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          placeholder="https://tu-api.com/webhook"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          API Token
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.apiToken}
                            onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm resolve-input dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            placeholder="token_secreto"
                          />
                          <button
                            type="button"
                            onClick={generateToken}
                            className="rounded-lg bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                          >
                            Generar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingAccount(null);
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                  >
                    {editingAccount ? 'Guardar Cambios' : 'Agregar'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <section>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2">Enviar Mensaje</h4>
                  <div className="rounded-lg bg-gray-950 p-3 text-xs text-gray-300 font-mono">
                    <p className="text-blue-400 mb-1">POST /api/whatsapp/send</p>
                    <p className="text-gray-500">{"{"}</p>
                    <p className="pl-4 text-green-400">"to": "34600000000",</p>
                    <p className="pl-4 text-green-400">"message": "Hola mundo",</p>
                    <p className="pl-4 text-green-400">"apiToken": "{formData.apiToken || 'TU_TOKEN'}"</p>
                    <p className="text-gray-500">{"}"}</p>
                  </div>
                </section>

                <section>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2">Enviar Archivos</h4>
                  <div className="rounded-lg bg-gray-950 p-3 text-xs text-gray-300 font-mono">
                    <p className="text-blue-400 mb-1">POST /api/whatsapp/send</p>
                    <p className="text-gray-500">{"{"}</p>
                    <p className="pl-4 text-green-400">"to": "34600000000",</p>
                    <p className="pl-4 text-green-400">"apiToken": "{formData.apiToken || 'TU_TOKEN'}",</p>
                    <p className="pl-4 text-green-400">"media": {"{"}</p>
                    <p className="pl-8 text-yellow-400">"type": "image",</p>
                    <p className="pl-8 text-yellow-400">"url": "https://tusitio.com/foto.jpg",</p>
                    <p className="pl-8 text-yellow-400">"caption": "Opcional"</p>
                    <p className="pl-4 text-green-400">{"}"}</p>
                    <p className="text-gray-500">{"}"}</p>
                  </div>

                  <div className="mt-4 rounded-lg bg-gray-950 p-3 text-[10px] text-gray-300 font-mono">
                    <p className="text-blue-400 mb-1">// Ejemplo Envío de Documento (PDF/Doc)</p>
                    <p className="text-gray-500">{"{"}</p>
                    <p className="pl-4 text-green-400">"media": {"{"}</p>
                    <p className="pl-8 text-yellow-400">"type": "document",</p>
                    <p className="pl-8 text-yellow-400">"url": "https://tusitio.com/factura.pdf",</p>
                    <p className="pl-8 text-yellow-400">"filename": "Factura_123.pdf"</p>
                    <p className="pl-4 text-green-400">{"}"}</p>
                    <p className="text-gray-500">{"}"}</p>
                  </div>
                  <p className="mt-2 text-[10px] text-gray-500">Tipos soportados: <b>image, video, audio, document</b></p>
                  <p className="text-[10px] text-amber-500">La URL debe ser pública y accesible por el servidor.</p>
                </section>

                <section>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2">Recibir Webhook</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Si el Webhook está activo, recibirás un POST con el siguiente formato cada vez que entre un mensaje:
                  </p>
                  <div className="rounded-lg bg-gray-950 p-3 text-xs text-gray-300 font-mono">
                    <p className="text-gray-500">{"{"}</p>
                    <p className="pl-4">"sessionId": "...",</p>
                    <p className="pl-4">"event": "message.received",</p>
                    <p className="pl-4">"data": {"{"}</p>
                    <p className="pl-8 text-green-400">"id": "...",</p>
                    <p className="pl-8 text-green-400">"from": "...",</p>
                    <p className="pl-8 text-green-400">"text": "..."</p>
                    <p className="pl-4">{"}"}</p>
                    <p className="text-gray-500">{"}"}</p>
                  </div>
                </section>

                <button
                  onClick={() => setActiveConfigTab('config')}
                  className="w-full mt-4 rounded-lg bg-gray-100 dark:bg-gray-700 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Volver a Configuración
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal QR para conectar WhatsApp */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Conectar WhatsApp
              </h3>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setQrCode('');
                  setSessionId('');
                  setConnectionStatus('pending');
                  setErrorMessage('');
                  setRetryCount(0);
                  setSelectedAccount(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800">
                  {qrCode ? (
                    <img
                      src={qrCode}
                      alt="Código QR de WhatsApp"
                      className="w-64 h-64"
                    />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center">
                      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Escanea el código QR
                </h4>
                <ol className="text-left text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>1. Abre WhatsApp en tu teléfono</li>
                  <li>2. Toca Menú o Configuración</li>
                  <li>3. Selecciona "Dispositivos vinculados"</li>
                  <li>4. Toca "Vincular un dispositivo"</li>
                  <li>5. Escanea este código QR</li>
                </ol>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                {errorMessage ? (
                  <>
                    <div className={`h-2 w-2 rounded-full ${retryCount > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className={retryCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}>
                      {errorMessage}
                    </span>
                  </>
                ) : connectionStatus === 'connected' ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    ¡Conectado exitosamente!
                  </>
                ) : connectionStatus === 'error' ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    <span className="text-red-600 dark:text-red-400">Error de conexión</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                    Esperando conexión... (escanea rápido)
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
