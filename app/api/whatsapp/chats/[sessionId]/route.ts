import { NextResponse } from 'next/server';
import { getChats } from '@/lib/whatsapp';

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

    const chats = await getChats(sessionId);

    return NextResponse.json({ chats }, { status: 200 });
  } catch (error) {
    console.error('Error getting chats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener chats' },
      { status: 500 }
    );
  }
}
