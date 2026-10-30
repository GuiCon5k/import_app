/** JavaScript + Node.js: OAuth Mercado Libre, refresh y consultas oficiales.
 * El client_secret y los tokens solo pasan por el servidor; no llegan al frontend. */
import { randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { RedisTokenStore, storeConfigured } from './ml-store.js';
import { listingId } from './price-import.js';

export const ML_CALLBACK_PATH = '/auth/mercadolibre/callback';
const AUTH_URL = 'https://auth.mercadolibre.com.ar/authorization';
const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const API_URL = 'https://api.mercadolibre.com';
const COOKIE = 'guicon_ml_state';
const STATE_TTL_MS = 10 * 60 * 1000;

// Mostramos solo códigos controlados por caracteres seguros; nunca eco de respuestas ni credenciales.
function safeMlCode(value) { return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,90}$/.test(value) ? value : null; }
function mlFailure(status, endpoint, payload) {
  const code = safeMlCode(payload?.code) || safeMlCode(payload?.error);
  const blockedBy = safeMlCode(payload?.blocked_by);
  const scopeHint = code === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' || code === 'FORBIDDEN';
  const message = status === 403
    ? endpoint === 'sites/MLA/search'
      ? 'Mercado Libre rechazó la búsqueda por palabras (403). La autenticación no garantiza acceso a este recurso. La causa exacta requiere revisión en Developers o soporte.'
      : 'Mercado Libre rechazó el acceso a este recurso (403). No se puede deducir un permiso concreto ni garantizar acceso a terceros. Usá referencias aportadas o consultá soporte.'
    : status === 401 ? 'Mercado Libre rechazó el acceso (401). Probá reconectar la cuenta.'
    : status === 429 ? 'Mercado Libre limitó temporalmente las consultas (429).'
    : `Mercado Libre respondió HTTP ${status}.`;
  const err = fail(message, [401,403,429].includes(status) ? status : 502);
  err.ml = { endpoint, httpStatus:status, ...(code ? {code}:{}), ...(blockedBy ? {blockedBy}:{}), ...(scopeHint ? {possiblePermissionIssue:true}:{} ) };
  return err;
}

