import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { cookies } from 'next/headers';
// Importamos algo de whatsapp si fuera necesario, pero por ahora lo sacaremos de la DB
// y de las sesiones activas si exportamos una función

export async function GET(request: NextRequest) {
    try {
        // Verificar token
        let token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
            const cookieStore = await cookies();
            token = cookieStore.get('auth-token')?.value;
        }

        if (!token || !verifyToken(token)) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const decoded = verifyToken(token) as any;
        const userId = decoded.id;

        // 1. Total de cuentas en DB para este usuario
        const totalAccounts = await prisma.whatsAppAccount.count({
            where: { userId }
        });

        // 2. Cuentas conectadas (según DB)
        const connectedAccounts = await prisma.whatsAppAccount.count({
            where: {
                userId,
                status: 'connected'
            }
        });

        // 3. API habilitada
        const apiEnabledAccounts = await prisma.whatsAppAccount.count({
            where: {
                userId,
                apiEnabled: true
            } as any
        });

        return NextResponse.json({
            stats: {
                totalAccounts,
                connectedAccounts,
                apiEnabledAccounts,
                // Podríamos agregar más cosas como mensajes enviados si tuviéramos una tabla
                totalMessages: 0
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
    }
}
