import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token');

        if (!token) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = verifyToken(token.value);
        if (!payload) {
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');
        const contactJid = searchParams.get('contactJid');

        const where: any = {
            account: {
                userId: payload.userId
            }
        };

        if (accountId) {
            where.accountId = accountId;
        }

        if (contactJid) {
            where.from = contactJid;
        }

        const messages = await prisma.chatMessage.findMany({
            where,
            include: {
                account: {
                    select: {
                        name: true,
                        phoneNumber: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            },
            take: 200
        });

        return NextResponse.json({ messages });
    } catch (error) {
        console.error('Fetch global messages error:', error);
        return NextResponse.json({ error: 'Error al obtener el historial de mensajes' }, { status: 500 });
    }
}
