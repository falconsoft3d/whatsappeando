import { prisma } from '../lib/prisma';

async function test() {
    try {
        const account = await prisma.whatsAppAccount.findFirst();
        console.log('Account found:', account);
        if (account) {
            console.log('Columns check:');
            console.log('webhookUrl:', (account as any).webhookUrl);
            console.log('apiToken:', (account as any).apiToken);
            console.log('apiEnabled:', (account as any).apiEnabled);
        }
    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        process.exit(0);
    }
}

test();
