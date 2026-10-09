import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ESTADOS = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
  'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
  'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
  'Zacatecas',
];

const CATEGORIAS = [
  { name: 'Histórico', icon: 'history' },
  { name: 'Arqueológico', icon: 'temple' },
  { name: 'Cultural', icon: 'museum' },
  { name: 'Natural', icon: 'landscape' },
  { name: 'Religioso', icon: 'church' },
];

// Ciudades más importantes de México para destacar en la app.
// Puebla se incluye con la relevancia más alta, a la par de CDMX,
// como ciudad prioritaria/inmediata del catálogo.
const CIUDADES_IMPORTANTES = [
  {
    name: 'Centro Histórico de Puebla',
    shortDescription: 'Casco colonial Patrimonio de la Humanidad, cuna de la Talavera.',
    longDescription:
      'El Centro Histórico de Puebla, declarado Patrimonio de la Humanidad por la UNESCO en 1987, destaca por su traza colonial, la Catedral de Puebla y sus fachadas cubiertas de azulejo de Talavera.',
    stateName: 'Puebla',
    municipality: 'Puebla',
    latitude: 19.0414,
    longitude: -98.2063,
    address: 'Centro Histórico, Puebla de Zaragoza, Puebla',
    relevanceScore: 98,
    categorias: ['Histórico', 'Cultural'],
    imagenUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Catedral_de_Puebla,_M%C3%A9xico,_2013-10-11,_DD_08.JPG',
  },
  {
    name: 'Centro Histórico de la Ciudad de México',
    shortDescription: 'Zócalo, Catedral Metropolitana y Palacio Nacional.',
    longDescription:
      'El corazón de la capital mexicana concentra el Zócalo, la Catedral Metropolitana, el Palacio Nacional y el Templo Mayor, testigos de la historia prehispánica, colonial y contemporánea del país.',
    stateName: 'Ciudad de México',
    municipality: 'Cuauhtémoc',
    latitude: 19.4326,
    longitude: -99.1332,
    address: 'Zócalo, Centro, Ciudad de México',
    relevanceScore: 100,
    categorias: ['Histórico', 'Cultural'],
    imagenUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Zocalo_cathedral.jpg',
  },
  {
    name: 'Centro Histórico de Guadalajara',
    shortDescription: 'Catedral, mariachi y tradición tapatía.',
    longDescription:
      'Sede de la Catedral de Guadalajara, el Teatro Degollado y la Plaza de los Mariachis, es el punto de partida para conocer la cultura tapatía y su tradición musical.',
    stateName: 'Jalisco',
    municipality: 'Guadalajara',
    latitude: 20.6767,
    longitude: -103.3475,
    address: 'Centro Histórico, Guadalajara, Jalisco',
    relevanceScore: 90,
    categorias: ['Histórico', 'Cultural'],
  },
  {
    name: 'Parque Fundidora',
    shortDescription: 'Antigua fundidora de acero convertida en parque cultural.',
    longDescription:
      'Ubicado en Monterrey, este parque urbano ocupa las instalaciones de una fundidora de acero del siglo XX y hoy alberga museos, áreas verdes y el Cerro de la Silla como telón de fondo.',
    stateName: 'Nuevo León',
    municipality: 'Monterrey',
    latitude: 25.6803,
    longitude: -100.2842,
    address: 'Av. Fundidora, Monterrey, Nuevo León',
    relevanceScore: 88,
    categorias: ['Cultural', 'Natural'],
  },
  {
    name: 'Centro Histórico de Oaxaca',
    shortDescription: 'Cantera verde, gastronomía y arte textil.',
    longDescription:
      'El Centro Histórico de Oaxaca de Juárez, también Patrimonio de la Humanidad, es famoso por el Templo de Santo Domingo, su gastronomía y las tradiciones de los pueblos originarios de la región.',
    stateName: 'Oaxaca',
    municipality: 'Oaxaca de Juárez',
    latitude: 17.0732,
    longitude: -96.7266,
    address: 'Centro Histórico, Oaxaca de Juárez, Oaxaca',
    relevanceScore: 92,
    categorias: ['Histórico', 'Cultural'],
  },
  {
    name: 'Paseo de Montejo',
    shortDescription: 'Avenida de mansiones porfirianas en el corazón de Mérida.',
    longDescription:
      'Bulevar emblemático de Mérida bordeado por residencias de estilo francés construidas durante el auge henequenero, hoy convertidas en museos, hoteles y restaurantes.',
    stateName: 'Yucatán',
    municipality: 'Mérida',
    latitude: 20.9754,
    longitude: -89.6168,
    address: 'Paseo de Montejo, Mérida, Yucatán',
    relevanceScore: 89,
    categorias: ['Cultural', 'Histórico'],
  },
  {
    name: 'Centro Histórico de Guanajuato',
    shortDescription: 'Callejones coloridos y el famoso Callejón del Beso.',
    longDescription:
      'Ciudad minera Patrimonio de la Humanidad, conocida por sus callejones, túneles subterráneos y el Callejón del Beso, además de ser sede del Festival Internacional Cervantino.',
    stateName: 'Guanajuato',
    municipality: 'Guanajuato',
    latitude: 21.0190,
    longitude: -101.2574,
    address: 'Centro Histórico, Guanajuato, Guanajuato',
    relevanceScore: 91,
    categorias: ['Histórico', 'Cultural'],
  },
  {
    name: 'Parroquia de San Miguel Arcángel',
    shortDescription: 'Fachada neogótica ícono de San Miguel de Allende.',
    longDescription:
      'Templo de fachada rosada y estilo neogótico que domina el paisaje de San Miguel de Allende, uno de los Pueblos Mágicos más visitados de México.',
    stateName: 'Guanajuato',
    municipality: 'San Miguel de Allende',
    latitude: 20.9153,
    longitude: -100.7436,
    address: 'Jardín Principal, San Miguel de Allende, Guanajuato',
    relevanceScore: 90,
    categorias: ['Religioso', 'Histórico'],
  },
  {
    name: 'Zona Hotelera de Cancún',
    shortDescription: 'Playas de arena blanca y mar turquesa del Caribe mexicano.',
    longDescription:
      'Franja costera de Cancún con algunas de las playas más visitadas de México, puerta de entrada a la Riviera Maya y a los arrecifes del Caribe mexicano.',
    stateName: 'Quintana Roo',
    municipality: 'Benito Juárez',
    latitude: 21.1319,
    longitude: -86.7500,
    address: 'Zona Hotelera, Cancún, Quintana Roo',
    relevanceScore: 87,
    categorias: ['Natural'],
  },
  {
    name: 'Zona Arqueológica de Tulum',
    shortDescription: 'Única ciudad maya amurallada frente al mar.',
    longDescription:
      'Asentamiento maya construido sobre acantilados frente al Caribe, es la única zona arqueológica de este tipo edificada junto al mar en México.',
    stateName: 'Quintana Roo',
    municipality: 'Tulum',
    latitude: 20.2145,
    longitude: -87.4295,
    address: 'Zona Arqueológica, Tulum, Quintana Roo',
    relevanceScore: 93,
    categorias: ['Arqueológico', 'Natural'],
    imagenUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tulum-Seaside-2010.jpg',
  },
];

