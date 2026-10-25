// All portal dimensions, keyed by id. Pure data + build(api, K); no imports, so node can load them in unit tests.
import { AUTOMAT } from './automat.js';
import { GRAVBOG } from './gravbog.js';
import { WAITROOM } from './waitroom.js';
import { PANTRY } from './pantry.js';
import { LOUNGE } from './lounge.js';
export const DIMENSIONS = { automat: AUTOMAT, gravbog: GRAVBOG, waitroom: WAITROOM, pantry: PANTRY, lounge: LOUNGE };
