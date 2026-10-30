import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';
import { mercadoLibre } from '../src/mercadolibre.js';

test('endpoint de diagnóstico exige credenciales en modo Render y no recibe secretos en URL',async()=>{
  const keys=['NODE_ENV','APP_USERNAME','APP_PASSWORD'];
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{NODE_ENV:'production',APP_USERNAME:'diagnostic_admin',APP_PASSWORD:'long_test_password_67890'});
  const original=mercadoLibre.diagnose;
  let calls=0;
  mercadoLibre.diagnose=async id=>{calls++;assert.equal(id,'MLA1407266827');return {itemId:id,checks:[{endpoint:'users/me',httpStatus:200}],interpretation:'Cuenta validada'};};
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/api/ml/diagnostics?id=MLA1407266827`;
  try {
    let res=await fetch(url);assert.equal(res.status,401);assert.equal(calls,0);
    const auth='Basic '+Buffer.from('diagnostic_admin:long_test_password_67890').toString('base64');
    res=await fetch(url,{headers:{Authorization:auth}});
    assert.equal(res.status,200);
    const body=await res.json();assert.equal(body.checks[0].httpStatus,200);
    assert.equal(calls,1);
  } finally {
    await new Promise(r=>server.close(r));mercadoLibre.diagnose=original;
    for (const k of keys) if(before[k]===undefined) delete process.env[k]; else process.env[k]=before[k];
  }
});
