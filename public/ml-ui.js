/** JavaScript del navegador: UI de Mercado Libre sin acceso a secretos ni tokens. */
const ml = id => document.getElementById(id);
const status = ml('mlStatus');
const connect = ml('mlConnect');
const results = ml('mlResults');
const searchForm = ml('mlSearchForm');
const searchButton = ml('mlSearchButton');
const diagnoseButton = ml('mlDiagnose');
const diagnosis = ml('mlDiagnosis');
const copyDiagnosis = ml('mlCopyDiagnosis');
let lastDiagnosis = null;
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
async function request(endpoint) {
  const response = await fetch(endpoint, {cache:'no-store'});
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || `Error HTTP ${response.status}`);
    error.ml = data.ml;
    throw error;
  }
  return data;
}
async function updateStatus() {
  status.replaceChildren(node('p','Consultando estado…'));
  searchButton.disabled = true;
  diagnoseButton.disabled = true;
  connect.hidden = true;
  try {
    const data = await request('/api/ml/status');
    const text = data.connected ? `✓ Cuenta conectada · Usuario ML: ${data.userId ?? 'sin identificar'}` :
      `⚠ ${data.message}`;
    status.replaceChildren(node('strong',text));
    if (data.connected) {
      status.append(node('p','Podés buscar productos sin gastar créditos de OpenAI. Si cambiaste permisos en Developers, volvé a autorizar.','footnote'));
      connect.textContent = 'Volver a autorizar Mercado Libre';
      connect.hidden = false;
      searchButton.disabled = false;
      diagnoseButton.disabled = false;
    } else if (data.configured && data.storageReady) {
      connect.textContent = 'Conectar Mercado Libre';
      connect.hidden = false;
      status.append(node('p','Presioná Conectar Mercado Libre para autorizar desde el sitio oficial.','footnote'));
    } else {
      status.append(node('p','Las variables sensibles se configuran en Render → Environment. Ver docs/MERCADOLIBRE-RENDER.md.','footnote'));
    }
  } catch (error) { status.replaceChildren(node('p',`No se pudo verificar la conexión: ${error.message}`,'research-error')); }
}
function showItems(payload) {
  results.replaceChildren();
  results.append(node('p', `${payload.items.length} publicaciones verificadas · ${payload.source}. ${payload.warning}`,'footnote'));
  const diagnostics = Array.isArray(payload.diagnostics) ? payload.diagnostics : [];
  if (diagnostics.length) {
    const detail = node('div',undefined,'research-caution');
    detail.append(node('strong',`Detalle de ${diagnostics.length} publicación(es) no verificadas:`));
    const list = node('ul');
    for (const entry of diagnostics) list.append(node('li', `${entry.id} — ${entry.reason}`));
    detail.append(list);
    results.append(detail);
  }
  if (!payload.items.length) {
    results.append(node('p','No hay publicaciones con precio confirmado. Esto no equivale a que el producto no exista ni a que el mercado esté vacío.','research-caution'));
    return;
  }
  const list = node('div', undefined, 'research-grid');
  for (const item of payload.items) {
    const card = node('article', undefined, 'research-card');
    const title = node('h4');
    if (item.url) {
      const link = node('a',item.title || item.id);
      link.href = item.url; link.target='_blank';link.rel='noopener noreferrer';
      title.append(link);
    } else title.textContent = item.title || item.id;
    card.append(title,node('p',`ARS $${item.priceArs.toLocaleString('es-AR')} · ${item.id}`,'research-confirmed'),
      node('p',`${item.verification === 'api_ml_busqueda_sin_bulk' ? 'Búsqueda oficial (sin doble verificación)' : 'API oficial, precio verificado'} · ${new Date(item.checkedAt).toLocaleString('es-AR')}`,'footnote'));
    list.append(card);
  }
  results.append(list);
}
searchForm.addEventListener('submit',async event => {
  event.preventDefault();
  searchButton.disabled = true;
  results.replaceChildren(node('p','Consultando Mercado Libre… (sin costo de OpenAI)'));
  try {
    const query = ml('mlQuery').value.trim();
    showItems(await request('/api/ml/search?q='+encodeURIComponent(query)));
  } catch(error) {
    results.replaceChildren(node('p',`No se pudo buscar: ${error.message}`,'research-error'));
    if (error.ml) {
      const info = `${error.ml.endpoint} · HTTP ${error.ml.httpStatus}` +
        (error.ml.code ? ` · Código de ML: ${error.ml.code}` : '') +
        (error.ml.blockedBy ? ` · Bloqueado por: ${error.ml.blockedBy}` : '');
      results.append(node('p',info,'footnote'));
    }
    if (error.ml?.endpoint === 'sites/MLA/search' && error.ml.httpStatus === 403) {
      results.append(node('p','Prueba independiente: pegá en el buscador el ID MLA de una publicación real, por ejemplo MLA1418175105, para probar /items/bulk. Si funciona por ID, el bloqueo afecta a la búsqueda por palabras.','research-caution'));
      const link = node('a','Abrir resultados en Mercado Libre (consulta manual, no verificada por API)');
      link.href = 'https://listado.mercadolibre.com.ar/' + encodeURIComponent(ml('mlQuery').value.trim());
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      results.append(link);
    }
  }
  finally {searchButton.disabled = false;}
});
// Cada pulsación consulta el backend protegido; no llegan tokens al navegador.
diagnoseButton.addEventListener('click', async () => {
  diagnoseButton.disabled = true;
  diagnosis.replaceChildren(node('p','Comprobando permisos reales de Mercado Libre…'));
  copyDiagnosis.hidden = true;
  lastDiagnosis = null;
  try {
    const query = ml('mlQuery').value.trim().toUpperCase();
    const id = query.match(/^MLA\d{6,14}$/) ? query : 'MLA1407266827';
    const data = await request('/api/ml/diagnostics?id='+encodeURIComponent(id));
    lastDiagnosis = data;
    copyDiagnosis.hidden = false;
    const panel = node('div', undefined, 'research-caution');
    panel.append(node('strong','Diagnóstico API · '+new Date(data.testedAt).toLocaleString('es-AR')));
    const list = node('ul');
    for (const check of data.checks) {
      const suffix = (check.code ? ' · código: '+check.code : '') +
        (check.blockedBy ? ' · bloqueado por: '+check.blockedBy : '') +
        (typeof check.active === 'boolean' ? ' · app activa: '+(check.active ? 'sí':'no') : '');
      list.append(node('li',`${check.name}: HTTP ${check.httpStatus} (${check.state})${suffix}`));
    }
    panel.append(list,node('p',data.interpretation));
    diagnosis.replaceChildren(panel);
  } catch (error) {
    diagnosis.replaceChildren(node('p','No se pudo completar el diagnóstico: '+error.message,'research-error'));
  } finally {diagnoseButton.disabled = false;}
});
copyDiagnosis.addEventListener('click', async () => {
  if (!lastDiagnosis) return;
  const lines = [`Import_app — diagnóstico ML ${lastDiagnosis.testedAt}`,`ID: ${lastDiagnosis.itemId}`,
    ...lastDiagnosis.checks.map(x=>`${x.endpoint}: HTTP ${x.httpStatus}${x.code ? ' · '+x.code : ''}${x.blockedBy ? ' · '+x.blockedBy : ''}`),
    lastDiagnosis.interpretation];
  try { await navigator.clipboard.writeText(lines.join('\n')); copyDiagnosis.textContent='Copiado'; }
  catch { copyDiagnosis.textContent='Seleccioná el diagnóstico y copialo manualmente'; }
});
ml('mlRefresh').addEventListener('click',updateStatus);
const outcome = new URL(location.href).searchParams.get('ml');
if (outcome === 'error') results.replaceChildren(node('p','La autorización no se completó. Revisá los logs de Render (sin publicar secretos) y reintentá.','research-error'));
if (outcome === 'cancelled') results.replaceChildren(node('p','Cancelaste la autorización en Mercado Libre. Podés volver a intentarlo.','research-caution'));
if (outcome === 'connected') results.replaceChildren(node('p','Autorización registrada. Ya podés buscar publicaciones.','research-confirmed'));
if (outcome) history.replaceState(null,'',location.pathname+location.hash);
updateStatus();
