import { prisma } from './lib/prisma';

async function debug() {
    console.log('prisma is defined:', !!prisma);
    if (prisma) {
        console.log('Available models:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
        console.log('contact exists:', !!(prisma as any).contact);
        if ((prisma as any).contact) {
            console.log('contact has upsert:', typeof (prisma as any).contact.upsert);
        }
    }
    process.exit(0);
}

debug();
