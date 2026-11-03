/** Restore into an EMPTY directory only; never replace a running service's data. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
export function restoreData(source, destination) {
  const data=JSON.parse(fs.readFileSync(source,'utf8'));
  const names=['products','research','prices','research-usage'];
  if(data.schemaVersion!==1 || !data.collections || names.some(n=>!Array.isArray(data.collections[n])))
    throw new Error('Respaldo incompatible');
  const target=path.resolve(destination);
  if(fs.existsSync(target)) throw new Error('El destino debe ser nuevo; nunca se sobrescriben datos existentes.');
  const staged=target+'.restore-'+randomUUID();
  fs.mkdirSync(staged,{recursive:true});
  for(const name of names)fs.writeFileSync(path.join(staged,name+'.json'),JSON.stringify(data.collections[name],null,2),{mode:0o600});
  fs.renameSync(staged,target);
  return target;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  if(!process.argv[2] || !process.argv[3]) throw new Error('Uso: node scripts/restore-data.js respaldo.json directorio-nuevo');
  restoreData(process.argv[2],process.argv[3]);
  console.log('Restaurado. Configurá GUICON_DATA_DIR al destino antes de iniciar el servidor.');
}
