import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {readData,writeData,backupData,assertStorageConfiguration} from '../src/data-store.js';
import {restoreData} from '../scripts/restore-data.js';
test('datos sobreviven otro proceso y restauración en directorio nuevo; corrupción no se oculta',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'import-recovery-'));
  const previous=process.env.GUICON_DATA_DIR;process.env.GUICON_DATA_DIR=path.join(root,'data');
  try {
    for(const name of ['products','research','prices','research-usage'])writeData(name,[{example:name}]);
    const script="import {readData} from './src/data-store.js'; console.log(JSON.stringify(readData('prices')));";
    assert.deepEqual(JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'})),[{example:'prices'}]);
    const backup=path.join(root,'backup.json');fs.writeFileSync(backup,JSON.stringify(backupData()));
    const restored=path.join(root,'restored');restoreData(backup,restored);
    assert.throws(()=>restoreData(backup,restored),/destino debe ser nuevo/);
    process.env.GUICON_DATA_DIR=restored;assert.deepEqual(readData('research-usage'),[{example:'research-usage'}]);
    fs.writeFileSync(path.join(restored,'prices.json'),'{broken');
    assert.throws(()=>readData('prices'));assert.throws(()=>writeData('prices',[]));
  }finally{if(previous===undefined)delete process.env.GUICON_DATA_DIR;else process.env.GUICON_DATA_DIR=previous;fs.rmSync(root,{recursive:true,force:true});}
});
test('modo durable exige ruta absoluta explícita',()=>{
  const old={...process.env};
  try{process.env.GUICON_STORAGE_DURABLE='true';process.env.GUICON_DATA_DIR='relative';assert.throws(assertStorageConfiguration);}
  finally{delete process.env.GUICON_STORAGE_DURABLE;delete process.env.GUICON_DATA_DIR;Object.assign(process.env,old);}
});
