import { prisma } from './lib/prisma';

async function main() {
    const account = await prisma.whatsAppAccount.findFirst();
    if (!account) {
        console.log('No account found to test');
        process.exit(1);
    }

    console.log('Testing upsert for account:', account.id);
    try {
        const config = await prisma.aiConfiguration.upsert({
            where: { accountId: account.id },
            update: {
                enabled: true,
                provider: 'chatgpt',
                systemPrompt: 'Test prompt'
            },
            create: {
                accountId: account.id,
                enabled: true,
                provider: 'chatgpt',
                systemPrompt: 'Test prompt'
            }
        });
        console.log('Upsert successful:', config);
    } catch (error) {
        console.error('Upsert failed:', error);
    }
    process.exit(0);
}

main();
