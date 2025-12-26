import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token');

        if (!token) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = verifyToken(token.value);
        const { name, email } = await request.json();

        if (!name || !email) {
            return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 });
        }

        // Verificar si el email ya está en uso por otro usuario
        const existingUser = await prisma.user.findFirst({
            where: {
                email,
                NOT: { id: payload.userId }
            }
        });

        if (existingUser) {
            return NextResponse.json({ error: 'El email ya está en uso' }, { status: 400 });
        }

        const updatedUser = await prisma.user.update({
            where: { id: payload.userId },
            data: { name, email },
            select: {
                id: true,
                email: true,
                name: true,
            }
        });

        return NextResponse.json({ user: updatedUser });
    } catch (error) {
        console.error('Update profile error:', error);
        return NextResponse.json({ error: 'Error al actualizar el perfil' }, { status: 500 });
    }
}
