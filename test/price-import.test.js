import test from 'node:test';
import assert from 'node:assert/strict';
import { importPrices, listingId } from '../src/price-import.js';
import { MercadoLibreService } from '../src/mercadolibre.js';
const record={title:'Perchas pack x10',url:'https://proveedor.example/productos/perchas',sourceName:'Proveedor de prueba',
  evidence:'Ejemplo de cotización aportada, sin consulta remota',priceArs:12000,observedAt:'2026-01-01T12:00:00Z'};
test('importación conserva atribución y fecha sin aceptar verificación inyectada',()=>{
  const result=importPrices({records:[{...record,verification:'api_oficial_ml',checkedAt:'inventado',access_token:'NO_GUARDAR'}]});
  assert.equal(result.records[0].verification,'aportado_sin_verificacion_api');
  assert.equal(result.records[0].checkedAt,null);
  assert.equal(result.records[0].sourceName,record.sourceName);
  assert.doesNotMatch(JSON.stringify(result),/NO_GUARDAR|inventado|api_oficial_ml/);
  assert.equal(importPrices(result).records[0].priceArs,12000); // Exportación e importación compatibles.
});
test('importación es atómica y rechaza enlaces privados, secretos en URL, precios y fechas inválidas',()=>{
  for(const url of ['javascript:alert(1)','https://user:secret@example.com/a','https://example.com/a?token=SECRET',
    'https://localhost/a','https://127.0.0.1/a','https://192.168.1.1/a','https://example.com/#secret'])
    assert.throws(()=>importPrices({records:[record,{...record,url}]}),e=>e.status===400);
  for(const priceArs of [0,-1,NaN,Infinity,'12000',1e13])
    assert.throws(()=>importPrices({records:[{...record,priceArs}]}));
  for(const observedAt of ['invalid','2026-02-30T12:00:00Z','2099-01-01T00:00:00Z'])
    assert.throws(()=>importPrices({records:[{...record,observedAt}]}));
  assert.throws(()=>importPrices({records:Array(101).fill(record)}));
});
test('URL de publicación consulta solo API oficial; 403 no causa reintentos ni scraping',async()=>{
  const calls=[];
  const svc=new MercadoLibreService({store:{},fetchImpl:async(url,options)=>{
    calls.push(url); assert.equal(options.redirect,'error');
    return {ok:false,status:403,json:async()=>({error:'access_denied',message:'SECRET_REMOTE'})};
  }});
  svc.accessToken=async()=> 'TEST_ONLY';
  await assert.rejects(svc.search('https://articulo.mercadolibre.com.ar/MLA-1418175105-perchas-_JM'),e=>e.status===403 && !e.message.includes('SECRET_REMOTE'));
  assert.equal(calls.length,1);
  assert.equal(new URL(calls[0]).origin,'https://api.mercadolibre.com');
  assert.equal(new URL(calls[0]).searchParams.get('ids'),'MLA1418175105');
  for(const url of ['https://mercadolibre.com.ar.evil.com/MLA-1418175105-a','https://www.mercadolibre.com.ar/p/MLA1418175105',
    'https://articulo.mercadolibre.com.ar/MLA-1418175105-a?token=secret']) assert.throws(()=>listingId(url));
  await assert.rejects(svc.apiGet('https://evil.example/items'),e=>e.status===400);
  assert.equal(calls.length,1);
});
