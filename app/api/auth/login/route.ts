import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';
import { generateToken } from '@/lib/jwt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const user = await loginUser({ email, password });

    // Generar token JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Crear respuesta con cookie Y token en body
    const response = NextResponse.json({ 
      user,
      token // Incluir token para uso en localStorage
    }, { status: 200 });
    
    // Establecer cookie con el token
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al iniciar sesión' },
      { status: 401 }
    );
  }
}
