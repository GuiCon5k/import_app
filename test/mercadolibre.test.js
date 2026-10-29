import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encryptTokens, decryptTokens, RedisTokenStore, storeConfigured } from '../src/ml-store.js';
import { makeOAuthState, validateOAuthState, authorizationUrl, MercadoLibreService, mlReady } from '../src/mercadolibre.js';

const env = () => ({
  ML_CLIENT_ID:'11111', ML_CLIENT_SECRET:'SECRETO_SOLO_DE_PRUEBA',
  ML_REDIRECT_URI:'https://import-app-guicon.onrender.com/auth/mercadolibre/callback',
  ML_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('hex'),
  UPSTASH_REDIS_REST_URL:'https://eu1-example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN:'UPSTASH_TEST_ONLY', ML_PKCE_ENABLED:'true'
});
const reply = (status, data) => ({ ok: status >= 200 && status < 300, status, json:async()=>data });

test('cifrado AES-GCM: no hay tokens en texto plano y se detecta alteración', () => {
  const variables=env();
  const tokens={accessToken:'ACCESS_SECRET', refreshToken:'REFRESH_SECRET', expiresAt:12345};
  const encrypted=encryptTokens(tokens,variables);
  assert.doesNotMatch(encrypted,/ACCESS_SECRET|REFRESH_SECRET/);
  assert.deepEqual(decryptTokens(encrypted,variables),tokens);
  assert.throws(()=>decryptTokens(encrypted.slice(0,-2)+'zz',variables));
  assert.equal(storeConfigured({...variables,ML_TOKEN_ENCRYPTION_KEY:'clave_insegura'}),false);
});

test('state OAuth firmado, temporal, exclusivo de navegador y PKCE S256', () => {
  const variables=env();
  const now=Date.now();
  const {nonce,verifier,cookieValue}=makeOAuthState(variables.ML_TOKEN_ENCRYPTION_KEY,now);
  assert.equal(validateOAuthState(nonce,cookieValue,variables.ML_TOKEN_ENCRYPTION_KEY,now+500),true);
  assert.equal(validateOAuthState('nonce-inventado',cookieValue,variables.ML_TOKEN_ENCRYPTION_KEY,now+500),false);
  assert.equal(validateOAuthState(nonce,cookieValue,variables.ML_TOKEN_ENCRYPTION_KEY,now+610000),false);
  assert.equal(validateOAuthState(nonce,cookieValue.replace(/.$/,'X'),variables.ML_TOKEN_ENCRYPTION_KEY,now+500),false);
  const authorize=new URL(authorizationUrl(variables,nonce,verifier));
  assert.equal(authorize.host,'auth.mercadolibre.com.ar');
  assert.equal(authorize.searchParams.get('redirect_uri'),variables.ML_REDIRECT_URI);
  assert.equal(authorize.searchParams.get('code_challenge_method'),'S256');
  assert.ok(authorize.searchParams.get('code_challenge'));
  assert.equal(mlReady(variables),true);
});

test('OAuth realista simulado: intercambio, Redis cifrado, refresh único y búsqueda + bulk', async () => {
  const variables=env();
  const redis=new Map();
  let refreshCount=0, bulkCount=0, searchCount=0, codeParams;
  const fakeFetch = async (url, opts) => {
    if (url.includes('upstash.io')) {
      assert.equal(opts.headers.Authorization,'Bearer UPSTASH_TEST_ONLY');
      const [method,key,value]=JSON.parse(opts.body);
      if (method==='GET') return reply(200,{result:redis.get(key) || null});
      if (method==='SET') { redis.set(key,value);return reply(200,{result:'OK'}); }
    }
    if (url.endsWith('/oauth/token')) {
      const data=new URLSearchParams(opts.body);
      assert.equal(data.get('client_secret'),variables.ML_CLIENT_SECRET);
      if (data.get('grant_type')==='authorization_code') {
        codeParams=data;
        return reply(200,{access_token:'TEST_ACCESS_1',refresh_token:'TEST_REFRESH_1',expires_in:3600,user_id:2345});
      }
      assert.equal(data.get('refresh_token'),'TEST_REFRESH_1');
      refreshCount++;
      return reply(200,{access_token:'TEST_ACCESS_2',refresh_token:'TEST_REFRESH_2',expires_in:3600,user_id:2345});
    }
    if (url.includes('/sites/MLA/search')) {
      searchCount++;
      assert.match(url,/perchas/);
      return reply(200,{paging:{total:2}, results:[{id:'MLA123456789'},{id:'MLA987654321'}]});
    }
    if (url.includes('/items/bulk')) {
      bulkCount++;
      assert.equal(opts.headers.Authorization,refreshCount ? 'Bearer TEST_ACCESS_2':'Bearer TEST_ACCESS_1');
      return reply(200,[
        {id:'MLA123456789',status_code:200,body:{id:'MLA123456789',title:'Perchas multiuso',price:15499,currency_id:'ARS',permalink:'https://www.mercadolibre.com.ar/perchas/p/MLA123456789',seller_id:101,status:'active'}},
        {id:'MLA987654321',status_code:200,body:{id:'MLA987654321',title:'Perchas reforzadas',price:17900,currency_id:'ARS',permalink:'https://www.mercadolibre.com.ar/reforzadas/p/MLA987654321',seller_id:102,status:'active'}}
      ]);
    }
    throw Error('Unexpected call '+url);
  };
  const store=new RedisTokenStore({env:variables,fetchImpl:fakeFetch});
  const svc=new MercadoLibreService({env:variables,fetchImpl:fakeFetch,store});
  assert.equal((await svc.status()).connected,false);
  await svc.exchangeCode('TEST_AUTH_CODE', 'a'.repeat(43));
  assert.equal(codeParams.get('redirect_uri'),variables.ML_REDIRECT_URI);
  assert.equal(codeParams.get('code_verifier'),'a'.repeat(43));
  assert.equal((await svc.status()).userId,2345);
  assert.doesNotMatch([...redis.values()][0], /TEST_ACCESS_1|TEST_REFRESH_1/);
  const first=await svc.search('perchas');
  assert.equal(first.items.length,2);
  assert.equal(first.items[0].priceArs,15499);
  assert.equal(first.items[0].verification,'api_oficial_ml');
  assert.equal(searchCount,1);
  assert.equal(bulkCount,1);
  const t=await store.load();t.expiresAt=0;await store.save(t);
  const tokens=await Promise.all([svc.accessToken(),svc.accessToken(),svc.accessToken()]);
  assert.deepEqual(tokens,['TEST_ACCESS_2','TEST_ACCESS_2','TEST_ACCESS_2']);
  assert.equal(refreshCount,1);
  assert.equal((await store.load()).refreshToken,'TEST_REFRESH_2');
  const second=await svc.search('MLA123456789');
  assert.equal(second.items.length,1); // La consulta ignora IDs adicionales que devolviera la API.
  assert.equal(searchCount,1); // Por ID va directo a /items/bulk.
});

test('no acepta búsquedas de tamaño arbitrario ni items falsos', async () => {
  const svc = new MercadoLibreService({env:env(),fetchImpl:async()=>{throw Error('No debió llamar API');},store:{load:async()=>null}});
  await assert.rejects(svc.search('a'), /2 a 100/);
  await assert.rejects(svc.search('x'.repeat(101)), /2 a 100/);
  await assert.rejects(svc.getItems(['invalido']),/IDs MLA válidos/);
});
