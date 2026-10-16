import { LUGARES } from './index';

const ESTADOS = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
  'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
  'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];
const CATS = new Set(['H', 'A', 'C', 'N', 'R', 'G', 'S']);
const MAX_TOTAL = 3199;

let errores = 0;
const err = (m: string) => { errores++; console.error('ERROR:', m); };

const porEstado: Record<string, number> = {};
const nombres = new Set<string>();
const coords = new Set<string>();

for (const [name, estado, muni, lat, lng, cats, corta, rel] of LUGARES) {
  porEstado[estado] = (porEstado[estado] ?? 0) + 1;
  if (!ESTADOS.includes(estado)) err(`Estado inválido: ${estado} (${name})`);
  if (nombres.has(name)) err(`Nombre duplicado: ${name}`);
  nombres.add(name);
  if (lat < 14.4 || lat > 32.8 || lng < -118.5 || lng > -86.5) err(`Coordenadas fuera de México: ${name} (${lat}, ${lng})`);
  const k = `${lat},${lng}`;
  if (coords.has(k)) err(`Coordenadas repetidas: ${name} (${k})`);
  coords.add(k);
  if (!cats || [...cats].some((c) => !CATS.has(c))) err(`Categorías inválidas en ${name}: "${cats}"`);
  if (!muni) err(`Sin municipio: ${name}`);
  if (!corta || corta.length < 20) err(`Descripción muy corta: ${name}`);
  if (rel < 0 || rel > 100) err(`Relevancia fuera de rango: ${name}`);
}

console.log('\nLugares por estado:');
for (const e of ESTADOS) console.log(`${e.padEnd(22)} ${porEstado[e] ?? 0}`);
console.log(`\nTOTAL: ${LUGARES.length} (máximo ${MAX_TOTAL})`);
if (LUGARES.length > MAX_TOTAL) err(`Se pasa del máximo de ${MAX_TOTAL}`);
console.log(errores ? `\n${errores} error(es)` : '\nSin errores');
process.exit(errores ? 1 : 0);
