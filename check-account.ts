import { prisma } from './lib/prisma';

async function main() {
    const id = '72fa413f-c428-4631-b208-f46835939a4f';
    const account = await prisma.whatsAppAccount.findUnique({ where: { id } });
    console.log('Account exists?', !!account);
    process.exit(0);
}

main();
