import { NextRequest, NextResponse } from 'next/server';
import { generateResetToken } from '@/lib/passwordReset';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const { email } = JSON.parse(body);

    if (!email) {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      );
    }

    const resetToken = await generateResetToken(email);

    // En producción, aquí enviarías un email con el enlace
    // Por ahora, retornamos el token para desarrollo
    const resetUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    return NextResponse.json({
      message: 'Se ha enviado un enlace de recuperación a tu email',
      // En producción, NO deberías retornar el resetUrl
      resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
    });

  } catch (error) {
    console.error('Error al solicitar reset:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar solicitud' },
      { status: 500 }
    );
  }
}
