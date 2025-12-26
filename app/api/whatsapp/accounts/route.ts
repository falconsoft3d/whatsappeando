import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// GET - Obtener todas las cuentas del usuario
export async function GET(request: NextRequest) {
  try {
    // Intentar obtener token desde header o cookie shadow
    let token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('auth-token')?.value;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Token no proporcionado' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    const accounts = await prisma.whatsAppAccount.findMany({
      where: { userId: decoded.userId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error) {
    console.error('Error getting accounts:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuentas' },
      { status: 500 }
    );
  }
}

// POST - Crear o actualizar cuenta
export async function POST(request: NextRequest) {
  try {
    // Intentar obtener token desde header o cookie shadow
    let token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('auth-token')?.value;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Token no proporcionado' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Token inválido o expirado', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, phoneNumber, description, sessionId, status, webhookUrl, apiToken, apiEnabled } = body;

    if (!name || !phoneNumber) {
      return NextResponse.json(
        { error: 'Nombre y número de teléfono son requeridos' },
        { status: 400 }
      );
    }

    // Normalizar número de teléfono (solo dígitos)
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');

    // Verificar si ya existe una cuenta con ese número (buscamos por el limpio o el original por si acaso)
    const existingAccount = await prisma.whatsAppAccount.findFirst({
      where: {
        userId: decoded.userId,
        OR: [
          { phoneNumber: cleanPhoneNumber },
          { phoneNumber: phoneNumber }
        ]
      }
    });

    let account;
    try {
      const isApiEnabled = apiEnabled === true || apiEnabled === 'true';

      if (existingAccount) {
        // Actualizar cuenta existente usando SQL puro para evitar el error de argumentos desconocidos
        await prisma.$executeRawUnsafe(
          `UPDATE "whatsapp_accounts" SET 
            "name" = $1, 
            "description" = $2, 
            "webhookUrl" = $3, 
            "apiToken" = $4, 
            "apiEnabled" = $5,
            "status" = $6,
            "sessionId" = $7,
            "updatedAt" = NOW()
          WHERE "id" = $8`,
          name || existingAccount.name,
          description !== undefined ? description : (existingAccount as any).description,
          webhookUrl || null,
          apiToken || null,
          isApiEnabled,
          status || (existingAccount as any).status,
          sessionId || (existingAccount as any).sessionId,
          existingAccount.id
        );

        // Obtener el objeto actualizado para devolverlo
        account = await prisma.whatsAppAccount.findUnique({ where: { id: existingAccount.id } });

        // Sincronizar con la sesión en memoria si existe
        if (sessionId || (account as any).sessionId) {
          const sId = sessionId || (account as any).sessionId;
          const { updateSessionConfig } = await import('@/lib/whatsapp');
          updateSessionConfig(sId, {
            webhookUrl: webhookUrl || undefined,
            apiToken: apiToken || undefined,
            apiEnabled: isApiEnabled
          });
        }
      } else {
        // Crear nueva cuenta usando SQL puro
        const newId = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "whatsapp_accounts" 
            ("id", "name", "phoneNumber", "description", "status", "sessionId", "webhookUrl", "apiToken", "apiEnabled", "userId", "updatedAt")
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          newId,
          name,
          cleanPhoneNumber,
          description || null,
          'disconnected',
          sessionId || null,
          webhookUrl || null,
          apiToken || null,
          isApiEnabled,
          decoded.userId
        );

        account = await prisma.whatsAppAccount.findUnique({ where: { id: newId } });
      }
    } catch (prismaError) {
      console.error('Prisma Error:', prismaError);
      return NextResponse.json(
        {
          error: 'Error de base de datos',
          details: prismaError instanceof Error ? prismaError.message : String(prismaError)
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ account }, { status: 200 });
  } catch (error) {
    console.error('Error creating/updating account:', error);
    return NextResponse.json(
      {
        error: 'Error al guardar cuenta',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