async function main() {
  for (const name of ESTADOS) {
    await prisma.state.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const cat of CATEGORIAS) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  const puebla = await prisma.state.findUnique({
    where: { name: 'Puebla' },
  });
  const [historico, arqueologico] = await Promise.all([
    prisma.category.findUnique({ where: { name: 'Histórico' } }),
    prisma.category.findUnique({ where: { name: 'Arqueológico' } }),
  ]);

  await prisma.place.create({
    data: {
      name: 'Zona Arqueológica de Cholula',
      shortDescription: 'La pirámide más grande del mundo por volumen.',
      longDescription:
        'La Gran Pirámide de Cholula (Tlachihualtepetl) es la estructura piramidal más grande conocida en el mundo por volumen total, construida a lo largo de varios siglos por distintas culturas prehispánicas.',
      latitude: 19.0578,
      longitude: -98.3022,
      address: 'San Andrés Cholula, Puebla',
      stateId: puebla!.id,
      municipality: 'San Andrés Cholula',
      relevanceScore: 95,
      isPublished: true,
      categories: {
        create: [
          { categoryId: historico!.id },
          { categoryId: arqueologico!.id },
        ],
      },
    },
  });

  console.log('Seed completado: estados, categorías y lugar de ejemplo cargados.');

  // Ciudades más importantes de México (incluye Puebla como prioritaria)
  for (const ciudad of CIUDADES_IMPORTANTES) {
    const yaExiste = await prisma.place.findFirst({
      where: { name: ciudad.name },
    });
    if (yaExiste) continue;

    const estado = await prisma.state.findUnique({
      where: { name: ciudad.stateName },
    });
    if (!estado) {
      console.warn(`Estado no encontrado para "${ciudad.name}": ${ciudad.stateName}`);
      continue;
    }

    const categorias = await prisma.category.findMany({
      where: { name: { in: ciudad.categorias } },
    });

    await prisma.place.create({
      data: {
        name: ciudad.name,
        shortDescription: ciudad.shortDescription,
        longDescription: ciudad.longDescription,
        latitude: ciudad.latitude,
        longitude: ciudad.longitude,
        address: ciudad.address,
        stateId: estado.id,
        municipality: ciudad.municipality,
        relevanceScore: ciudad.relevanceScore,
        isPublished: true,
        categories: {
          create: categorias.map((cat) => ({ categoryId: cat.id })),
        },
        images: ciudad.imagenUrl
          ? { create: [{ url: ciudad.imagenUrl, order: 0 }] }
          : undefined,
      },
    });
  }

  console.log('Seed completado: ciudades más importantes de México cargadas.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
