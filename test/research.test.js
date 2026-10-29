import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'guicon-test-research-'));
process.env.GUICON_DATA_DIR = tmp;
const { parseResearch, extractCitations, performDiscovery, startResearch, listResearch, friendlyApiError, verifyMercadoListings } = await import('../src/research.js');

const fakeProduct = { summary:'3 fuentes', products:[{ name:'Organizador de cables', category:'Oficina',
  rationale:'Referencias comerciales a comparar', risks:'Sin precios comprobados', argentina:'Fabricación por consultar',china:'Cotización por consultar',advertising:'CAC pendiente',
  sources:[{url:'https://ejemplo.com/producto',title:'Fuente',type:'mercado',note:'Referencia de producto'},
    {url:'javascript:alert(1)',title:'X',type:'otro',note:'peligroso'}]}] };

test('parseResearch filtra enlaces inválidos y NO inventa márgenes',()=>{
  const parsed=parseResearch('```json\n'+JSON.stringify(fakeProduct)+'\n```',['https://ejemplo.com/producto']);
  assert.equal(parsed.products.length,1);
  assert.equal(parsed.products[0].sources.length,1);
  assert.equal(parsed.products[0].sources[0].cited,true);
  assert.equal(parsed.products[0].status,'pendiente_de_cotizacion');
  assert.equal(parsed.products[0].unitProfitArs,undefined);
});
test('rechaza investigaciones sin fuentes y JSON corrupto',()=>{
  assert.throws(()=>parseResearch('{mal'), /JSON válido/);
  assert.throws(()=>parseResearch(JSON.stringify({products:[{name:'Producto',sources:[]}]})),/con enlaces/);
});
test('consulta Responses con web_search, 5 llamadas máximo y datos de gastos publicitarios',async()=>{
  process.env.OPENAI_API_KEY='sk-falso-para-test';
  let sent;
  const fakeFetch=async (_url,options)=>{
    sent=JSON.parse(options.body);
    return { ok:true,json:async()=>({model:'test',usage:{input_tokens:200,output_tokens:300},output:[
      {type:'web_search_call'},
      {type:'message',content:[{type:'output_text',text:JSON.stringify(fakeProduct),annotations:[{type:'url_citation',url:'https://ejemplo.com/producto'}]}]}
    ]}) };
  };
  const result=await performDiscovery({focus:'organización'},fakeFetch);
  assert.equal(sent.max_tool_calls,5);
  assert.equal(sent.tools[0].type,'web_search');
  assert.equal(sent.tool_choice,'required');
  assert.match(sent.input,/3000000/);
  assert.match(sent.instructions,/publicidad/);
  assert.equal(result.webSearchCalls,1);
  assert.equal(result.products[0].sources[0].cited,true);
});
test('programa investigación sin bloquear y guarda resultados',async()=>{
  process.env.OPENAI_API_KEY='sk-falso-para-test';
  process.env.MAX_RESEARCH_RUNS_PER_DAY='1';
  process.env.PAID_API_ENABLED='true'; // Se usa un descubridor simulado: no hay llamada real a OpenAI.
  const job=startResearch({},async()=>({products:parseResearch(JSON.stringify(fakeProduct)).products,model:'test'}));
  assert.equal(job.status,'running');
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(listResearch()[0].status,'completed');
  assert.throws(()=>startResearch({}, async()=>({})),/Límite/);
  process.env.PAID_API_ENABLED='false';
});

test('presenta errores accionables para credenciales, saldo y modelo', () => {
  assert.match(friendlyApiError(401, {}), /clave.*inválida/i);
  assert.match(friendlyApiError(429, { error: { code: 'insufficient_quota' } }), /saldo/i);
  assert.match(friendlyApiError(400, { error: { message: 'The model is not available' } }), /RESEARCH_MODEL/);
});
