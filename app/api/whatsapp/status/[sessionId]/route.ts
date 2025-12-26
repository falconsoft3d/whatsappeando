import { NextResponse } from 'next/server';
import { getSession } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';

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
      // Fallback: Buscar en la base de datos si la sesión está marcada como conectada
      try {
        const account = await prisma.whatsAppAccount.findFirst({
          where: { sessionId: sessionId }
        });

        if (account && account.status === 'connected') {
          return NextResponse.json({
            sessionId: account.sessionId,
            status: 'connected',
            phoneNumber: account.phoneNumber,
            error: null,
            retryCount: 0,
          }, { status: 200 });
        }
      } catch (dbErr) {
        console.error('Error checking DB fallback:', dbErr);
      }

      return NextResponse.json(
        {
          status: 'searching',
          message: 'Buscando sesión en las instancias del servidor...'
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      phoneNumber: session.phoneNumber,
      error: session.error,
      retryCount: session.retryCount,
      logs: session.logs || []
    }, { status: 200 });
  } catch (error) {
    console.error('Error checking status:', error);
    return NextResponse.json(
      { error: 'Error al verificar estado' },
      { status: 500 }
    );
  }
}
