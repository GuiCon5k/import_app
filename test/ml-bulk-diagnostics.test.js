import test from 'node:test';
import assert from 'node:assert/strict';
import { MercadoLibreService } from '../src/mercadolibre.js';

const env = {ML_CLIENT_ID:'test', ML_CLIENT_SECRET:'test',
  ML_REDIRECT_URI:'https://example.com/auth/mercadolibre/callback',
  ML_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),
  UPSTASH_REDIS_REST_URL:'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN:'fake'};
const id='MLA1418175105';
const mocked = (rows) => new MercadoLibreService({env,
  store:{load:async()=>({accessToken:'mock-only',refreshToken:'mock-only',expiresAt:Date.now()+300000})},
  fetchImpl:async(url)=>{
    assert.equal(new URL(url).pathname,'/items/bulk');
    return {ok:true,status:200,json:async()=>rows};
  }
});

test('bulk devuelve 404 por ID sin confundirlo con precio 0', async()=>{
  const result=await mocked([{id,status_code:404,body:{message:'not found'}}]).search(id);
  assert.equal(result.items.length,0);
  assert.deepEqual(result.diagnostics,[{id,httpStatus:404,reason:'Mercado Libre no encontró esta publicación (404). Puede haber sido eliminada.'}]);
});
test('bulk devuelve 403 individual incluso con HTTP general 200', async()=>{
  const result=await mocked([{id,status_code:403,body:{message:'no'}}]).search(id);
  assert.equal(result.diagnostics[0].httpStatus,403);
});
test('publicación inactiva no aparece como precio verificado y muestra motivo', async()=>{
  const result=await mocked([{id,status_code:200,body:{id,title:'Percha',price:999,currency_id:'ARS',status:'paused'}}]).search(id);
  assert.equal(result.items.length,0);
  assert.match(result.diagnostics[0].reason,/paused/);
});
test('ID omitido en respuesta bulk muestra diagnóstico, sin inventar nada', async()=>{
  const result=await mocked([]).search(id);
  assert.equal(result.items.length,0);
  assert.match(result.diagnostics[0].reason,/no incluyó/);
});
test('publicación activa tiene precio y no genera falso error', async()=>{
  const result=await mocked([{id,status_code:200,body:{id,title:'Perchas',price:12000,currency_id:'ARS',status:'active'}}]).search(id);
  assert.equal(result.items[0].priceArs,12000);
  assert.equal(result.diagnostics.length,0);
});
