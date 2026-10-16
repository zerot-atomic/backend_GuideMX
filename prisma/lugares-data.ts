// Re-exporta el catálogo dividido por estado (carpeta lugares/) para que seed-lugares.ts siga funcionando igual.
export type { Lugar } from './tipos';
export { LUGARES } from './index';
