/**
 * JavaScript (Node.js): servidor HTTP nativo, sin paquetes extra.
 * Local: escucha en localhost. En Render: escucha en 0.0.0.0 con acceso protegido.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { calculateOffer, normalizeOffer, CAPITAL_ARS } from './finance.js';
import { readOffers, saveOffers } from './storage.js';
import { explainWithAI, aiAvailable, aiModel } from './ai.js';
import { listResearch, researchStatus, startResearch, startResearchScheduler, markInterruptedResearch } from './research.js';
import { loadLocalEnv, getDiagnostics } from './diagnostics.js';
import { mercadoLibre, mlReady, makeOAuthState, validateOAuthState, oauthCookie, getOAuthCookie, authorizationUrl, ML_CALLBACK_PATH } from './mercadolibre.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Lee la configuración privada antes de responder solicitudes; no expone la clave.
loadLocalEnv(root);

// Seguridad (Node.js): en Internet, protegemos TODAS las pantallas y rutas API.
// El navegador mostrará un cuadro para usuario y contraseña (Basic Auth sobre HTTPS).
function onlineMode() {
  return process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
}
function safeEqual(a, b) {
  const x = createHash('sha256').update(a, 'utf8').digest();
  const y = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(x, y);
}
function authorized(req) {
  if (!onlineMode()) return true; // Desarrollo local conserva el acceso habitual.
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ') || header.length > 1500) return false;
  let decoded;
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); }
  catch { return false; }
  const pos = decoded.indexOf(':');
  if (pos < 0) return false;
  return safeEqual(decoded.slice(0, pos), process.env.APP_USERNAME || '') &&
         safeEqual(decoded.slice(pos + 1), process.env.APP_PASSWORD || '');
}
function originAllowed(req) {
  // Los navegadores no pueden modificar datos desde una página de otro dominio.
  if (!['POST','PUT','DELETE','PATCH'].includes(req.method)) return true;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (!req.headers.origin) return true; // Se admite uso desde scripts sin Origin.
  try { return new URL(req.headers.origin).host === req.headers.host; }
  catch { return false; }
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff' });
  res.end(JSON.stringify(obj));
}
async function body(req) {
  let input = ''; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 60000) throw Object.assign(new Error('El formulario es demasiado grande'), { status: 413 });
    input += chunk;
  }
  try { return JSON.parse(input || '{}'); }
  catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}
function completeOffer(o) { return { ...o, metrics: calculateOffer(o) }; }
function compareFor(name, all) {
  return all.filter(o => o.productName.trim().toLocaleLowerCase('es') === name.trim().toLocaleLowerCase('es'))
    .map(o => ({ id:o.id, supplier:o.supplierName, type:o.sourcingType, status:o.quoteStatus, metrics:calculateOffer(o) }));
}
function csv(offers) {
  const cols = ['productName','category','supplierName','sourcingType','quoteStatus','currency','unitPurchase','quantity','salePrice','adsPct','adsPerSale','launchAdsBudget','landedUnitArs','unitProfitArs','marginPct','initialOutlayArs','totalProfitArs','sourceUrl'];
  const quote = value => `"${String(value ?? '').replaceAll('"','""')}"`;
  return '\ufeff' + [cols.join(';'), ...offers.map(o => {
    const m=calculateOffer(o); return cols.map(k => quote(o[k] ?? m[k])).join(';');
  })].join('\r\n');
}
const assets = { '/': ['public/index.html','text/html; charset=utf-8'], '/app.js': ['public/app.js','text/javascript; charset=utf-8'], '/styles.css': ['public/styles.css','text/css; charset=utf-8'], '/research-ui.js': ['public/research-ui.js','text/javascript; charset=utf-8'], '/ml-ui.js': ['public/ml-ui.js','text/javascript; charset=utf-8'] };
export const server = http.createServer(async (req,res) => {
  try {
    // El callback de ML vuelve desde otro dominio y no puede llevar la cabecera Basic Auth.
    // Solo se acepta con state firmado + cookie HttpOnly, asociados al navegador iniciador.
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    if (req.method === 'GET' && pathname === ML_CALLBACK_PATH) {
      const clearCookie = oauthCookie(req, '', 0);
      try {
        if (!validateOAuthState(url.searchParams.get('state'), getOAuthCookie(req), process.env.ML_TOKEN_ENCRYPTION_KEY || '')) {
          return json(res, 403, { error: 'Autorización inválida o vencida. Volvé a comenzar desde Import_app.' });
        }
        if (url.searchParams.has('error')) {
          res.writeHead(303, {Location:'/?ml=cancelled#mercadolibre', 'Set-Cookie':clearCookie,
            'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer'});
          return res.end();
        }
        await mercadoLibre.exchangeCode(url.searchParams.get('code'), getOAuthCookie(req).split('.')[2]);
        res.writeHead(303, { Location:'/?ml=connected#mercadolibre', 'Set-Cookie':clearCookie,
          'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer' });
        return res.end();
      } catch (error) {
        console.error('No se completó OAuth Mercado Libre:', error.message); // No se registran tokens ni códigos.
        res.writeHead(303, { Location:'/?ml=error#mercadolibre', 'Set-Cookie':clearCookie,
          'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer' });
        return res.end();
      }
    }
    if (!authorized(req)) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Import_app", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      return res.end('Acceso privado: ingresá tu usuario y contraseña de Import_app.');
    }
    if (!originAllowed(req)) return json(res, 403, {error:'Solicitud de otro origen bloqueada'});
    if (req.method === 'GET' && pathname === '/auth/mercadolibre/start') {
      if (!mlReady()) return json(res,503,{error:'Faltan variables OAuth o almacenamiento persistente. Consultá la sección Mercado Libre.'});
      const {nonce,cookieValue,verifier} = makeOAuthState(process.env.ML_TOKEN_ENCRYPTION_KEY);
      res.writeHead(302, {Location:authorizationUrl(process.env, nonce, verifier), 'Set-Cookie':oauthCookie(req,cookieValue),
        'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff'});
      return res.end();
    }
    if (req.method === 'GET' && pathname === '/api/ml/status') return json(res,200,await mercadoLibre.status());
    if (req.method === 'GET' && pathname === '/api/ml/diagnostics') {
      const id = (url.searchParams.get('id') || 'MLA1407266827').trim().toUpperCase();
      return json(res,200,await mercadoLibre.diagnose(id));
    }
    if (req.method === 'GET' && pathname === '/api/ml/search') {
      const q = url.searchParams.get('q') || '';
      const limit = Number(url.searchParams.get('limit') || 12);
      return json(res,200,await mercadoLibre.search(q,limit));
    }
    if (req.method === 'GET' && assets[pathname]) {
      const [file,mime]=assets[pathname];
      const buf=await fs.readFile(path.join(root,file));
      res.writeHead(200, { 'Content-Type':mime,'Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'",'X-Content-Type-Options':'nosniff' });
      return res.end(buf);
    }
    if (req.method === 'GET' && pathname === '/api/status') return json(res,200,{version:'0.5.3', capitalArs:CAPITAL_ARS, aiEnabled:aiAvailable(),model:aiAvailable()?aiModel():null, research:researchStatus(),paidEnabled:process.env.PAID_API_ENABLED === 'true'});
    if (req.method === 'GET' && pathname === '/api/research/demo') return json(res,200, {
      simulated:true, status:'simulated', startedAt:new Date().toISOString(), results:{
        model:'SIMULACIÓN LOCAL', webSearchCalls:0, usage:{input_tokens:0,output_tokens:0},
        summary:'Esto es una prueba de la interfaz con datos FICTICIOS. No consulta Internet, no busca proveedores y no gasta créditos.',
        products:[
          {name:'EJEMPLO: organizador de cocina',category:'Hogar',rationale:'Sirve para mostrar cómo se visualizaría un candidato.',argentina:'No investigado',china:'No investigado',advertising:'Costo aún desconocido',risks:'Falta validación comercial',marketListings:[{title:'Publicación FICTICIA',id:'MLA000000000',url:'https://www.mercadolibre.com.ar/',priceArs:null,verification:'referencia_web_sin_validar',cited:false}],suppliers:[{name:'Proveedor argentino FICTICIO',origin:'argentina_fabricante',sourceUrl:'https://example.com/',contactUrl:'https://example.com/',contactStatus:'ficha_sin_verificar'}],sources:[]},
          {name:'EJEMPLO: accesorio de mascotas',category:'Mascotas',rationale:'Producto de prueba, sin demanda ni precios verificados.',argentina:'No investigado',china:'No investigado',advertising:'Costo aún desconocido',risks:'Falta validación comercial',sources:[]}
        ]
      }
    });
    if (req.method === 'GET' && pathname === '/api/research/sources-status') return json(res,200,{
      mercadoLibre:mlReady() ? 'OAuth configurado: consultar estado de conexión en /api/ml/status' : process.env.ML_ACCESS_TOKEN ? 'Token manual (aún sin validar online)' : 'OAuth no completado: precios sin confirmar por API',
      china:'Búsqueda web con IA; sin acceso privado a 1688',
      argentina:'Búsqueda web de empresas y fabricantes',
      contacts:'Enlace a ficha del proveedor; otros contactos requieren fuente',
      paidBlocked:process.env.PAID_API_ENABLED !== 'true',verifiedLive:false
    });
    if (req.method === 'GET' && pathname === '/api/research/diagnostics') return json(res,200,getDiagnostics(root));
    if (req.method === 'GET' && pathname === '/api/research') return json(res,200,{ jobs:listResearch(), ...researchStatus() });
    if (req.method === 'POST' && pathname === '/api/research/start') {
      const payload=await body(req);
      if (payload.focus !== undefined && (typeof payload.focus !== 'string' || payload.focus.length > 180)) return json(res,400,{error:'El foco debe ser texto de hasta 180 caracteres'});
      return json(res,202,startResearch({focus:payload.focus || ''}));
    }
    if (req.method === 'GET' && pathname === '/api/offers') return json(res,200,readOffers().map(completeOffer));
    if (req.method === 'POST' && pathname === '/api/calculate') {
      const offer = normalizeOffer(await body(req)); return json(res,200,calculateOffer(offer));
    }
    if (req.method === 'POST' && pathname === '/api/offers') {
      const o = normalizeOffer(await body(req));
      const offer = { ...o, id:randomUUID(), createdAt:new Date().toISOString() };
      const offers=readOffers(); offers.push(offer); saveOffers(offers);
      return json(res,201,completeOffer(offer));
    }
    if (req.method === 'PUT' && /^\/api\/offers\/[a-f0-9-]{36}$/.test(pathname)) {
      const id=pathname.split('/').pop(), all=readOffers(), index=all.findIndex(o=>o.id===id);
      if (index<0) return json(res,404,{error:'Evaluación no encontrada'});
      all[index]={...normalizeOffer(await body(req)),id,createdAt:all[index].createdAt,updatedAt:new Date().toISOString()};
      saveOffers(all); return json(res,200,completeOffer(all[index]));
    }
    if (req.method === 'DELETE' && /^\/api\/offers\/[a-f0-9-]{36}$/.test(pathname)) {
      const all=readOffers(), next=all.filter(o=>o.id!==pathname.split('/').pop());
      if (next.length===all.length) return json(res,404,{error:'Evaluación no encontrada'});
      saveOffers(next); return json(res,200,{deleted:true});
    }
    if (req.method === 'GET' && pathname === '/api/export.csv') {
      const value=csv(readOffers());
      res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="guicon-ai-comparador.csv"'});
      return res.end(value);
    }
    if (req.method === 'POST' && pathname === '/api/ai/analyze') {
      if (process.env.PAID_API_ENABLED !== 'true') return json(res,503,{error:'API de pago desactivada. Para usarla voluntariamente cambiá PAID_API_ENABLED=true en .env y reiniciá el servidor.'});
      const {id}=await body(req);
      const all=readOffers();const offer=all.find(o=>o.id===id);
      if (!offer) return json(res,404,{error:'Primero guardá una evaluación'});
      const analysis=await explainWithAI(offer, calculateOffer(offer), compareFor(offer.productName,all));
      return json(res,200,analysis);
    }
    if (pathname.startsWith('/api/')) return json(res,404,{error:'Ruta no encontrada'});
    json(res,404,{error:'Archivo no encontrado'});
  } catch (err) {
    const status=err.status || (/inválid|mayor|menor|necesita|Indicá|Cargá|porcentaje|Cantidad|MOQ|proveedor|moneda|enlace|precio de venta|valor inválido/i.test(err.message)?400:500);
    if (status >= 500 && status !== 503) console.error('Error de servidor:', err.message);
    json(res,status,{error:status>=500 && status!==502 && status!==503 && status!==504?'Error interno':err.message,
      ...(err.ml ? {ml:err.ml} : {})});
  }
});
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  const port = Number(process.env.PORT) || 3000;
  if (onlineMode() && (
    !(process.env.APP_USERNAME || '').trim() ||
    (process.env.APP_PASSWORD || '').length < 16
  )) {
    console.error('Configuración de seguridad incompleta: definí APP_USERNAME y APP_PASSWORD (16 caracteres o más) en Render > Environment.');
    process.exit(1);
  }
  markInterruptedResearch();
  const host = onlineMode() ? '0.0.0.0' : '127.0.0.1';
  server.listen(port, host, () => {
    console.log(`Import_app 0.5.3: servidor iniciado en ${host}:${port}`);
    console.log('API de pago:', process.env.PAID_API_ENABLED === 'true' ? 'HABILITADA (puede generar cargos)' : 'BLOQUEADA (cero cargos de OpenAI por esta app)');
    const diagnostics = getDiagnostics(root);
    console.log(diagnostics.apiKeyPresent ? `Investigación: configurada localmente (${diagnostics.researchModel}).` : 'Investigación: falta OPENAI_API_KEY. Ejecutá: npm run doctor');
    startResearchScheduler();
  });
}
