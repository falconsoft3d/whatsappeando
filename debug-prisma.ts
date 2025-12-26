import { prisma } from './lib/prisma';

async function main() {
    try {
        const result = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
        console.log('Tables in database:', result);
    } catch (error) {
        console.error('Error querying tables:', error);
    }
    process.exit(0);
}

main();
