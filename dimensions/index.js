// All portal dimensions, keyed by id. Pure data + build(api, K); no imports, so node can load them in unit tests.
import { AUTOMAT } from './automat.js?v=7.5';
import { GRAVBOG } from './gravbog.js?v=7.5';
import { WAITROOM } from './waitroom.js?v=7.5';
import { PANTRY } from './pantry.js?v=7.5';
import { LOUNGE } from './lounge.js?v=7.5';
export const DIMENSIONS = { automat: AUTOMAT, gravbog: GRAVBOG, waitroom: WAITROOM, pantry: PANTRY, lounge: LOUNGE };
