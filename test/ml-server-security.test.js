import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { server } from '../src/server.js';
import { mercadoLibre } from '../src/mercadolibre.js';

// HTTP end-to-end sin acceder a la red: OAuth redirecciones y cookies seguras.
test('Render protege inicio OAuth y APIs; callback exige state firmado; autoriza luego de validarlo', async () => {
  const names=['NODE_ENV','APP_USERNAME','APP_PASSWORD','ML_CLIENT_ID','ML_CLIENT_SECRET','ML_REDIRECT_URI',
    'ML_TOKEN_ENCRYPTION_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','ML_PKCE_ENABLED'];
  const original=Object.fromEntries(names.map(key=>[key,process.env[key]]));
  Object.assign(process.env,{
    NODE_ENV:'production',APP_USERNAME:'tester',APP_PASSWORD:'password_de_prueba_larga_12345',
    ML_CLIENT_ID:'12345',ML_CLIENT_SECRET:'FALSA_NO_REAL',
    ML_REDIRECT_URI:'https://import-app-guicon.onrender.com/auth/mercadolibre/callback',
    ML_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('hex'),
    UPSTASH_REDIS_REST_URL:'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN:'NO_REAL_TOKEN', ML_PKCE_ENABLED:'true'
  });
  const exchange = mercadoLibre.exchangeCode;
  let called=0, verifier;
  mercadoLibre.exchangeCode = async (code,codeVerifier)=> { called++; assert.equal(code,'testcode123'); verifier=codeVerifier; };
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const auth='Basic '+Buffer.from('tester:password_de_prueba_larga_12345').toString('base64');
  try {
    assert.equal((await fetch(base+'/auth/mercadolibre/start',{redirect:'manual'})).status,401);
    assert.equal((await fetch(base+'/api/ml/search?q=perchas')).status,401);
    const start=await fetch(base+'/auth/mercadolibre/start',{redirect:'manual',headers:{Authorization:auth}});
    assert.equal(start.status,302);
    const location=new URL(start.headers.get('location'));
    assert.equal(location.hostname,'auth.mercadolibre.com.ar');
    assert.equal(location.searchParams.get('code_challenge_method'),'S256');
    const cookieHeader=start.headers.get('set-cookie');
    assert.match(cookieHeader,/HttpOnly/);
    assert.match(cookieHeader,/SameSite=Lax/);
    assert.match(cookieHeader,/Secure/);
    const rawCookie=cookieHeader.split(';')[0];
    const invalid=await fetch(base+'/auth/mercadolibre/callback?code=testcode123&state=NOPE',{redirect:'manual',headers:{Cookie:rawCookie}});
    assert.equal(invalid.status,403);
    assert.equal(called,0);
    const valid=await fetch(base+`/auth/mercadolibre/callback?code=testcode123&state=${location.searchParams.get('state')}`,
      {redirect:'manual',headers:{Cookie:rawCookie}});
    assert.equal(valid.status,303);
    assert.equal(valid.headers.get('location'),'/?ml=connected#mercadolibre');
    assert.equal(called,1);
    assert.equal(verifier.length,43);
    const initial=await fetch(base+'/api/ml/status',{headers:{Authorization:auth}});
    // No hacemos GET de Upstash real: reemplazar store en esta misma instancia.
    assert.equal(initial.status,502);
  } finally {
    mercadoLibre.exchangeCode=exchange;
    await new Promise(resolve=>server.close(resolve));
    for(const name of names) original[name]===undefined ? delete process.env[name] : process.env[name]=original[name];
  }
});
