import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Verificar si el registro está permitido
    if (process.env.NEXT_PUBLIC_ALLOW_REGISTRATION === 'false') {
      return NextResponse.json(
        { error: 'El registro de nuevos usuarios está deshabilitado temporalmente' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    const user = await registerUser({ name, email, password });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar usuario' },
      { status: 400 }
    );
  }
}
