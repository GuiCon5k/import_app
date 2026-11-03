import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'import-api-persist-'));process.env.GUICON_DATA_DIR=dir;
const {server}=await import('../src/server.js');
test('importar, recargar y respaldar conserva referencias; repetición no duplica y backup está protegido',async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const record={title:'Prueba',url:'https://example.com/product',sourceName:'Ejemplo',priceArs:10,observedAt:'2026-01-01T00:00:00Z',evidence:'Dato ficticio'};
  try {
    for(let i=0;i<2;i++)assert.equal((await fetch(base+'/api/prices/import',{method:'POST',body:JSON.stringify({records:[record]})})).status,200);
    const saved=await fetch(base+'/api/prices').then(r=>r.json());assert.equal(saved.records.length,1);
    assert.equal(saved.records[0].verification,'aportado_sin_verificacion_api');
    const backup=await fetch(base+'/api/backup').then(r=>r.json());assert.equal(backup.collections.prices.length,1);
    process.env.NODE_ENV='production';process.env.APP_USERNAME='test';process.env.APP_PASSWORD='long-test-password';
    assert.equal((await fetch(base+'/api/backup')).status,401);
    assert.equal((await fetch(base+'/api/prices')).status,401);
  }finally{delete process.env.NODE_ENV;delete process.env.APP_USERNAME;delete process.env.APP_PASSWORD;await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
