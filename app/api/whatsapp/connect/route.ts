import { NextResponse } from 'next/server';
import { generateQR } from '@/lib/whatsapp';

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

    // Generar código QR para la sesión
    const sessionId = `${accountId}-${Date.now()}`;
    const qrData = await generateQR(sessionId);

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
