import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generar nombre único
        const ext = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const path = join(process.cwd(), 'public/uploads', fileName);

        await writeFile(path, buffer);

        // Obtener la URL base (en desarrollo http://localhost:3000)
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const fileUrl = `${baseUrl}/uploads/${fileName}`;

        return NextResponse.json({
            success: true,
            url: fileUrl,
            name: file.name,
            size: file.size,
            type: file.type
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 });
    }
}
