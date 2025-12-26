import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { getSessions } from '@/lib/whatsapp';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token');

        if (!token) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = verifyToken(token.value);
        if (!payload) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        const sessions = getSessions();
        const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
            id,
            status: session.status,
            hasSocket: !!session.socket,
            hasStore: !!session.store,
            timestamp: session.timestamp,
            apiEnabled: session.apiEnabled,
            webhookUrl: session.webhookUrl ? '✓' : '✗'
        }));

        return NextResponse.json({
            sessions: sessionList,
            total: sessionList.length,
            connected: sessionList.filter(s => s.status === 'connected').length
        });
    } catch (error) {
        console.error('Session status error:', error);
        return NextResponse.json({ error: 'Error al obtener estado de sesiones' }, { status: 500 });
    }
}
