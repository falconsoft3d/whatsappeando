import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token');

        if (!token) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = verifyToken(token.value);

        // Obtener logs de todas las cuentas del usuario
        const logs = await prisma.apiMessageLog.findMany({
            where: {
                account: {
                    userId: payload.userId
                }
            },
            include: {
                account: {
                    select: {
                        name: true,
                        phoneNumber: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 100 // Limitar a los últimos 100
        });

        return NextResponse.json({ logs });
    } catch (error) {
        console.error('Fetch API logs error:', error);
        return NextResponse.json({ error: 'Error al obtener los logs' }, { status: 500 });
    }
}
