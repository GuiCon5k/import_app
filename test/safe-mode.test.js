import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';
import { startResearch, parseResearch, verifyMercadoListings, marketPriceStats } from '../src/research.js';
import { getDiagnostics } from '../src/diagnostics.js';

// JavaScript + Node.js: prueba el modo seguro, sin solicitudes externas ni clave real.
test('diagnóstico y demo responden sin API; la investigación de pago permanece bloqueada', async () => {
  const previousPaid = process.env.PAID_API_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.PAID_API_ENABLED = 'false';
  process.env.OPENAI_API_KEY = 'sk-proj-TEST_ONLY_NOT_A_REAL_KEY_123456';
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const d = await fetch(base + '/api/research/diagnostics').then(r => r.json());
    assert.equal(d.version, '0.4.1');
    assert.equal(d.paidEnabled, false);
    assert.equal(d.liveApiVerified, false);
    assert.doesNotMatch(JSON.stringify(d), /TEST_ONLY_NOT_A_REAL_KEY/);
    const demoResponse = await fetch(base + '/api/research/demo');
    assert.equal(demoResponse.status, 200);
    const demo = await demoResponse.json();
    assert.equal(demo.simulated, true);
    assert.equal(demo.results.webSearchCalls, 0);
    assert.equal(demo.results.usage.input_tokens, 0);
    assert.equal(demo.results.products.length, 2);
    assert.equal(demo.results.products[0].sources.length, 0);
    const runResponse = await fetch(base + '/api/research/start', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
    assert.equal(runResponse.status, 503);
    assert.match((await runResponse.json()).error, /bloqueado/i);
    assert.throws(() => startResearch({}, async () => ({})), /bloqueado/);
    assert.equal(getDiagnostics(undefined, process.env).paidEnabled, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previousPaid === undefined) delete process.env.PAID_API_ENABLED; else process.env.PAID_API_ENABLED = previousPaid;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});

// JavaScript + node:test: pruebas con respuestas simuladas, NUNCA con credenciales.
const mockSource='https://www.mercadolibre.com.ar/organizador-ejemplo/p/MLA123456789';
const argSource='https://fabricante-ejemplo.com.ar/catalogo/organizador';
const chinaSource='https://fabricaejemplo.en.made-in-china.com/product/organizador.html';
const richer={summary:'Ejemplo',products:[{name:'Organizador',category:'Hogar',rationale:'Comparar',
  marketListings:[{title:'Organizador',url:mockSource,priceArs:50000,seller:'Empresa'}],
  suppliers:[
    {name:'Fábrica AR',origin:'argentina_fabricante',sourceUrl:argSource,phone:'+54 11 4567 8901',email:'ventas@fabricante-ejemplo.com.ar',inquiryUrl:'https://inventado.com/contacto'},
    {name:'Fábrica CN',origin:'china_made_in_china',sourceUrl:chinaSource,inquiryUrl:chinaSource},
    {name:'Ataque',origin:'china_1688',sourceUrl:'https://maldominio.test/producto'}
  ], sources:[{url:mockSource,type:'mercado'},{url:argSource,type:'argentina'},{url:chinaSource,type:'china'}]
}]};
test('extrae publicaciones individuales y proveedores con contacto sin dar por verificado el precio',()=>{
  const r=parseResearch(JSON.stringify(richer),[mockSource,argSource,chinaSource]);
  assert.equal(r.products[0].marketListings.length,1);
  assert.equal(r.products[0].marketListings[0].priceArs,null); // La IA nunca confirma precios.
  assert.equal(r.products[0].marketListings[0].verification,'referencia_web_sin_validar');
  assert.equal(r.products[0].suppliers.length,2); // Descarta proveedor chino con dominio falso.
  assert.equal(r.products[0].suppliers[0].contactUrl,argSource); // No acepta URL de contacto inventada.
  assert.equal(r.products[0].suppliers[0].email,'ventas@fabricante-ejemplo.com.ar');
  assert.equal(r.products[0].status,'pendiente_de_cotizacion');
});
test('verifica precio SOLO desde API de ML, no desde salida del modelo', async()=>{
  const r=parseResearch(JSON.stringify(richer),[mockSource,argSource,chinaSource]);
  let path='';
  const fakeFetch=async (url,options)=>{
    path=url;
    assert.match(options.headers.Authorization,/^Bearer token-de-test$/);
    return {ok:true,json:async()=>[{status_code:200,id:'MLA123456789',body:{id:'MLA123456789',title:'Organizador real',price:25789,currency_id:'ARS',status:'active',seller_id:123}}]};
  };
  const result=await verifyMercadoListings(r.products,fakeFetch,'token-de-test');
  assert.match(path,/items\/bulk\?ids=MLA123456789/);
  assert.equal(result.checked,1);
  assert.equal(r.products[0].marketListings[0].priceArs,25789);
  assert.equal(r.products[0].marketListings[0].verification,'api_oficial_ml');
  assert.equal(r.products[0].marketListings[0].claimedPriceArs,50000);
});
test('sin ML token no consulta Internet ni inventa precios',async()=>{
  const r=parseResearch(JSON.stringify(richer));
  const result=await verifyMercadoListings(r.products,()=>{throw new Error('fetch no debe llamarse')},'');
  assert.equal(result.checked,0);
  assert.equal(r.products[0].marketListings[0].priceArs,null);
});
test('error de ML no bloquea búsqueda ni eleva precio simulado a real',async()=>{
  const r=parseResearch(JSON.stringify(richer));
  const result=await verifyMercadoListings(r.products,async()=>({ok:false,status:401}),'token-falso');
  assert.equal(result.checked,0);
  assert.match(result.message,/401/);
  assert.equal(r.products[0].marketListings[0].priceArs,null);
});

test('compara precios de 2 o más publicaciones oficiales sin usar valores sugeridos por IA',()=>{
  const items=[{priceArs:10000,currency:'ARS',verification:'api_oficial_ml'},
    {priceArs:15000,currency:'ARS',verification:'api_oficial_ml'},
    {priceArs:100000,currency:'ARS',verification:'referencia_web_sin_validar'}];
  const stats=marketPriceStats(items);
  assert.equal(stats.count,2);
  assert.equal(stats.medianArs,12500);
  assert.equal(stats.maximumArs,15000);
  assert.equal(marketPriceStats(items.slice(0,1)),null);
});
