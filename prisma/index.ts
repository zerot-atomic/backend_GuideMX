import type { Lugar } from './tipos';
import { AGUASCALIENTES } from './aguascalientes';
import { BAJA_CALIFORNIA } from './baja-california';
import { BAJA_CALIFORNIA_SUR } from './baja-california-sur';
import { CAMPECHE } from './campeche';
import { CHIAPAS } from './chiapas';
import { CHIHUAHUA } from './chihuahua';
import { CIUDAD_DE_MEXICO } from './ciudad-de-mexico';
import { COAHUILA } from './coahuila';
import { COLIMA } from './colima';
import { DURANGO } from './durango';
import { ESTADO_DE_MEXICO } from './estado-de-mexico';
import { GUANAJUATO } from './guanajuato';
import { GUERRERO } from './guerrero';
import { HIDALGO } from './hidalgo';
import { JALISCO } from './jalisco';
import { MICHOACAN } from './michoacan';
import { MORELOS } from './morelos';
import { NAYARIT } from './nayarit';
import { NUEVO_LEON } from './nuevo-leon';
import { OAXACA } from './oaxaca';
import { PUEBLA } from './puebla';
import { QUERETARO } from './queretaro';
import { QUINTANA_ROO } from './quintana-roo';
import { SAN_LUIS_POTOSI } from './san-luis-potosi';
import { SINALOA } from './sinaloa';
import { SONORA } from './sonora';
import { TABASCO } from './tabasco';
import { TAMAULIPAS } from './tamaulipas';
import { TLAXCALA } from './tlaxcala';
import { VERACRUZ } from './veracruz';
import { YUCATAN } from './yucatan';
import { ZACATECAS } from './zacatecas';

export const LUGARES: Lugar[] = [
  ...AGUASCALIENTES, ...BAJA_CALIFORNIA, ...BAJA_CALIFORNIA_SUR, ...CAMPECHE,
  ...CHIAPAS, ...CHIHUAHUA, ...CIUDAD_DE_MEXICO, ...COAHUILA, ...COLIMA,
  ...DURANGO, ...ESTADO_DE_MEXICO, ...GUANAJUATO, ...GUERRERO, ...HIDALGO,
  ...JALISCO, ...MICHOACAN, ...MORELOS, ...NAYARIT, ...NUEVO_LEON, ...OAXACA,
  ...PUEBLA, ...QUERETARO, ...QUINTANA_ROO, ...SAN_LUIS_POTOSI, ...SINALOA,
  ...SONORA, ...TABASCO, ...TAMAULIPAS, ...TLAXCALA, ...VERACRUZ, ...YUCATAN,
  ...ZACATECAS,
];
