import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../prisma/prisma.service';

async function main() {
  console.log("=== Start Phantom Hash Deletion ===");
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  
  const hash = "1cbde11923290b229a030f1257373d56794ef68f614c93c0620841bc03c996dc";
  const hashBuffer = Buffer.from(hash, 'hex');

  try {
    const records = await prisma.transaction.findMany({
      where: { txHash: hashBuffer }
    });

    if (records.length > 0) {
      console.log(`Found ${records.length} records matching the hash. Deleting...`);
      for (const record of records) {
        await prisma.transaction.delete({
          where: { id: record.id }
        });
        console.log(`Deleted Transaction ID: ${record.id}`);
      }
    } else {
      console.log(`No records found for hash 0x${hash}. Already deleted or does not exist.`);
    }
  } catch (error) {
    console.error("Error during deletion:", error);
  } finally {
    await app.close();
  }
}

main().catch(err => {
    console.error('[DeletePhantomHash] Unhandled Error:', err);
    process.exit(0); // Exit 0 so the container start doesn't crash if this fails
});
