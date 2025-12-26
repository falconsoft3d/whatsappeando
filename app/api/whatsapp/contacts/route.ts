import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET - Listar contactos vinculados a las cuentas del usuario
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

        const contacts = await prisma.contact.findMany({
            where: {
                account: {
                    userId: payload.userId
                }
            },
            include: {
                account: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        return NextResponse.json({ contacts });
    } catch (error) {
        console.error('Fetch contacts error:', error);
        return NextResponse.json({ error: 'Error al obtener contactos' }, { status: 500 });
    }
}

// PATCH - Alternar lista negra del contacto
export async function PATCH(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token');

        if (!token) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const payload = verifyToken(token.value);
        if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

        const body = await request.json();
        const { contactId, isBlacklisted } = body;

        if (!contactId) {
            return NextResponse.json({ error: 'ID de contacto requerido' }, { status: 400 });
        }

        // Verificar que el contacto pertenezca a una cuenta del usuario
        const contact = await prisma.contact.findFirst({
            where: {
                id: contactId,
                account: {
                    userId: payload.userId
                }
            }
        });

        if (!contact) {
            return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 });
        }

        const updated = await prisma.contact.update({
            where: { id: contactId },
            data: { isBlacklisted }
        });

        return NextResponse.json({ contact: updated });
    } catch (error) {
        console.error('Toggle blacklist error:', error);
        return NextResponse.json({ error: 'Error al actualizar contacto' }, { status: 500 });
    }
}
// POST - Crear un nuevo contacto manualmente
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token');

        if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        const payload = verifyToken(token.value);
        if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

        const body = await request.json();
        const { jid, name, accountId, isBlacklisted } = body;

        if (!jid || !accountId) {
            return NextResponse.json({ error: 'JID y accountId son requeridos' }, { status: 400 });
        }

        // Formatear JID si es solo un número
        let finalJid = jid;
        if (!finalJid.includes('@')) {
            finalJid = `${finalJid.replace(/\D/g, '')}@s.whatsapp.net`;
        }

        // Verificar que la cuenta pertenezca al usuario
        const account = await prisma.whatsAppAccount.findFirst({
            where: { id: accountId, userId: payload.userId }
        });

        if (!account) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

        const contact = await prisma.contact.upsert({
            where: {
                jid_accountId: {
                    jid: finalJid,
                    accountId: accountId
                }
            },
            update: {
                pushName: name || undefined,
                isBlacklisted: isBlacklisted ?? false
            },
            create: {
                jid: finalJid,
                pushName: name || null,
                accountId: accountId,
                isBlacklisted: isBlacklisted ?? false
            }
        });

        return NextResponse.json({ contact });
    } catch (error) {
        console.error('Create contact error:', error);
        return NextResponse.json({ error: 'Error al crear contacto' }, { status: 500 });
    }
}

// PUT - Editar un contacto existente
export async function PUT(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token');

        if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        const payload = verifyToken(token.value);
        if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

        const body = await request.json();
        const { id, name, isBlacklisted } = body;

        if (!id) return NextResponse.json({ error: 'ID de contacto requerido' }, { status: 400 });

        // Verificar que el contacto pertenezca a una cuenta del usuario
        const contact = await prisma.contact.findFirst({
            where: {
                id: id,
                account: { userId: payload.userId }
            }
        });

        if (!contact) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 });

        const updated = await prisma.contact.update({
            where: { id: id },
            data: {
                pushName: name,
                isBlacklisted: isBlacklisted ?? contact.isBlacklisted
            }
        });

        return NextResponse.json({ contact: updated });
    } catch (error) {
        console.error('Update contact error:', error);
        return NextResponse.json({ error: 'Error al actualizar contacto' }, { status: 500 });
    }
}

// DELETE - Eliminar un contacto
export async function DELETE(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token');

        if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        const payload = verifyToken(token.value);
        if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID de contacto requerido' }, { status: 400 });

        const contact = await prisma.contact.findFirst({
            where: {
                id: id,
                account: { userId: payload.userId }
            }
        });

        if (!contact) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 });

        await prisma.contact.delete({ where: { id: id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete contact error:', error);
        return NextResponse.json({ error: 'Error al eliminar contacto' }, { status: 500 });
    }
}
