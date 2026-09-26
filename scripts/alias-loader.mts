// Runner de los tests de dominio. Node puro no resuelve el alias `@/` que usa
// Next, asi que se registra un loader que lo mapea a src/ antes de importar.
//   node --experimental-strip-types --import ./scripts/alias-loader.mts scripts/verify-flow.mts
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./alias-hooks.mjs', pathToFileURL('./scripts/'));
