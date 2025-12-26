import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, phoneNumber, to, message, media, apiToken } = body;

    // El cliente puede usar 'to' o 'phoneNumber'
    const targetPhone = to || phoneNumber;
    const targetSession = sessionId;

    if (!targetPhone || (!message && !media)) {
      return NextResponse.json(
        { error: 'Debe proporcionar phoneNumber/to y un message o media' },
        { status: 400 }
      );
    }

    // Si se provee apiToken, validar contra la base de datos
    if (apiToken) {
      const account = await prisma.whatsAppAccount.findFirst({
        where: {
          OR: [
            { sessionId: targetSession },
            { phoneNumber: String(targetSession) } // A veces el sessionId es el telefono
          ],
          apiToken: apiToken,
          apiEnabled: true
        } as any
      });

      if (!account) {
        return NextResponse.json(
          { error: 'API Desactivada o Token Inválido' },
          { status: 401 }
        );
      }

      // Asegurarnos de usar el sessionId correcto de la cuenta
      const effectiveSessionId = account.sessionId;
      if (!effectiveSessionId) {
        return NextResponse.json(
          { error: 'La cuenta no tiene una sesión activa' },
          { status: 400 }
        );
      }

      const success = await sendMessage(effectiveSessionId, targetPhone, message, media);

      // Guardar Log API
      await prisma.apiMessageLog.create({
        data: {
          to: targetPhone,
          message: message || '',
          mediaUrl: media?.url,
          mediaType: media?.type,
          status: success ? 'sent' : 'error',
          accountId: account.id,
          errorMessage: success ? null : 'Error en el envío de Baileys'
        }
      });

      return NextResponse.json({ success, message: success ? 'Enviado' : 'Error en el envío' });
    }

    // Flujo normal (UI del chat) - requiere sessionId
    if (!targetSession) {
      return NextResponse.json({ error: 'sessionId requerido' }, { status: 400 });
    }

    const success = await sendMessage(targetSession, targetPhone, message, media);
    return NextResponse.json({ success, message: success ? 'Enviado' : 'Error en el envío' });

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al enviar mensaje' },
      { status: 500 }
    );
  }
}
