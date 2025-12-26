import { prisma } from './lib/prisma';

async function checkAIConfigs() {
    try {
        const configs = await prisma.aiConfiguration.findMany({
            include: {
                account: true
            }
        });

        console.log('📊 Configuraciones de IA encontradas:', configs.length);

        for (const config of configs) {
            console.log('\n---');
            console.log('Account:', config.account.name);
            console.log('Enabled:', config.enabled);
            console.log('Provider:', config.provider);
            console.log('Respond to new:', (config as any).respondToNewContacts);
            console.log('Respond to existing:', (config as any).respondToExistingContacts);
            console.log('Allowed phone numbers:', (config as any).allowedPhoneNumbers);
            console.log('Type of allowedPhoneNumbers:', typeof (config as any).allowedPhoneNumbers);
        }

        // Actualizar todas las configuraciones que no tengan allowedPhoneNumbers
        const updateResult = await prisma.aiConfiguration.updateMany({
            where: {
                OR: [
                    { allowedPhoneNumbers: null },
                    { allowedPhoneNumbers: undefined }
                ]
            },
            data: {
                allowedPhoneNumbers: []
            }
        });

        console.log('\n✅ Configuraciones actualizadas:', updateResult.count);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAIConfigs();
