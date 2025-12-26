import { NextResponse } from 'next/server';
import { getSession } from '@/lib/whatsapp';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'ID de sesión requerido' },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);

    if (!session) {
      console.log(`⚠️ Sesión ${sessionId} no encontrada en esta instancia. Polling...`);
      return NextResponse.json(
        {
          status: 'not_found',
          error: 'Sesión no encontrada en esta instancia',
          details: 'Si estás en Vercel, esto es normal por la naturaleza serverless. Reintente.'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      phoneNumber: session.phoneNumber,
      error: session.error,
      retryCount: session.retryCount,
    }, { status: 200 });
  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json(
      { error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
