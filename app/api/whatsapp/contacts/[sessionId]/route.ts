import { NextResponse } from 'next/server';
import { getContacts } from '@/lib/whatsapp';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;

        if (!sessionId) {
            return NextResponse.json(
                { error: 'SessionId requerido' },
                { status: 400 }
            );
        }

        const contacts = await getContacts(sessionId);

        return NextResponse.json({ contacts }, { status: 200 });
    } catch (error) {
        console.error('Error getting contacts:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error al obtener contactos' },
            { status: 500 }
        );
    }
}
