import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';
test('HTTP: importación protegida, sin OAuth ni OpenAI, rechaza origen externo y formatos inválidos',async()=>{
  const keys=['NODE_ENV','APP_USERNAME','APP_PASSWORD','PAID_API_ENABLED'];
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{NODE_ENV:'production',APP_USERNAME:'test',APP_PASSWORD:'test-password-long',PAID_API_ENABLED:'false'});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const auth='Basic '+Buffer.from('test:test-password-long').toString('base64');
  const data={records:[{title:'Prueba',sourceName:'Proveedor',url:'https://proveedor.example/producto',priceArs:100,
    observedAt:'2026-01-01T00:00:00Z',evidence:'Cotización aportada'}]};
  const post=(payload,headers={Authorization:auth})=>fetch(base+'/api/prices/import',{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  try {
    assert.equal((await post(data,{})).status,401);
    assert.equal((await post(data,{Authorization:auth,Origin:'https://evil.example'})).status,403);
    const result=await post(data); assert.equal(result.status,200);
    assert.equal((await result.json()).records[0].verification,'aportado_sin_verificacion_api');
    assert.equal((await post({records:[{...data.records[0],priceArs:-1}]})).status,400);
    assert.equal((await post({records:[{...data.records[0],evidence:'x'.repeat(61000)}]})).status,413);
    assert.equal((await fetch(base+'/api/ai/analyze',{method:'POST',headers:{Authorization:auth},body:'{}'})).status,503);
    const html=await fetch(base,{headers:{Authorization:auth}}).then(r=>r.text());
    assert.match(html,/id="priceImportForm"/);
  } finally {
    await new Promise(r=>server.close(r));
    for(const k of keys) if(saved[k]===undefined) delete process.env[k]; else process.env[k]=saved[k];
  }
});
