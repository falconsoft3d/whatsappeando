import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanPhones() {
    const accounts = await prisma.whatsAppAccount.findMany();
    console.log(`Encontradas ${accounts.length} cuentas.`);

    for (const account of accounts) {
        const cleaned = account.phoneNumber.replace(/\D/g, '');
        if (cleaned !== account.phoneNumber) {
            console.log(`Limpiando: ${account.phoneNumber} -> ${cleaned}`);
            try {
                await prisma.whatsAppAccount.update({
                    where: { id: account.id },
                    data: { phoneNumber: cleaned }
                });
            } catch (err) {
                console.error(`Error limpiando ${account.id}:`, err);
            }
        }
    }
}

cleanPhones()
    .then(() => {
        console.log('Limpieza completada.');
        process.exit(0);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
