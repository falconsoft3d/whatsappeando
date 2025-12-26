'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

interface WhatsAppAccount {
    id: string;
    name: string;
    phoneNumber: string;
}

interface AIConfig {
    enabled: boolean;
    provider: 'chatgpt' | 'ollama';
    apiKey: string;
    model: string;
    ollamaUrl: string;
    ollamaModel: string;
    systemPrompt: string;
    respondToNewContacts: boolean;
    respondToExistingContacts: boolean;
}

export default function AIModelsPage() {
    const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<AIConfig>({
        enabled: false,
        provider: 'chatgpt',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        ollamaUrl: 'http://localhost:11434',
        ollamaModel: 'llama2',
        systemPrompt: 'Eres un asistente útil que responde por WhatsApp.',
        respondToNewContacts: true,
        respondToExistingContacts: true,
    });

    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    useEffect(() => {
        if (config.provider === 'ollama' && config.ollamaUrl) {
            fetchOllamaModels(config.ollamaUrl);
        }
    }, [config.provider, config.ollamaUrl]);

    useEffect(() => {
        if (selectedAccountId) {
            fetchAIConfig(selectedAccountId);
        }
    }, [selectedAccountId]);

    const fetchAccounts = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/whatsapp/accounts', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setAccounts(data.accounts || []);
                if (data.accounts?.length > 0) {
                    setSelectedAccountId(data.accounts[0].id);
                }
            }
        } catch (err) {
            console.error('Error fetching accounts:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAIConfig = async (accountId: string) => {
        try {
            const res = await fetch(`/api/whatsapp/ai-config?accountId=${accountId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.config) {
                    setConfig({
                        enabled: data.config.enabled,
                        provider: data.config.provider as 'chatgpt' | 'ollama',
                        apiKey: data.config.apiKey || '',
                        model: data.config.model || 'gpt-3.5-turbo',
                        ollamaUrl: data.config.ollamaUrl || 'http://localhost:11434',
                        ollamaModel: data.config.ollamaModel || 'llama2',
                        systemPrompt: data.config.systemPrompt || 'Eres un asistente útil que responde por WhatsApp.',
                        respondToNewContacts: data.config.respondToNewContacts ?? true,
                        respondToExistingContacts: data.config.respondToExistingContacts ?? true,
                    });
                } else {
                    // Reset to default if no config found
                    setConfig({
                        enabled: false,
                        provider: 'chatgpt',
                        apiKey: '',
                        model: 'gpt-3.5-turbo',
                        ollamaUrl: 'http://localhost:11434',
                        ollamaModel: 'llama2',
                        systemPrompt: 'Eres un asistente útil que responde por WhatsApp.',
                        respondToNewContacts: true,
                        respondToExistingContacts: true,
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching AI config:', err);
        }
    };

    const fetchOllamaModels = async (url: string) => {
        if (!url) return;
        setFetchingModels(true);
        try {
            const res = await fetch(`${url}/api/tags`);
            if (res.ok) {
                const data = await res.json();
                const names = data.models?.map((m: any) => m.name) || [];
                setOllamaModels(names);
            } else {
                setOllamaModels([]);
            }
        } catch (err) {
            console.error('Error fetching Ollama models:', err);
            setOllamaModels([]);
        } finally {
            setFetchingModels(false);
        }
    };

    const handleSave = async () => {
        if (!selectedAccountId) return;

        setSaving(true);
        try {
            const res = await fetch('/api/whatsapp/ai-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: selectedAccountId,
                    ...config,
                }),
            });

            if (res.ok) {
                Swal.fire({
                    title: '¡Guardado!',
                    text: 'Configuración de IA actualizada correctamente',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
                    color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
                });
            } else {
                const data = await res.json();
                throw new Error(data.details || data.error || 'Error al guardar');
            }
        } catch (err: any) {
            Swal.fire({
                title: 'Error',
                text: err.message || 'No se pudo guardar la configuración',
                icon: 'error',
                background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fff',
                color: document.documentElement.classList.contains('dark') ? '#fff' : '#000',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto">
                <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Cerebro de IA</h2>
                        <p className="mt-2 text-lg text-gray-500 dark:text-gray-400 max-w-2xl">
                            Transforma tus cuentas de WhatsApp en respondedores inteligentes. Configura ChatGPT para la nube u Ollama para total privacidad local.
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                            <svg className="h-10 w-10 text-blue-500 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0012 18.75c-1.03 0-1.9-.4-2.593-1.003l-.548-.547z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start">
                    {/* Sidebar de Cuentas */}
                    <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-0">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-4">Cuentas vinculadas</h3>
                        <div className="space-y-3">
                            {accounts.map((acc) => (
                                <button
                                    key={acc.id}
                                    onClick={() => setSelectedAccountId(acc.id)}
                                    className={`group w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${selectedAccountId === acc.id
                                        ? 'border-blue-500 bg-white dark:bg-gray-800'
                                        : 'border-transparent bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl shadow-inner ${selectedAccountId === acc.id ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                            }`}>
                                            {acc.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold truncate ${selectedAccountId === acc.id ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{acc.name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono tracking-tighter mt-0.5">{acc.phoneNumber}</p>
                                        </div>
                                        {selectedAccountId === acc.id && (
                                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {accounts.length === 0 && (
                                <div className="text-center p-12 bg-white/40 dark:bg-gray-800/40 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                    <p className="text-sm text-gray-400 italic">No tienes cuentas configuradas todavía.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Formulario de Configuración */}
                    <div className="lg:col-span-8">
                        <div className="group bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-500">
                            {/* Header con gradiente sutil */}
                            <div className="p-8 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className={`p-4 rounded-2xl transition-all duration-500 ${config.enabled ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 rotate-0' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 rotate-12'}`}>
                                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 dark:text-white text-xl uppercase tracking-tight">Arquitectura del Bot</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`h-1.5 w-1.5 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{config.enabled ? 'Operativo' : 'Desactivado'}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                                    className={`relative w-16 h-8 rounded-full transition-all duration-500 overflow-hidden ${config.enabled ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <div className={`absolute top-1 transition-all duration-500 h-6 w-6 rounded-full bg-white shadow-sm ${config.enabled ? 'left-9' : 'left-1'}`}></div>
                                </button>
                            </div>

                            <div className="p-8 space-y-8">
                                {/* Selector de Proveedor - Versión Premium */}
                                <div>
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">Proveedor de Motor</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setConfig({ ...config, provider: 'chatgpt' })}
                                            className={`group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-500 relative ${config.provider === 'chatgpt'
                                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                                                : 'border-transparent bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className={`text-3xl transition-transform duration-500 ${config.provider === 'chatgpt' ? 'scale-110' : 'grayscale opacity-50'}`}>🤖</div>
                                            <div className="text-left">
                                                <span className={`block font-black text-sm uppercase tracking-tight ${config.provider === 'chatgpt' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>ChatGPT</span>
                                                <span className="text-[10px] text-gray-400 font-medium">Cloud AI by OpenAI</span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setConfig({ ...config, provider: 'ollama' })}
                                            className={`group flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-500 relative ${config.provider === 'ollama'
                                                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                                                : 'border-transparent bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className={`text-3xl transition-transform duration-500 ${config.provider === 'ollama' ? 'scale-110' : 'grayscale opacity-50'}`}>🦙</div>
                                            <div className="text-left">
                                                <span className={`block font-black text-sm uppercase tracking-tight ${config.provider === 'ollama' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>Ollama</span>
                                                <span className="text-[10px] text-gray-400 font-medium">Local AI Private</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {config.provider === 'chatgpt' ? (
                                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">OpenAI Secret Key</label>
                                            <input
                                                type="password"
                                                value={config.apiKey}
                                                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                                className="w-full rounded-2xl border-2 border-gray-100 dark:border-gray-700 px-5 py-3 bg-gray-50/50 dark:bg-gray-900/50 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:outline-none dark:text-white text-sm transition-all"
                                                placeholder="sk-••••••••••••••••••••••••••••••••"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Modelo Neuronal</label>
                                            <select
                                                value={config.model}
                                                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                                className="w-full rounded-2xl border-2 border-gray-100 dark:border-gray-700 px-5 py-3 bg-gray-50/50 dark:bg-gray-900/50 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:outline-none dark:text-white text-sm transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Rápido)</option>
                                                <option value="gpt-4">GPT-4 (Inteligente)</option>
                                                <option value="gpt-4o">GPT-4o (Omni - Recomendado)</option>
                                                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                            </select>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Ollama Host Connection</label>
                                            <input
                                                type="text"
                                                value={config.ollamaUrl}
                                                onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
                                                className="w-full rounded-2xl border-2 border-gray-100 dark:border-gray-700 px-5 py-3 bg-gray-50/50 dark:bg-gray-900/50 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:outline-none dark:text-white text-sm transition-all"
                                                placeholder="http://127.0.0.1:11434"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-2 ml-1">
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Cargar Modelo Local</label>
                                                <button
                                                    onClick={() => fetchOllamaModels(config.ollamaUrl)}
                                                    className="text-[10px] font-bold text-blue-500 hover:text-blue-600 uppercase tracking-tighter flex items-center gap-1"
                                                >
                                                    {fetchingModels ? (
                                                        <div className="h-2 w-2 animate-spin rounded-full border border-blue-500 border-t-transparent"></div>
                                                    ) : (
                                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                    )}
                                                    Actualizar Lista
                                                </button>
                                            </div>
                                            {ollamaModels.length > 0 ? (
                                                <select
                                                    value={config.ollamaModel}
                                                    onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
                                                    className="w-full rounded-2xl border-2 border-gray-100 dark:border-gray-700 px-5 py-3 bg-gray-50/50 dark:bg-gray-900/50 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:outline-none dark:text-white text-sm transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="">Selecciona un modelo...</option>
                                                    {ollamaModels.map(model => (
                                                        <option key={model} value={model}>{model}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={config.ollamaModel}
                                                        onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
                                                        className="w-full rounded-2xl border-2 border-gray-100 dark:border-gray-700 px-5 py-3 bg-gray-50/50 dark:bg-gray-900/50 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:outline-none dark:text-white text-sm transition-all"
                                                        placeholder="llama3, deepseek-coder, mistral..."
                                                    />
                                                    <p className="mt-1.5 text-[9px] text-amber-500 font-medium px-1">
                                                        No se detectaron modelos o Ollama está inaccesible. Escribe el nombre manualmente.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Directiva de Sistema (Personalidad)</label>
                                    <textarea
                                        rows={5}
                                        value={config.systemPrompt}
                                        onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                                        className="w-full rounded-2xl border-2 border-gray-100 dark:border-gray-700 px-5 py-4 bg-gray-50/50 dark:bg-gray-900/50 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:outline-none dark:text-white text-sm transition-all resize-none leading-relaxed"
                                        placeholder="Ej: Eres un asistente de ventas experto en zapatos. Responde de forma amable y concisa."
                                    />
                                    <div className="mt-3 flex items-start gap-2 px-1">
                                        <span className="text-blue-500 text-lg">💡</span>
                                        <p className="text-[10px] text-gray-400 font-medium italic">Describe detalladamente quién es el bot, qué sabe hacer y cuál es su tono de voz. Esto define radicalmente la calidad de las respuestas.</p>
                                    </div>
                                </div>

                                {/* Filtros de Contactos */}
                                <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Filtros de Contactos</label>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 border-2 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={config.respondToNewContacts}
                                                onChange={(e) => setConfig({ ...config, respondToNewContacts: e.target.checked })}
                                                className="h-5 w-5 rounded-md text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    ✨ Responder a contactos nuevos
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    La IA responderá automáticamente a personas que te escriben por primera vez
                                                </div>
                                            </div>
                                        </label>

                                        <label className="flex items-center gap-3 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 border-2 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={config.respondToExistingContacts}
                                                onChange={(e) => setConfig({ ...config, respondToExistingContacts: e.target.checked })}
                                                className="h-5 w-5 rounded-md text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    📇 Responder a contactos antiguos
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    La IA responderá a personas que ya te han escrito anteriormente
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                    <div className="mt-3 flex items-start gap-2 px-1">
                                        <span className="text-amber-500 text-lg">⚠️</span>
                                        <p className="text-[10px] text-gray-400 font-medium italic">Si desactivas ambas opciones, la IA no responderá a ningún contacto. Usa la lista negra en "Contactos" para bloquear personas específicas.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !selectedAccountId}
                                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white transition-all duration-500 transform hover:scale-[1.02] active:scale-[0.98] ${saving || !selectedAccountId
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-500/25'
                                        }`}
                                >
                                    {saving ? (
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                                            Actualizando Sistemas...
                                        </div>
                                    ) : (
                                        'Sincronizar Inteligencia'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
