import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guicon-test-'));
process.env.GUICON_DATA_DIR = testDir;
const { server } = await import('../src/server.js');
const dataFile = path.join(testDir, 'products.json');
const sample={
  productName:'Prueba API', supplierName:'Proveedor de prueba', sourcingType:'fabricante', quoteStatus:'cotizado',
  currency:'ARS', quantity:5, minOrder:1, unitPurchase:1000, fxRate:1,
  unitFreight:0, unitImportFees:0, fixedSourcingFees:0, unitLocalDelivery:0, unitPackaging:0,
  unitOther:0,salePrice:2000,marketplaceFeePct:0,adsPct:0,adsPerSale:0,launchAdsBudget:1000,leadDays:4
};
// Prueba integral del servidor HTTP sin exponerlo en Internet ni consumir la API de IA.
test('API: calcular, guardar, actualizar, exportar y eliminar', async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const send=(url,method='GET',data)=>fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  try {
    let r=await send('/api/calculate','POST',sample);
    assert.equal(r.status,200);assert.equal((await r.json()).unitProfitArs,800);
    r=await send('/api/offers','POST',sample);
    assert.equal(r.status,201);const created=await r.json();assert.ok(created.id);
    r=await send('/api/offers');assert.equal((await r.json()).length,1);
    r=await send('/api/offers/'+created.id,'PUT',{...sample,salePrice:2500});assert.equal(r.status,200);
    assert.equal((await r.json()).salePrice,2500);
    r=await send('/api/export.csv');assert.match(await r.text(),/Proveedor de prueba/);
    r=await send('/api/ai/analyze','POST',{id:created.id});assert.equal(r.status,503); // sin clave
    r=await send('/api/offers/'+created.id,'DELETE');assert.equal(r.status,200);
    r=await send('/api/offers');assert.equal((await r.json()).length,0);
    r=await send('/api/offers','POST',{...sample,minOrder:10});assert.equal(r.status,400);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(testDir,{recursive:true,force:true});
  }
});
