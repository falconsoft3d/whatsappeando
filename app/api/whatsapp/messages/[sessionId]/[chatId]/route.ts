import { NextResponse } from 'next/server';
import { getChatMessages } from '@/lib/whatsapp';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; chatId: string }> }
) {
  try {
    const { sessionId, chatId } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    if (!sessionId || !chatId) {
      return NextResponse.json(
        { error: 'SessionId y chatId son requeridos' },
        { status: 400 }
      );
    }

    const messages = await getChatMessages(sessionId, decodeURIComponent(chatId), limit);

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    console.error('Error getting messages:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener mensajes' },
      { status: 500 }
    );
  }
}
