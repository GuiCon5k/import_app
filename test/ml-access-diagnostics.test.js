import test from 'node:test';
import assert from 'node:assert/strict';
import { MercadoLibreService } from '../src/mercadolibre.js';

const env = {
  ML_CLIENT_ID:'123456', ML_CLIENT_SECRET:'TEST_ONLY',
  ML_REDIRECT_URI:'https://example.com/auth/mercadolibre/callback',
  ML_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),
  UPSTASH_REDIS_REST_URL:'https://fake.upstash.io',
  UPSTASH_REDIS_REST_TOKEN:'FAKE'
};
const token={accessToken:'TOP_SECRET_TEST_TOKEN',refreshToken:'TOP_SECRET_TEST_REFRESH',expiresAt:Date.now()+300000};
function response(status,data) { return {ok:status>=200 && status<300,status,json:async()=>data}; }
function service(fakeFetch, store={load:async()=>token}) {
  return new MercadoLibreService({env,fetchImpl:fakeFetch,store});
}

test('diagnóstico distingue cuenta válida de catálogo bloqueado y no expone tokens', async () => {
  let calls=0;
  const fetchImpl=async (href,options) => {
    calls++;
    assert.equal(options.headers.Authorization,'Bearer TOP_SECRET_TEST_TOKEN');
    const {pathname}=new URL(href);
    if(pathname==='/users/me') return response(200,{id:486582552,nickname:'no_exponer_datos'});
    if(pathname==='/users/486582552/items/search') return response(200,{results:[]});
    if(pathname==='/applications/123456') return response(200,{active:true,secret:'no_exponer_datos'});
    if(pathname==='/sites/MLA/search') return response(403,{code:'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',blocked_by:'PolicyAgent',message:'SECRETO REMOTO'});
    if(pathname==='/items/bulk') return response(200,[{id:'MLA1407266827',status_code:403,body:{code:'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',blocked_by:'PolicyAgent',access_token:'SECRETO REMOTO'}}]);
    if(pathname==='/items/MLA1407266827') return response(403,{code:'FORBIDDEN',message:'SECRETO REMOTO'});
    throw Error('Ruta inesperada: '+pathname);
  };
  const svc=service(fetchImpl);
  const result=await svc.diagnose('MLA1407266827');
  assert.equal(result.checks.length,6);
  assert.equal(result.checks[0].httpStatus,200);
  assert.equal(result.checks[1].httpStatus,200);
  assert.equal(result.checks[2].active,true);
  assert.equal(result.checks[3].httpStatus,403);
  assert.equal(result.checks[3].code,'PA_UNAUTHORIZED_RESULT_FROM_POLICIES');
  assert.equal(result.checks[4].httpStatus,403);
  assert.equal(result.checks[4].blockedBy,'PolicyAgent');
  assert.match(result.interpretation,/token identifica correctamente/i);
  assert.doesNotMatch(JSON.stringify(result),/TOP_SECRET|SECRETO REMOTO|no_exponer/);
  const second=await svc.diagnose('MLA1407266827');
  assert.equal(second.cached,true);
  assert.equal(calls,6);
  await assert.rejects(svc.diagnose('MLA1418175105'),e=>e.status===429);
  assert.equal(calls,6); // Cambiar el ID no permite una nueva tanda durante el minuto.
});

test('diagnóstico rechaza IDs arbitrarios y no inventa publicación propia',async()=>{
  let calls=[];
  const svc=service(async (href)=>{
    const {pathname}=new URL(href);calls.push(pathname);
    if(pathname==='/users/me') return response(200,{id:12345});
    if(pathname==='/users/12345/items/search') return response(200,{results:[]});
    if(pathname==='/applications/123456') return response(200,{active:false});
    if(pathname==='/sites/MLA/search') return response(200,{results:[]});
    if(pathname==='/items/bulk') return response(200,[{id:'MLA123456789',status_code:404}]);
    if(pathname==='/items/MLA123456789') return response(404,{error:'not_found'});
    throw Error(pathname);
  });
  await assert.rejects(svc.diagnose('https://evil.example/a'),/ID de publicación/);
  const r=await svc.diagnose('MLA123456789');
  assert.equal(r.checks.find(x=>x.name==='Estado de la aplicación').active,false);
  assert.match(r.interpretation,/inactiva/);
  assert.equal(r.checks.find(x=>x.name==='Lectura de publicación de referencia').httpStatus,404);
  assert.equal(calls.length,6);
  assert.equal(calls.some(x=>x.includes('items/bulk') && x.includes('users/')),false);
});

test('búsqueda real conserva resultados de /search cuando /items/bulk devuelve 403 por ID',async()=>{
  const svc=service(async (href)=>{
    const {pathname}=new URL(href);
    if(pathname==='/sites/MLA/search') return response(200,{paging:{total:1},results:[{id:'MLA123456789',title:'Percha pantalones',price:12000,currency_id:'ARS',status:'active'}]});
    if(pathname==='/items/bulk') return response(200,[{id:'MLA123456789',status_code:403,body:{code:'PA_UNAUTHORIZED_RESULT_FROM_POLICIES'}}]);
    throw Error(pathname);
  });
  const data=await svc.search('perchas');
  assert.equal(data.items.length,1);
  assert.equal(data.items[0].priceArs,12000);
  assert.equal(data.items[0].verification,'api_ml_busqueda_sin_bulk');
  assert.match(data.warning,/SIN doble verificación/);
  assert.equal(data.diagnostics[0].code,'PA_UNAUTHORIZED_RESULT_FROM_POLICIES');
});

test('búsqueda real conserva resultados de /search si bulk entero devuelve HTTP 403',async()=>{
  const svc=service(async (href)=>{
    const {pathname}=new URL(href);
    if(pathname==='/sites/MLA/search') return response(200,{paging:{total:1},results:[{id:'MLA123456789',title:'Perchas',price:13000,currency_id:'ARS'}]});
    if(pathname==='/items/bulk') return response(403,{code:'PA_UNAUTHORIZED_RESULT_FROM_POLICIES'});
    throw Error(pathname);
  });
  const data=await svc.search('perchas');
  assert.equal(data.items.length,1);
  assert.equal(data.items[0].verification,'api_ml_busqueda_sin_bulk');
});
