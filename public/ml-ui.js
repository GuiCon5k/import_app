/** JavaScript del navegador: UI de Mercado Libre sin acceso a secretos ni tokens. */
const ml = id => document.getElementById(id);
const status = ml('mlStatus');
const connect = ml('mlConnect');
const results = ml('mlResults');
const searchForm = ml('mlSearchForm');
const searchButton = ml('mlSearchButton');
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
async function request(endpoint) {
  const response = await fetch(endpoint, {cache:'no-store'});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
  return data;
}
async function updateStatus() {
  status.replaceChildren(node('p','Consultando estado…'));
  searchButton.disabled = true;
  connect.hidden = true;
  try {
    const data = await request('/api/ml/status');
    const text = data.connected ? `✓ Cuenta conectada · Usuario ML: ${data.userId ?? 'sin identificar'}` :
      `⚠ ${data.message}`;
    status.replaceChildren(node('strong',text));
    if (data.connected) {
      status.append(node('p','Podés buscar productos sin gastar créditos de OpenAI.','footnote'));
      searchButton.disabled = false;
    } else if (data.configured && data.storageReady) {
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
  if (!payload.items.length) {results.append(node('p','Sin resultados confirmados para esa búsqueda.','research-caution'));return;}
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
      node('p',`API oficial · ${new Date(item.checkedAt).toLocaleString('es-AR')}`,'footnote'));
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
  } catch(error) {results.replaceChildren(node('p',`No se pudo buscar: ${error.message}`,'research-error'));}
  finally {searchButton.disabled = false;}
});
ml('mlRefresh').addEventListener('click',updateStatus);
const outcome = new URL(location.href).searchParams.get('ml');
if (outcome === 'error') results.replaceChildren(node('p','La autorización no se completó. Revisá los logs de Render (sin publicar secretos) y reintentá.','research-error'));
if (outcome === 'cancelled') results.replaceChildren(node('p','Cancelaste la autorización en Mercado Libre. Podés volver a intentarlo.','research-caution'));
if (outcome === 'connected') results.replaceChildren(node('p','Autorización registrada. Ya podés buscar publicaciones.','research-confirmed'));
if (outcome) history.replaceState(null,'',location.pathname+location.hash);
updateStatus();
