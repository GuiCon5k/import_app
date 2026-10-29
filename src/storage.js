/** JavaScript (Node.js): persistencia local en JSON. Sin base de datos externa para el MVP. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateLegacy } from './finance.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.GUICON_DATA_DIR || path.join(root, 'data');
const file = path.join(dir, 'products.json');
fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');

export function readOffers() {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('El archivo de productos no contiene una lista');
  return raw.map(migrateLegacy).filter(Boolean);
}
export function saveOffers(offers) {
  // Escritura atómica: evita archivos incompletos si el proceso se interrumpe al guardar.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(offers, null, 2));
  fs.renameSync(tmp, file);
}
export function dataPath() { return dir; }
