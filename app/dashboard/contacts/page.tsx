'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

interface Contact {
    id: string;
    jid: string;
    pushName: string | null;
    isBlacklisted: boolean;
    updatedAt: string;
    account: {
        id: string;
        name: string;
        phoneNumber: string;
    };
}

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isPrivateMode, setIsPrivateMode] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [viewingConversation, setViewingConversation] = useState<Contact | null>(null);
    const [conversationHistory, setConversationHistory] = useState<any[]>([]);
    const [loadingConversation, setLoadingConversation] = useState(false);

    // Form fields
    const [formData, setFormData] = useState({
        jid: '',
        name: '',
        accountId: '',
        isBlacklisted: false
    });

    useEffect(() => {
        const checkPrivateMode = () => {
            setIsPrivateMode(localStorage.getItem('privateMode') === 'true');
        };
        checkPrivateMode();
        window.addEventListener('storage', checkPrivateMode);
        loadContacts();
        loadAccounts();
        return () => window.removeEventListener('storage', checkPrivateMode);
    }, []);

    const loadAccounts = async () => {
        try {
            const res = await fetch('/api/whatsapp/accounts');
            if (res.ok) {
                const data = await res.json();
                setAccounts(data.accounts || []);
            }
        } catch (err) {
            console.error('Error loading accounts:', err);
        }
    };

    const loadContacts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/whatsapp/contacts');
            if (res.ok) {
                const data = await res.json();
                setContacts(data.contacts);
            }
        } catch (err) {
            console.error('Error loading contacts:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadConversationHistory = async (contact: Contact) => {
        setViewingConversation(contact);
        setLoadingConversation(true);

        console.log('🔍 Cargando conversación para:', {
            jid: contact.jid,
            accountId: contact.account.id,
            name: contact.pushName
        });

        try {
            const url = `/api/whatsapp/messages/history?contactJid=${encodeURIComponent(contact.jid)}&accountId=${contact.account.id}`;
            console.log('📡 URL de petición:', url);

            const res = await fetch(url);
            const data = await res.json();

            console.log('📦 Respuesta recibida:', {
                ok: res.ok,
                status: res.status,
                messagesCount: data.messages?.length || 0,
                data
            });

            if (res.ok) {
                setConversationHistory(data.messages || []);
                console.log('✅ Historial cargado:', data.messages?.length || 0, 'mensajes');
            } else {
                console.error('❌ Error en respuesta:', data.error);
                setConversationHistory([]);
            }
        } catch (err) {
            console.error('❌ Error loading conversation:', err);
            setConversationHistory([]);
        } finally {
            setLoadingConversation(false);
        }
    };

    const handleCreateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/whatsapp/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                Swal.fire('¡Creado!', 'Contacto guardado exitosamente.', 'success');
                setIsCreateModalOpen(false);
                setFormData({ jid: '', name: '', accountId: '', isBlacklisted: false });
                loadContacts();
            } else {
                const data = await res.json();
                Swal.fire('Error', data.error || 'No se pudo crear el contacto.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Error de conexión.', 'error');
        }
    };

    const handleUpdateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedContact) return;

        try {
            const res = await fetch('/api/whatsapp/contacts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedContact.id,
                    name: formData.name,
                    isBlacklisted: formData.isBlacklisted
                })
            });

            if (res.ok) {
                Swal.fire('¡Actualizado!', 'Contacto actualizado exitosamente.', 'success');
                setIsEditModalOpen(false);
                loadContacts();
            } else {
                Swal.fire('Error', 'No se pudo actualizar el contacto.', 'error');
            }
        } catch (err) {
            Swal.fire('Error', 'Error de conexión.', 'error');
        }
    };

    const deleteContact = async (contact: Contact) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/whatsapp/contacts?id=${contact.id}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    Swal.fire('Eliminado', 'El contacto ha sido eliminado.', 'success');
                    loadContacts();
                }
            } catch (err) {
                Swal.fire('Error', 'Error al eliminar.', 'error');
            }
        }
    };

    const toggleBlacklist = async (contact: Contact) => {
        try {
            const res = await fetch('/api/whatsapp/contacts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contactId: contact.id,
                    isBlacklisted: !contact.isBlacklisted
                })
            });

            if (res.ok) {
                loadContacts();
            }
        } catch (err) {
            console.error('Error toggling blacklist:', err);
        }
    };

    const openEditModal = (contact: Contact) => {
        setSelectedContact(contact);
        setFormData({
            jid: contact.jid,
            name: contact.pushName || '',
            accountId: contact.account.id,
            isBlacklisted: contact.isBlacklisted
        });
        setIsEditModalOpen(true);
    };

    const maskText = (text: string) => isPrivateMode ? '********' : text;

    const filteredContacts = contacts.filter(c =>
        (c.pushName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.jid.includes(searchTerm))
    );

    return (
        <div className="p-8 h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Directorio de Contactos</h2>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Gestiona tus contactos y configura reglas de IA.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar contacto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        />
                        <svg className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nuevo Contacto
                    </button>

                    <button
                        onClick={loadContacts}
                        className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <svg className={`h-6 w-6 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/50 backdrop-blur z-10">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-16">Av.</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contacto</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cuenta Origen</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">IA Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredContacts.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-20 text-center text-gray-500">
                                    No se encontraron contactos.
                                </td>
                            </tr>
                        )}
                        {filteredContacts.map((contact) => (
                            <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                        {(contact.pushName || contact.jid).substring(0, 2).toUpperCase()}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                                        {maskText(contact.pushName || 'WhatsApp User')}
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                        {maskText(contact.jid.split('@')[0])}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                                        {maskText(contact.account.name)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => toggleBlacklist(contact)}
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${contact.isBlacklisted
                                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                            : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                                            }`}
                                    >
                                        {contact.isBlacklisted ? '🚫 IA BLOQUEADA' : '✨ IA ACTIVA'}
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => loadConversationHistory(contact)}
                                            className="p-2 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                            title="Ver Conversación"
                                        >
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => openEditModal(contact)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => deleteContact(contact)}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Panel de Memoria de Conversación */}
            {viewingConversation && (
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                    {(viewingConversation.pushName || viewingConversation.jid).substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        💬 Memoria de Conversación
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {maskText(viewingConversation.pushName || 'WhatsApp User')} • {maskText(viewingConversation.jid.split('@')[0])}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setViewingConversation(null); setConversationHistory([]); }}
                                className="p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <svg className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="p-6 max-h-[600px] overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20">
                        {loadingConversation ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
                                    <p className="text-sm text-gray-500">Cargando conversación...</p>
                                </div>
                            </div>
                        ) : conversationHistory.length === 0 ? (
                            <div className="text-center py-20">
                                <svg className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <p className="text-gray-500 dark:text-gray-400">No hay mensajes en el historial</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {conversationHistory.map((msg: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === 'assistant'
                                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold opacity-75">
                                                    {msg.role === 'assistant' ? '🤖 IA' : '👤 Usuario'}
                                                </span>
                                                <span className={`text-[10px] ${msg.role === 'assistant' ? 'text-blue-100' : 'text-gray-400'}`}>
                                                    {new Date(msg.createdAt).toLocaleString('es-ES', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                {msg.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>📊 Total de mensajes: {conversationHistory.length}</span>
                            <button
                                onClick={() => loadConversationHistory(viewingConversation)}
                                className="flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Actualizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Creación / Edición */}
            {(isCreateModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/20 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/50">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {isCreateModalOpen ? '➕ Nuevo Contacto' : '📝 Editar Contacto'}
                            </h3>
                            <button
                                onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                            >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={isCreateModalOpen ? handleCreateContact : handleUpdateContact} className="p-6 space-y-4">
                            {isCreateModalOpen && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cuenta de WhatsApp</label>
                                        <select
                                            required
                                            value={formData.accountId}
                                            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        >
                                            <option value="">Selecciona una cuenta...</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.phoneNumber})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Número de Teléfono / JID</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ej: 34600000000"
                                            value={formData.jid}
                                            onChange={(e) => setFormData({ ...formData, jid: e.target.value })}
                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre / Alias</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Nombre del contacto"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
                                <input
                                    type="checkbox"
                                    id="isBlacklisted"
                                    checked={formData.isBlacklisted}
                                    onChange={(e) => setFormData({ ...formData, isBlacklisted: e.target.checked })}
                                    className="h-5 w-5 rounded-md text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <label htmlFor="isBlacklisted" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    🚫 Bloquear respuestas de IA
                                </label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
                                >
                                    {isCreateModalOpen ? 'Crear' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
