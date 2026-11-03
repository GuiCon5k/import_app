import { migrateLegacy } from './finance.js';
import { readData, writeData } from './data-store.js';
export { dataPath } from './data-store.js';
export function readOffers() { return readData('products').map(migrateLegacy).filter(Boolean); }
export function saveOffers(offers) { writeData('products', offers); }
