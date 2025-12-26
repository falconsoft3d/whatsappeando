import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        if (!accountId) {
            return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }

        const config = await prisma.aiConfiguration.findUnique({
            where: { accountId }
        });

        return NextResponse.json({ config }, { status: 200 });
    } catch (error) {
        console.error('Error getting AI config:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            accountId,
            enabled,
            provider,
            apiKey,
            model,
            ollamaUrl,
            ollamaModel,
            systemPrompt
        } = body;

        if (!accountId) {
            return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }

        console.log('Incoming AI config POST for account:', accountId);

        let config;
        const existingConfig = await prisma.aiConfiguration.findUnique({
            where: { accountId }
        });

        if (existingConfig) {
            config = await prisma.aiConfiguration.update({
                where: { accountId },
                data: {
                    enabled,
                    provider,
                    apiKey,
                    model,
                    ollamaUrl,
                    ollamaModel,
                    systemPrompt,
                }
            });
            console.log('AI config updated:', config.id);
        } else {
            config = await prisma.aiConfiguration.create({
                data: {
                    accountId,
                    enabled,
                    provider,
                    apiKey,
                    model,
                    ollamaUrl,
                    ollamaModel,
                    systemPrompt,
                }
            });
            console.log('AI config created:', config.id);
        }

        return NextResponse.json({ config }, { status: 200 });
    } catch (error) {
        console.error('CRITICAL ERROR saving AI config:', error);
        return NextResponse.json({
            error: 'Error al guardar la configuración',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
