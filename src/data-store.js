/** Single-process JSON store. Mount GUICON_DATA_DIR on a durable disk in production. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function dataPath() { return path.resolve(process.env.GUICON_DATA_DIR || path.join(root, 'data')); }
const names = new Set(['products', 'research', 'prices', 'research-usage']);
function filename(name) {
  if (!names.has(name)) throw new Error('Colección desconocida');
  return path.join(dataPath(), name + '.json');
}
export function readData(name, fallback = []) {
  const file = filename(name);
  if (!fs.existsSync(file)) return structuredClone(fallback);
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error('Almacenamiento inválido: ' + name);
  return value;
}
export function writeData(name, value) {
  if (!Array.isArray(value)) throw new Error('Se requiere una colección');
  const file = filename(name);
  fs.mkdirSync(dataPath(), {recursive:true});
  if (fs.existsSync(file)) { readData(name); fs.copyFileSync(file, file + '.bak'); }
  const fd = fs.openSync(file + '.tmp', 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(file + '.tmp', file);
}
export function storageStatus() {
  return {backend:'json', durableConfigured:process.env.GUICON_STORAGE_DURABLE === 'true',
    warning:process.env.GUICON_STORAGE_DURABLE === 'true'
      ? 'Disco declarado persistente; verificar recuperación después de un redeploy.'
      : 'Almacenamiento local: en Render sin disco se pierde al redeploy. Descargá un respaldo.'};
}
export function assertStorageConfiguration() {
  if (process.env.GUICON_STORAGE_DURABLE === 'true' &&
      (!process.env.GUICON_DATA_DIR || !path.isAbsolute(process.env.GUICON_DATA_DIR)))
    throw new Error('El almacenamiento durable requiere GUICON_DATA_DIR absoluto en el disco montado.');
}
export function backupData() {
  return {schemaVersion:1, exportedAt:new Date().toISOString(),
    collections:Object.fromEntries([...names].map(name=>[name,readData(name)]))};
}
