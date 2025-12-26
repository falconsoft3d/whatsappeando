import { NextRequest, NextResponse } from 'next/server';
import { resetPassword, verifyResetToken } from '@/lib/passwordReset';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const { token, password } = JSON.parse(body);

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token y contraseña son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Verificar que el token sea válido
    const isValid = await verifyResetToken(token);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 400 }
      );
    }

    await resetPassword(token, password);

    return NextResponse.json({
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al resetear contraseña' },
      { status: 500 }
    );
  }
}
