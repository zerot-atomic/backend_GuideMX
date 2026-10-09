import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { PlaceImagesService } from '../src/place-images/place-images.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Busca y guarda en la base de datos la miniatura de cada lugar existente.
// No necesita login ni token de admin. Uso (dentro de /backend): npm run sync-images
async function main() {
  const prisma = new PrismaClient();
  const servicio = new PlaceImagesService(prisma as unknown as PrismaService);

  console.log('Buscando miniaturas, esto tarda un par de minutos...');
  const r = await servicio.syncAll();

  console.log(`\nTotal de lugares: ${r.total}`);
  console.log(`Con miniatura:    ${r.conImagen}`);
  console.log(`Sin miniatura:    ${r.sinImagen.length}`);
  if (r.sinImagen.length) console.log('Lugares sin miniatura:', r.sinImagen.join(', '));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
