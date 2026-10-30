import test from 'node:test';
import assert from 'node:assert/strict';
import { MercadoLibreService } from '../src/mercadolibre.js';

const fakeEnv = {
  ML_CLIENT_ID:'test', ML_CLIENT_SECRET:'fake',
  ML_REDIRECT_URI:'https://example.com/auth/mercadolibre/callback',
  ML_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),
  UPSTASH_REDIS_REST_URL:'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN:'fake'
};
function forbiddenTestService(pathExpected, body) {
  return new MercadoLibreService({env:fakeEnv,
    store:{load:async()=>({accessToken:'not-a-real-token',refreshToken:'not-a-real-refresh',expiresAt:Date.now()+300000})},
    fetchImpl:async(url,options)=>{
      assert.equal(new URL(url).pathname,pathExpected);
      assert.equal(options.headers.Authorization,'Bearer not-a-real-token');
      return {ok:false,status:403,json:async()=>body};
    }
  });
}

test('403 de búsqueda contiene endpoint y código de política, sin exponer datos arbitrarios', async()=>{
  const service=forbiddenTestService('/sites/MLA/search',{
    code:'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',blocked_by:'PolicyAgent',message:'token PRIVADO'
  });
  await assert.rejects(service.search('perchas'),error=>{
    assert.equal(error.status,403);
    assert.equal(error.ml.endpoint,'sites/MLA/search');
    assert.equal(error.ml.code,'PA_UNAUTHORIZED_RESULT_FROM_POLICIES');
    assert.equal(error.ml.blockedBy,'PolicyAgent');
    assert.doesNotMatch(JSON.stringify(error.ml)+error.message,/PRIVADO/);
    return true;
  });
});

test('403 de ID muestra items/bulk, sin confundirlo con búsqueda por texto', async()=>{
  const service=forbiddenTestService('/items/bulk',{error:'forbidden'});
  await assert.rejects(service.search('MLA1418175105'), error=>{
    assert.equal(error.status,403);
    assert.equal(error.ml.endpoint,'items/bulk');
    assert.equal(error.ml.code,'forbidden');
    return true;
  });
});

test('respuestas no JSON siguen devolviendo un error seguro y útil', async()=>{
  const service=forbiddenTestService('/sites/MLA/search',null);
  await assert.rejects(service.search('perchas'),error=>{
    assert.equal(error.status,403);
    assert.equal(error.ml.endpoint,'sites/MLA/search');
    assert.equal(error.ml.code,undefined);
    return true;
  });
});
