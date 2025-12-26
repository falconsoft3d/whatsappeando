import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('📬 Webhook de Prueba recibido:', body);

        return NextResponse.json({
            success: true,
            received: true,
            timestamp: new Date().toISOString()
        }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
}
