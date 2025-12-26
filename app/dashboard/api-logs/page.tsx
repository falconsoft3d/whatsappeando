'use client';

import { useState, useEffect } from 'react';

interface ApiLog {
    id: string;
    to: string;
    message: string | null;
    mediaUrl: string | null;
    mediaType: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    account: {
        name: string;
        phoneNumber: string;
    };
}

export default function ApiLogsPage() {
    const [logs, setLogs] = useState<ApiLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPrivateMode, setIsPrivateMode] = useState(false);

    useEffect(() => {
        const checkPrivateMode = () => {
            setIsPrivateMode(localStorage.getItem('privateMode') === 'true');
        };
        checkPrivateMode();
        window.addEventListener('storage', checkPrivateMode);

        loadLogs();

        return () => window.removeEventListener('storage', checkPrivateMode);
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/whatsapp/api-logs');
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
            }
        } catch (err) {
            console.error('Error loading logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const maskText = (text: string) => isPrivateMode ? '********' : text;

    return (
        <div className="p-8 h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">API Logs</h2>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Historial de mensajes enviados a través de la API externa.
                    </p>
                </div>
                <button
                    onClick={loadLogs}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg dark:hover:bg-blue-900/20"
                    title="Recargar"
                >
                    <svg className={`h-6 w-6 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/50 backdrop-blur">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cuenta</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Destinatario</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Mensaje / Media</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {logs.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-20 text-center text-gray-500">
                                    No hay envíos registrados aún.
                                </td>
                            </tr>
                        )}
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                                        {maskText(log.account.name)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {maskText(log.account.phoneNumber)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-mono text-blue-600 dark:text-blue-400">
                                    {maskText(log.to)}
                                </td>
                                <td className="px-6 py-4 max-w-xs">
                                    {log.message && (
                                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate" title={log.message}>
                                            {log.message}
                                        </p>
                                    )}
                                    {log.mediaUrl && (
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-[10px] text-blue-700 dark:text-blue-300 uppercase">
                                                {log.mediaType}
                                            </span>
                                            <a href={log.mediaUrl} target="_blank" className="text-[10px] text-blue-500 hover:underline truncate">
                                                {log.mediaUrl}
                                            </a>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.status === 'sent'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                        }`}>
                                        {log.status === 'sent' ? 'Enviado' : 'Error'}
                                    </span>
                                    {log.errorMessage && (
                                        <p className="text-[10px] text-red-500 mt-1">{log.errorMessage}</p>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
