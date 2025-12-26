'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAccounts: 0,
    connectedAccounts: 0,
    apiEnabledAccounts: 0,
    totalMessages: 0
  });
  const [steps, setSteps] = useState({
    accountCreated: false,
    accountConnected: false,
    firstMessageSent: false
  });

  useEffect(() => {
    // Verificar autenticación
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          throw new Error('No autenticado');
        }
        const data = await response.json();
        setUser(data.user);
        setLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/login');
      }
    };

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          if (data.steps) {
            setSteps(data.steps);
          }
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };

    checkAuth().then(() => {
      fetchStats();
    });
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Hola, <span className="font-bold text-blue-600 dark:text-blue-400">{user?.name}</span>. Bienvenido a tu panel de control.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Card: Total Accounts */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Cuentas</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.totalAccounts}
              </h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-900/20">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Registradas en el sistema
          </p>
        </div>

        {/* Card: Connected */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-green-500/5 group-hover:bg-green-500/10 transition-colors" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Conectadas</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.connectedAccounts}
              </h3>
            </div>
            <div className={`rounded-xl p-3 ${stats.connectedAccounts > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
              <svg className={`h-6 w-6 ${stats.connectedAccounts > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${stats.connectedAccounts > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
            Listas para enviar/recibir
          </p>
        </div>

        {/* Card: API Enabled */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">API Gateway</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.apiEnabledAccounts}
              </h3>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 dark:bg-purple-900/20">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Cuentas con webhook activo
          </p>
        </div>

        {/* Card: System Health */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-orange-500/5 group-hover:bg-orange-500/10 transition-colors" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Salud Sistema</p>
              <h3 className={`text-xl font-bold mt-2 ${stats.connectedAccounts > 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-500'}`}>
                {stats.connectedAccounts > 0 ? 'Excelente' : 'Sin Conexión'}
              </h3>
            </div>
            <div className="rounded-xl bg-orange-50 p-3 dark:bg-orange-900/20">
              <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Última comprobación: ahora mismo
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Primeros Pasos
        </h3>
        <ul className="space-y-4">
          <li className="flex items-start">
            <div className={`h-6 w-6 mr-3 shrink-0 rounded-full flex items-center justify-center ${steps.accountCreated ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className={`text-sm ${steps.accountCreated ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500'}`}>
              Cuenta creada exitosamente
            </span>
          </li>
          <li className="flex items-start">
            <div className={`h-6 w-6 mr-3 shrink-0 rounded-full flex items-center justify-center ${steps.accountConnected ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className={`text-sm ${steps.accountConnected ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500'}`}>
                Conectar tu primera cuenta de WhatsApp
              </span>
              {!steps.accountConnected && (
                <a href="/dashboard/accounts" className="text-xs text-blue-600 hover:underline mt-1">Ir a Cuentas →</a>
              )}
            </div>
          </li>
          <li className="flex items-start">
            <div className={`h-6 w-6 mr-3 shrink-0 rounded-full flex items-center justify-center ${steps.firstMessageSent ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className={`text-sm ${steps.firstMessageSent ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500'}`}>
                Enviar tu primer mensaje (vía API)
              </span>
              {!steps.firstMessageSent && (
                <a href="/dashboard/api-test" className="text-xs text-blue-600 hover:underline mt-1">Ir a Prueba API →</a>
              )}
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
