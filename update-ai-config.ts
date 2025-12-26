import { prisma } from './lib/prisma';

async function updateAiConfigs() {
    console.log('🔧 Actualizando configuraciones de IA...');

    // Actualizar TODAS las configuraciones
    const result = await prisma.aiConfiguration.updateMany({
        data: {
            respondToNewContacts: true,
            respondToExistingContacts: true
        }
    });

    console.log(`✅ Actualizadas ${result.count} configuraciones`);

    const allConfigs = await prisma.aiConfiguration.findMany();
    console.log('\n📋 Configuraciones actuales:');
    allConfigs.forEach(config => {
        console.log(`  - Account: ${config.accountId}`);
        console.log(`    Enabled: ${config.enabled}`);
        console.log(`    Respond to new: ${(config as any).respondToNewContacts}`);
        console.log(`    Respond to existing: ${(config as any).respondToExistingContacts}`);
    });

    process.exit(0);
}

updateAiConfigs().catch(console.error);
