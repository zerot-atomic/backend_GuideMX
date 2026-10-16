import { PrismaClient } from '@prisma/client';
import { LUGARES } from './lugares-data';

const prisma = new PrismaClient();
const CATEGORIAS: Record<string, string> = {
  H: 'Histórico', A: 'Arqueológico', C: 'Cultural', N: 'Natural', R: 'Religioso',
  G: 'Gastronomía', S: 'Hospedaje',
};
// Categorías nuevas que se crean si aún no existen.
const CATEGORIAS_NUEVAS = [
  { name: 'Gastronomía', icon: 'restaurant' },
  { name: 'Hospedaje', icon: 'hotel' },
];

// Agrega lugares turísticos de todo México. No duplica: si el nombre ya existe, lo salta.
// Uso (dentro de /backend): npm run seed:lugares   y después   npm run sync-images
async function main() {
  for (const cat of CATEGORIAS_NUEVAS) {
    await prisma.category.upsert({ where: { name: cat.name }, update: {}, create: cat });
  }
  let nuevos = 0;
  let saltados = 0;
  for (const [name, stateName, municipality, latitude, longitude, cats, corta, relevanceScore] of LUGARES) {
    if (await prisma.place.findFirst({ where: { name } })) { saltados++; continue; }

    const estado = await prisma.state.findUnique({ where: { name: stateName } });
    if (!estado) { console.warn(`Estado no encontrado: ${stateName} (${name})`); continue; }

    const categorias = await prisma.category.findMany({
      where: { name: { in: [...cats].map((c) => CATEGORIAS[c]) } },
    });

    await prisma.place.create({
      data: {
        name,
        shortDescription: corta,
        longDescription: `${corta} Ubicado en ${municipality}, ${stateName}.`,
        latitude,
        longitude,
        address: `${municipality}, ${stateName}`,
        stateId: estado.id,
        municipality,
        relevanceScore,
        isPublished: true,
        categories: { create: categorias.map((c) => ({ categoryId: c.id })) },
      },
    });
    nuevos++;
  }
  console.log(`Lugares nuevos: ${nuevos} | ya existían: ${saltados}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());