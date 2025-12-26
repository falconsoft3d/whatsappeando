'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
    const [isPrivateMode, setIsPrivateMode] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('privateMode') === 'true';
        setIsPrivateMode(saved);
    }, []);

    const togglePrivateMode = (enabled: boolean) => {
        setIsPrivateMode(enabled);
        localStorage.setItem('privateMode', String(enabled));
        // Disparar un evento para que otras pestañas/componentes se enteren
        window.dispatchEvent(new Event('storage'));
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Configuración</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Personaliza tu experiencia y seguridad en el panel.
                </p>
            </div>

            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Modo Privado</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Oculta nombres y números de teléfono en toda la interfaz con asteriscos.
                            </p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={isPrivateMode}
                                onChange={(e) => togglePrivateMode(e.target.checked)}
                            />
                            <div className={`h-6 w-11 rounded-full transition-colors ${isPrivateMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                <div className={`absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${isPrivateMode ? 'translate-x-[20px]' : ''}`}></div>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <div className="flex gap-3">
                        <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            El Modo Privado es útil si estás grabando pantalla o compartiendo tu panel con otros. Solo afecta a la visualización, no a la funcionalidad del sistema.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
