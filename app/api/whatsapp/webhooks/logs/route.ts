import { NextResponse } from 'next/server';
import { getWebhookLogs } from '@/lib/whatsapp';

export async function GET() {
    try {
        const logs = getWebhookLogs();
        return NextResponse.json({ logs }, { status: 200 });
    } catch (error) {
        console.error('Error getting webhook logs:', error);
        return NextResponse.json({ error: 'Error al obtener logs' }, { status: 500 });
    }
}