function fail(message, status = 502) { return Object.assign(new Error(message), { status }); }
function safeString(x, max = 200) { return typeof x === 'string' ? x.slice(0, max) : ''; }
export function mlConfigured(env = process.env) {
  try {
    return Boolean(env.ML_CLIENT_ID && env.ML_CLIENT_SECRET && env.ML_REDIRECT_URI &&
      new URL(env.ML_REDIRECT_URI).protocol === 'https:' && new URL(env.ML_REDIRECT_URI).pathname === ML_CALLBACK_PATH);
  } catch { return false; }
}
export function mlReady(env = process.env) { return mlConfigured(env) && storeConfigured(env); }
function stateSignature(state, timestamp, verifier, secret) {
  return createHmac('sha256', secret).update(`oauth-state:${state}:${timestamp}:${verifier}`).digest('base64url');
}
export function makeOAuthState(secret, now = Date.now()) {
  const nonce = randomBytes(24).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const signed = stateSignature(nonce, now, verifier, secret);
  return { nonce, verifier, cookieValue: `${nonce}.${now}.${verifier}.${signed}` };
}
export function validateOAuthState(state, cookieValue, secret, now = Date.now()) {
  if (!secret || typeof state !== 'string' || typeof cookieValue !== 'string') return false;
  const [nonce, timestamp, verifier, signed, ...extra] = cookieValue.split('.');
  if (extra.length || !nonce || !/^\d{13}$/.test(timestamp || '') || !signed || !/^[a-zA-Z0-9_-]{43}$/.test(verifier || '')) return false;
  if (!/^[a-zA-Z0-9_-]{32}$/.test(nonce) || state !== nonce) return false;
  if (Number(timestamp) > now || now - Number(timestamp) > STATE_TTL_MS) return false;
  const expected = Buffer.from(stateSignature(nonce, Number(timestamp), verifier, secret));
  const actual = Buffer.from(signed);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function oauthCookie(req, value, maxAge = 600) {
  const secure = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  return `${COOKIE}=${encodeURIComponent(value)}; Path=${ML_CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
export function getOAuthCookie(req) {
  const entry = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`));
  if (!entry) return '';
  try { return decodeURIComponent(entry.slice(COOKIE.length + 1)); } catch { return ''; }
}
export function authorizationUrl(env, nonce, verifier) {
  const url = new URL(AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.ML_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.ML_REDIRECT_URI);
  url.searchParams.set('state', nonce);
  if (env.ML_PKCE_ENABLED === 'true') {
    url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}

// Reporte seguro: conserva solo códigos de API, nunca tokens ni cuerpos completos.
function apiErrorInfo(payload) {
  const data = payload?.body && typeof payload.body === 'object' ? payload.body : payload;
  const code = safeMlCode(data?.code) || safeMlCode(data?.error) || safeMlCode(data?.error_code);
  const blockedBy = safeMlCode(data?.blocked_by);
  return { ...(code ? {code} : {}), ...(blockedBy ? {blockedBy} : {}) };
}
function probeResult(name, endpoint, httpStatus, payload = null) {
  const info = apiErrorInfo(payload);
  const state = httpStatus >= 200 && httpStatus < 300 ? 'permitido' :
    httpStatus === 403 ? 'rechazado' : httpStatus === 401 ? 'no_autorizado' :
    httpStatus === 404 ? 'no_encontrado' : 'error';
  return { name, endpoint, httpStatus, state, ...info };
}

export class MercadoLibreService {
  constructor({ env = process.env, fetchImpl = fetch, store = null } = {}) {
    this.env = env;
    this.fetchImpl = fetchImpl;
    this.store = store || new RedisTokenStore({ env, fetchImpl });
    this.refreshPromise = null; // Evita gastar dos veces un refresh_token de un solo uso.
    this.diagnosticCache = null;
    this.diagnosticStartedAt = 0;
  }
  // Prueba controlada de accesos: una tanda por minuto, sin mostrar respuestas privadas.
  async diagnose(itemId = 'MLA1407266827') {
    if (!/^MLA\d{6,14}$/.test(itemId)) throw fail('Ingresá un ID de publicación MLA válido.', 400);
    if (!mlReady(this.env)) throw fail('Faltan variables OAuth o almacenamiento persistente.', 503);
    const stored = await this.store.load();
    if (!stored?.accessToken) throw fail('Conectá Mercado Libre antes de realizar el diagnóstico.', 409);
    const now = Date.now();
    if (this.diagnosticCache && this.diagnosticCache.itemId === itemId && now - this.diagnosticCache.time < 60_000)
      return {...this.diagnosticCache.value, cached:true};
    // Cambiar el ID o pulsar simultáneamente no habilita otra tanda en la misma instancia.
    if (now - this.diagnosticStartedAt < 60_000) throw fail('Esperá un minuto antes de iniciar otro diagnóstico.',429);
    this.diagnosticStartedAt = now;
    const checks = [];
    const check = async (name, path, params = undefined, evaluate = null) => {
      const endpoint = path.replace(/^\//,'');
      try {
        const payload = await this.apiGet(path, params);
        if (evaluate) {
          const result = evaluate(payload);
          checks.push(probeResult(name,endpoint,result.httpStatus,result.payload));
          return {payload, status:result.httpStatus};
        }
        checks.push(probeResult(name,endpoint,200));
        return {payload,status:200};
      } catch (err) {
        const status = err.ml?.httpStatus || (err.status >= 400 && err.status <= 599 ? err.status : 502);
        checks.push({name,endpoint,httpStatus:status,
          state: status === 403 ? 'rechazado' : status === 401 ? 'no_autorizado' : 'error',
          ...(err.ml?.code ? {code:err.ml.code} : {}),
          ...(err.ml?.blockedBy ? {blockedBy:err.ml.blockedBy} : {})});
        return {status};
      }
    };
    const me = await check('Identidad del token','/users/me');
    const meId = Number(me.payload?.id);
    if (me.status === 200 && Number.isSafeInteger(meId) && meId > 0) {
      const own = await check('Listado de publicaciones propias',`/users/${meId}/items/search`,{limit:1});
      const firstOwnId = own.payload?.results?.find(x => /^MLA\d{6,14}$/.test(String(x)));
      if (firstOwnId) await check('Lectura de una publicación propia','/items/bulk',{ids:firstOwnId},
        rows => {const row=Array.isArray(rows)?rows[0]:null;return {httpStatus:Number(row?.status_code ?? row?.code ?? 502),payload:row};});
    }
    const appId = String(this.env.ML_CLIENT_ID || '');
    if (/^\d{3,20}$/.test(appId)) {
      const app = await check('Estado de la aplicación',`/applications/${appId}`);
      if (app.status === 200) {
        const last = checks[checks.length-1];
        if (typeof app.payload?.active === 'boolean') last.active = app.payload.active;
      }
    }
    await check('Búsqueda general por palabras','/sites/MLA/search',{q:'perchas',limit:1});
    await check('Lectura de publicación de referencia','/items/bulk',{ids:itemId},
      rows => {const row=Array.isArray(rows)?rows.find(x => x?.id === itemId || x?.body?.id === itemId):null;
        return {httpStatus:Number(row?.status_code ?? row?.code ?? 502),payload:row};});
    await check('Consulta individual de referencia',`/items/${itemId}`);
    const identityOK = checks.some(x=>x.name==='Identidad del token' && x.httpStatus===200);
    const appInactive = checks.some(x=>x.name==='Estado de la aplicación' && x.active===false);
    const publicDenied = checks.some(x=>x.name==='Búsqueda general por palabras' && x.httpStatus===403) &&
      checks.some(x=>x.name==='Lectura de publicación de referencia' && x.httpStatus===403);
    const interpretation = appInactive
      ? 'Mercado Libre indica que la aplicación está inactiva. Revisá su estado en Developers antes de volver a autorizar.'
      : identityOK && publicDenied
      ? 'El token identifica correctamente la cuenta, pero Mercado Libre rechazó la búsqueda general y la publicación de referencia. No se conoce la causa exacta ni se confirmó que el ID pertenezca a terceros. Revisá la habilitación o elevá este reporte a soporte.'
      : !identityOK ? 'La identidad del token no pudo verificarse. Revisar autorización, permisos, validaciones de cuenta y estado de la aplicación.'
      : 'Compará los estados por endpoint: una ruta permitida no garantiza acceso a las demás.';
    const value={testedAt:new Date().toISOString(),itemId,checks,interpretation,cached:false};
    this.diagnosticCache={itemId,time:now,value};
    return value;
  }
  async status() {
    const configured = mlConfigured(this.env);
    const storageReady = storeConfigured(this.env);
    const result = { configured, storageReady, connected: false, userId: null, expiresAt: null,
      message: !configured ? 'Faltan ML_CLIENT_ID, ML_CLIENT_SECRET o ML_REDIRECT_URI.' :
        !storageReady ? 'Falta Upstash Redis y ML_TOKEN_ENCRYPTION_KEY para guardar tokens de manera persistente.' : 'Cuenta no conectada.' };
    if (!configured || !storageReady) return result;
    const tokens = await this.store.load();
    if (tokens) Object.assign(result, { connected: true, userId: tokens.userId || null,
      expiresAt: tokens.expiresAt, message: 'Cuenta conectada. Si caduca el acceso, se renovará al consultar la API.' });
    return result;
  }
  async tokenRequest(params) {
    let response;
    try {
      response = await this.fetchImpl(TOKEN_URL, { method: 'POST', signal: AbortSignal.timeout(12000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: new URLSearchParams({ ...params, client_id: this.env.ML_CLIENT_ID, client_secret: this.env.ML_CLIENT_SECRET }).toString() });
    } catch { throw fail('No se pudo contactar a Mercado Libre para autorizar la cuenta.'); }
    let data;
    try { data = await response.json(); } catch { throw fail('Mercado Libre respondió en un formato inesperado.'); }
    if (!response.ok || !data.access_token || !data.refresh_token) {
      // No se devuelven respuestas remotas completas: pueden contener datos sensibles.
      if (data?.error === 'invalid_grant') throw fail('La autorización expiró o el refresh token fue usado. Volvé a conectar Mercado Libre.', 401);
      throw fail(`Mercado Libre rechazó la autorización (HTTP ${response.status}). Revisá permisos y Redirect URI.`, 502);
    }
    return {
      accessToken: data.access_token, refreshToken: data.refresh_token,
      expiresAt: Date.now() + Math.max(0, Number(data.expires_in) || 21600) * 1000,
      userId: data.user_id ?? null, scope: safeString(data.scope, 200)
    };
  }
  async exchangeCode(code, codeVerifier) {
    if (!mlReady(this.env)) throw fail('Falta configuración de Mercado Libre o almacenamiento persistente.', 503);
    if (typeof code !== 'string' || code.length < 5 || code.length > 2048) throw fail('Código de autorización inválido.', 400);
    if (this.env.ML_PKCE_ENABLED === 'true' && !/^[a-zA-Z0-9_-]{43}$/.test(codeVerifier || ''))
      throw fail('Falta code_verifier para PKCE.', 400);
    const params = { grant_type:'authorization_code', code, redirect_uri:this.env.ML_REDIRECT_URI };
    if (this.env.ML_PKCE_ENABLED === 'true') params.code_verifier = codeVerifier;
    const tokens = await this.tokenRequest(params);
    await this.store.save(tokens); // No indicamos conexión exitosa hasta persistir ambos tokens.
    return { userId: tokens.userId };
  }
  async accessToken() {
    if (!mlReady(this.env)) throw fail('Configurá OAuth y el almacenamiento persistente antes de conectar Mercado Libre.', 503);
    const stored = await this.store.load();
    if (!stored?.refreshToken || !stored?.accessToken) throw fail('Mercado Libre aún no está conectado.', 409);
    if (stored.expiresAt > Date.now() + 30_000) return stored.accessToken;
    if (!this.refreshPromise) this.refreshPromise = (async () => {
      // Cargar de nuevo permite aprovechar un refresh reciente dentro de esta instancia.
      const latest = await this.store.load();
      if (latest?.expiresAt > Date.now() + 30_000) return latest.accessToken;
      const fresh = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: latest.refreshToken });
      await this.store.save(fresh);
      return fresh.accessToken;
    })().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }
  async apiGet(pathname, params) {
    // Evita enviar el Bearer a otro host o seguir redirecciones fuera de la API.
    if (!/^\/(users\/me|users\/\d+\/items\/search|applications\/\d+|sites\/MLA\/search|items\/bulk|items\/MLA\d+)$/.test(pathname))
      throw fail('Ruta de API no permitida.',400);
    const url = new URL(pathname, API_URL);
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
    const token = await this.accessToken();
    let response;
    try { response = await this.fetchImpl(url.href, { signal: AbortSignal.timeout(12000), redirect:'error',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); }
    catch { throw fail('No se pudo contactar a la API de Mercado Libre.'); }
    if (!response.ok) {
      // El detalle exacto identifica un permiso denegado sin exponer tokens o respuestas arbitrarias.
      let payload = null;
      try { payload = await response.json(); } catch { /* Una respuesta no JSON no impide informar HTTP. */ }
      const endpoint = pathname === '/sites/MLA/search' ? 'sites/MLA/search' :
        pathname === '/items/bulk' ? 'items/bulk' : pathname.slice(1);
      throw mlFailure(response.status, endpoint, payload);
    }
    try { return await response.json(); } catch { throw fail('La API de Mercado Libre devolvió JSON inválido.'); }
  }
  normalizeItem(item, now = new Date().toISOString()) {
    if (!item || !/^MLA\d{6,14}$/.test(String(item.id || '')) || item.currency_id !== 'ARS' ||
      !Number.isFinite(item.price) || item.price <= 0) return null;
    if (item.status && item.status !== 'active') return null;
    const permalink = typeof item.permalink === 'string' && /^https:\/\/([a-z\d-]+\.)?mercadolibre\.com\.ar\//i.test(item.permalink)
      ? item.permalink : null;
    return { id:item.id, title:safeString(item.title, 240), priceArs:item.price, currency:'ARS',
      url:permalink, sellerId:item.seller?.id ?? item.seller_id ?? null, categoryId:item.category_id || null,
      checkedAt:now, verification:'api_oficial_ml' };
  }
  // La API bulk devuelve un status_code por publicación. Nunca tratar un 404 individual
  // como "búsqueda exitosa sin resultados" sin informar qué ocurrió.
  async getItemsWithDiagnostics(ids) {
    const unique = [...new Set(ids.map(x=>String(x).trim().toUpperCase()))];
    if (!unique.length || unique.length > 20 || unique.some(x=> !/^MLA\d{6,14}$/.test(x)))
      throw fail('Ingresá entre 1 y 20 IDs MLA válidos.', 400);
    const rows = await this.apiGet('/items/bulk', { ids:unique.join(',') });
    if (!Array.isArray(rows)) throw fail('Formato inesperado de la consulta múltiple de ítems.');
    const checkedAt = new Date().toISOString();
    const items = [];
    const diagnostics = [];
    const seen = new Set();
    for (const row of rows) {
      const id = String(row?.id || row?.body?.id || '').toUpperCase();
      if (!unique.includes(id) || seen.has(id)) continue;
      seen.add(id);
      const statusCode = Number(row.status_code ?? row.code ?? 200);
      if (statusCode !== 200) {
        const reason = statusCode === 404 ? 'Mercado Libre no encontró esta publicación (404). Puede haber sido eliminada.'
          : statusCode === 403 ? 'Mercado Libre rechazó el acceso a esta publicación (403).'
          : `Mercado Libre devolvió HTTP ${Number.isInteger(statusCode) ? statusCode : 'desconocido'} para esta publicación.`;
        diagnostics.push({id, httpStatus: Number.isInteger(statusCode) ? statusCode : null, reason, ...apiErrorInfo(row)});
        continue;
      }
      const body = row.body || row;
      const item = this.normalizeItem(body, checkedAt);
      if (item) {
        items.push(item);
      } else {
        const status = safeString(body?.status, 40);
        const reason = status && status !== 'active'
          ? `La publicación está en estado ${status}; solo verificamos publicaciones activas.`
          : body?.currency_id && body.currency_id !== 'ARS'
            ? 'La publicación no tiene un precio expresado en ARS.'
            : 'Mercado Libre devolvió datos incompletos o incompatibles para verificar el precio.';
        diagnostics.push({id, httpStatus:200, reason});
      }
    }
    for (const id of unique) {
      if (!seen.has(id)) diagnostics.push({id, httpStatus:null,
        reason:'La respuesta de Mercado Libre no incluyó este ID.'});
    }
    return {items, diagnostics};
  }
  async getItems(ids) { return (await this.getItemsWithDiagnostics(ids)).items; }
  async search(term, limit = 12) {
    const query = String(term || '').trim();
    if (query.length < 2 || query.length > (query.startsWith('https://') ? 2000 : 100)) throw fail('La búsqueda debe tener de 2 a 100 caracteres o una URL de hasta 2000.', 400);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw fail('Límite de resultados inválido.', 400);
    const isUrl = /^https?:\/\//i.test(query);
    const matchedIds = isUrl ? [listingId(query)] : query.toUpperCase().match(/MLA\d{6,14}/g);
    if (isUrl || matchedIds?.length && query.toUpperCase().replace(/[\s,;]+/g,'') === matchedIds.join('')) {
      const {items, diagnostics} = await this.getItemsWithDiagnostics(matchedIds);
      return { query, total:items.length, items, diagnostics, source:'items/bulk',
        warning:'Se consultaron IDs concretos. El diagnóstico indica si alguna publicación está ausente o no tiene precio verificable.' };
    }
    const data = await this.apiGet('/sites/MLA/search', { q:query, limit });
    if (!Array.isArray(data?.results)) throw fail('Mercado Libre no devolvió publicaciones para esa consulta.');
    const candidates = data.results.map(x=>x.id).filter(x=>/^MLA\d{6,14}$/.test(x)).slice(0,20);
    // El buscador oficial también devuelve precios. Si bulk está bloqueado, no borrar
    // resultados reales de /search: identificarlos como NO confirmados por segunda lectura.
    let items=[], diagnostics=[], source='sites/MLA/search + items/bulk';
    if (candidates.length) {
      try { ({items,diagnostics} = await this.getItemsWithDiagnostics(candidates)); }
      catch (err) {
        if (err.ml?.httpStatus !== 403) throw err;
        diagnostics=[{id:'CONSULTA_BULK',httpStatus:403,
          reason:'Mercado Libre rechazó la segunda verificación de precios (403).',
          ...(err.ml?.code ? {code:err.ml.code} : {})}];
      }
      const rejected = new Set(diagnostics.filter(x=>x.httpStatus===403).map(x=>x.id));
      // Los precios de /search son un dato real de esa API, pero no una doble verificación.
      const unconfirmed = data.results.map(x=> this.normalizeItem(x)).filter(Boolean)
        .filter(x=>rejected.has(x.id) || rejected.has('CONSULTA_BULK'))
        .filter(x=>!items.some(confirmed=>confirmed.id===x.id))
        .map(x=>({...x,verification:'api_ml_busqueda_sin_bulk'}));
      if (unconfirmed.length) {
        items.push(...unconfirmed.slice(0,Math.max(0,limit-items.length)));
        source='sites/MLA/search (parte de los precios sin segunda verificación)';
      }
    }
    return { query, total:Math.max(0,Number(data.paging?.total)||items.length), items, diagnostics,
      source,
      warning:source.includes('sin segunda') ? 'Precios informados por la búsqueda oficial, SIN doble verificación. Compará variantes, packs y disponibilidad.' :
        'Precios de publicaciones activas al momento de la consulta; no son ventas ni cotizaciones de compra. Revisá packs, envío y variantes.' };
  }
}

export const mercadoLibre = new MercadoLibreService();
