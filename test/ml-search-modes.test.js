import test from 'node:test';
import assert from 'node:assert/strict';
import {MercadoLibreService} from '../src/mercadolibre.js';
test('búsqueda propia usa solo la identidad del token y conserva rechazos por ítem',async()=>{
  const calls=[];const svc=new MercadoLibreService({fetchImpl:async href=>{
    const u=new URL(href);calls.push(u);
    const payload=u.pathname==='/users/me'?{id:123456}:u.pathname==='/users/123456/items/search'?
      {results:['MLA123456789'],paging:{total:1}}:[{id:'MLA123456789',status_code:403,body:{error:'forbidden'}}];
    return {ok:true,json:async()=>payload};
  }});svc.accessToken=async()=>'TEST';
  const r=await svc.search('perchas',12,'own');assert.equal(r.items.length,0);assert.equal(r.diagnostics[0].httpStatus,403);
  assert.equal(calls[1].searchParams.get('q'),'perchas');assert.equal(calls.some(x=>x.pathname==='/sites/MLA/search'),false);
  await assert.rejects(svc.search('perchas',12,'other'),e=>e.status===400);
});
test('diagnóstico sin referencia no consulta un ID inventado ni afirma acceso a terceros',async()=>{
  const env={ML_CLIENT_ID:'123456',ML_CLIENT_SECRET:'TEST',ML_REDIRECT_URI:'https://example.com/auth/mercadolibre/callback',
    ML_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),UPSTASH_REDIS_REST_URL:'https://example.com',UPSTASH_REDIS_REST_TOKEN:'TEST'};
  const calls=[];const svc=new MercadoLibreService({env,store:{load:async()=>({accessToken:'TEST'})}});
  svc.apiGet=async pathname=>{calls.push(pathname);return pathname==='/users/me'?{id:123456}:{results:[]};};
  const r=await svc.diagnose();assert.equal(r.itemId,null);assert.equal(r.capabilities.referenceItem,'no_comprobado');
  assert.equal(calls.some(p=>p.startsWith('/items/')),false);
});
