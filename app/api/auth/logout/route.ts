import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json(
    { message: 'Sesión cerrada exitosamente' },
    { status: 200 }
  );

  // Eliminar cookie de autenticación
  response.cookies.delete('auth-token');

  return response;
}
