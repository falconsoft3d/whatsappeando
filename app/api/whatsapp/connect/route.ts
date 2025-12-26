import { NextResponse } from 'next/server';
import { generateQR } from '@/lib/whatsapp';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60; // Allow up to 60 seconds for QR generation and initial connection

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, phoneNumber } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'ID de cuenta requerido' },
        { status: 400 }
      );
    }

    // Obtener el nombre del usuario desde la base de datos
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
      include: { user: true }
    });

    const userName = account?.user?.name;

    // Generar código QR para la sesión
    const sessionId = `${accountId}-${Date.now()}`;
    const qrData = await generateQR(sessionId, userName);

    return NextResponse.json({
      sessionId,
      qr: qrData,
      status: 'pending',
    }, { status: 200 });
  } catch (error) {
    console.error('Error generating QR:', error);
    return NextResponse.json(
      { error: 'Error al generar código QR' },
      { status: 500 }
    );
  }
}
