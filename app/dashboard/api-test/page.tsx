'use client';

import { useState, useEffect } from 'react';

interface Account {
    id: string | number;
    name: string;
    phoneNumber: string;
    apiToken?: string;
    apiEnabled: boolean;
    sessionId?: string;
    status: string;
}

export default function ApiTestPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | number>('');
    const [to, setTo] = useState('');
    const [message, setMessage] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [response, setResponse] = useState<any>(null);
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

    useEffect(() => {
        const loadAccounts = async () => {
            setInitialLoading(true);
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    console.warn('No se encontró token en localStorage');
                    setInitialLoading(false);
                    return;
                }

                const res = await fetch('/api/whatsapp/accounts', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log('API Test - Cuentas cargadas:', data.accounts);
                    const apiAccounts = data.accounts.filter((acc: Account) => acc.apiEnabled === true);
                    console.log('API Test - Cuentas con API activa:', apiAccounts);
                    setAccounts(apiAccounts);
                    if (apiAccounts.length > 0) {
                        setSelectedAccountId(apiAccounts[0].id);
                        setApiToken(apiAccounts[0].apiToken || '');
                    }
                } else {
                    console.error('API Test - Error al cargar cuentas:', await res.text());
                }
            } catch (err) {
                console.error('API Test - Error:', err);
            } finally {
                setInitialLoading(false);
            }
        };
        loadAccounts();
    }, []);

    const handleAccountChange = (id: string | number) => {
        setSelectedAccountId(id);
        const account = accounts.find(acc => String(acc.id) === String(id));
        if (account) {
            setApiToken(account.apiToken || '');
        }
    };

    const handleTest = async () => {
        setLoading(true);
        setResponse(null);
        try {
            const selectedAccount = accounts.find(acc => String(acc.id) === String(selectedAccountId));
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: selectedAccount?.sessionId,
                    to,
                    message,
                    apiToken
                })
            });
            const data = await res.json();
            setResponse(data);
        } catch (err) {
            setResponse({ error: 'Error de red o servidor' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Probador de API</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Usa esta herramienta para probar tus integraciones externas antes de implementarlas.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Formulario */}
                <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Seleccionar Cuenta (Solo con API activa)
                        </label>
                        {initialLoading ? (
                            <div className="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        ) : accounts.length === 0 ? (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg">
                                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                    ⚠️ No hay cuentas con API activada. Ve a "Cuentas" y activa la opción en la configuración de alguna cuenta.
                                </p>
                            </div>
                        ) : (
                            <select
                                value={selectedAccountId}
                                onChange={(e) => handleAccountChange(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">-- Selecciona una cuenta --</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {maskText(acc.name)} ({maskText(acc.phoneNumber)})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Número de Destino (con código de país)
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: 34600000000"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            API Token
                        </label>
                        <input
                            type="text"
                            value={isPrivateMode ? '********************************' : apiToken}
                            onChange={(e) => !isPrivateMode && setApiToken(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Mensaje
                        </label>
                        <textarea
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            placeholder="Escribe tu mensaje de prueba aquí..."
                        />
                    </div>

                    <button
                        onClick={handleTest}
                        disabled={loading || !selectedAccountId}
                        className={`w-full py-3 rounded-lg font-bold text-white transition-all ${loading || !selectedAccountId
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-green-500/20'
                            }`}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Enviando...
                            </div>
                        ) : (
                            'Probar Envío API'
                        )}
                    </button>
                </div>

                {/* Respuesta */}
                <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Respuesta JSON
                    </label>
                    <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-6 font-mono text-sm overflow-auto max-h-[500px]">
                        {response ? (
                            <pre className={response.error ? 'text-red-400' : 'text-green-400'}>
                                {JSON.stringify(response, null, 2)}
                            </pre>
                        ) : (
                            <p className="text-gray-500 italic">Los resultados aparecerán aquí después de enviar...</p>
                        )}
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                        <h5 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Tip Pro:</h5>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                            Esta herramienta usa el endpoint real <code>POST /api/whatsapp/send</code>.
                            Recuerda que el <code>apiToken</code> es obligatorio para peticiones externas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
