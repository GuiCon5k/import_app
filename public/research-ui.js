/** JavaScript para el navegador: muestra las investigaciones automáticas.
 * Usa textContent y elementos DOM para no ejecutar HTML de páginas externas. */
const byId = id => document.getElementById(id);
const start = byId('researchStart');
const help = byId('researchHelp');
const doctorButton = byId('researchDoctorButton');
const demoButton = byId('researchDemoButton');
const demoResults = byId('researchDemoResults');
let verifyCount = 0;
const doctor = byId('researchDiagnostics');
const results = byId('researchResults');
const summary = byId('researchSummary');
let timer = null;

async function request(url, options) {
  const response = await fetch(url, options);
  let value;
  try { value = await response.json(); }
  catch { throw new Error('El servidor no respondió JSON. Comprobá que abriste la versión 0.5.4 en la dirección de tu servidor y reiniciá Node.js.'); }
  if (!response.ok) throw new Error(value.error || 'Error de conexión');
  return value;
}
function el(tag, text, className) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function displayDate(value) {
  try { return new Date(value).toLocaleString('es-AR'); } catch { return value; }
}
function renderSource(source) {
  const p=el('p',null,'research-source');
  const a=el('a',source.title || new URL(source.url).hostname);
  a.href=source.url; a.target='_blank'; a.rel='noopener noreferrer';
  p.append(a,el('span',` · ${source.type}${source.cited?' · cita web':''}`));
  if (source.note) p.append(el('small',source.note));
  return p;
}
function link(text,url) {
  const a=el('a',text); a.href=url; a.target='_blank';a.rel='noopener noreferrer'; return a;
}
function renderListings(items) {
  const box=el('section',null,'research-evidence');
  box.append(el('h5','🛒 Publicaciones individuales de Mercado Libre'));
  if (!items?.length) {box.append(el('p','No se encontraron publicaciones individuales verificables en esta búsqueda.','footnote'));return box;}
  for(const l of items) {
    const row=el('div',null,'research-evidence-item');
    row.append(link(l.title || l.id || 'Abrir publicación',l.url));
    const confirmed=l.verification==='api_oficial_ml' && Number.isFinite(l.priceArs);
    row.append(el('p',confirmed ? `Precio API oficial: $${l.priceArs.toLocaleString('es-AR')} ARS · ${new Date(l.checkedAt).toLocaleString('es-AR')}`:
      'Referencia web — precio NO verificado por API',confirmed?'research-confirmed':'research-caution'));
    if(l.seller) row.append(el('small',`Vendedor mencionado: ${l.seller} (por comprobar)`));
    box.append(row);
  }
  return box;
}
function renderSuppliers(items) {
  const box=el('section',null,'research-evidence');
  box.append(el('h5','🏭 Fabricantes, mayoristas y proveedores'));
  if (!items?.length) {box.append(el('p','No se encontró un proveedor individual identificado.','footnote'));return box;}
  const names={argentina_fabricante:'🇦🇷 Fabricante',argentina_mayorista:'🇦🇷 Mayorista',china_1688:'🇨🇳 1688',china_made_in_china:'🇨🇳 Made-in-China'};
  for (const s of items) {
    const row=el('div',null,'research-evidence-item');
    row.append(el('strong',`${names[s.origin]||'Proveedor'} · ${s.name}`));
    if(s.city)row.append(el('p',`Ubicación informada: ${s.city}`,'footnote'));
    if(s.moq)row.append(el('p',`Mínimo publicado (sin cotizar): ${s.moq}`,'footnote'));
    if(s.unitPriceNote)row.append(el('p',`Precio orientativo (sin validar): ${s.unitPriceNote}`,'footnote'));
    const contacts=el('p',null,'research-contacts');
    contacts.append(link('Ver ficha / contactar',s.contactUrl || s.sourceUrl));
    if(s.email) contacts.append(el('span',` · Correo informado: ${s.email}`));
    if(s.phone) contacts.append(el('span',` · Teléfono informado: ${s.phone}`));
    row.append(contacts);
    row.append(el('p',s.cited ? 'Fuente citada por la búsqueda; comprobar identidad y datos comerciales.' : 'Enlace no corroborado por citas de búsqueda: verificar antes de contactar.','footnote'));
    box.append(row);
  }
  return box;
}
function renderJob(job) {
  const wrap=el('article',null,'research-job');
  wrap.append(el('h3',`Investigación · ${displayDate(job.startedAt)}`));
  wrap.append(el('p', job.simulated ? 'SIMULACIÓN LOCAL — no consultó Internet ni consumió créditos' : `Estado: ${job.status === 'running' ? 'investigando en Internet…' : job.status === 'completed' ? 'completada' : job.status === 'failed' ? 'falló' : 'interrumpida'}${job.automated?' · programada':' · manual'}`,'footnote'));
  if (job.error) wrap.append(el('p',`Motivo del error: ${job.error}`,'research-error'));
  if (!job.results) return wrap;
  const r=job.results;
  if (r.summary) wrap.append(el('p',r.summary,'research-overview'));
  if (r.marketVerification) wrap.append(el('p',r.marketVerification,'research-caution'));
  if (r.evidenceWarning) wrap.append(el('p',r.evidenceWarning,'footnote'));
  wrap.append(el('p',`${r.products.length} ${job.simulated?'ejemplos ficticios':'productos detectados'} · ${r.webSearchCalls || 0} búsquedas web · modelo ${r.model || '—'} · entrada ${r.usage?.input_tokens ?? '—'} tokens / salida ${r.usage?.output_tokens ?? '—'} tokens`,'footnote'));
  const grid=el('div',null,'research-grid');
  for (const product of r.products || []) {
    const card=el('article',null,'research-card');
    card.append(el('h4',product.name));
    card.append(el('span',product.category || 'Categoría por confirmar','pill'));
    if(product.rationale) card.append(el('p',product.rationale));
    if(product.argentina) card.append(el('p',`🇦🇷 Argentina: ${product.argentina}`));
    if(product.china) card.append(el('p',`🇨🇳 China: ${product.china}`));
    if(product.advertising) card.append(el('p',`📣 Publicidad: ${product.advertising}`));
    if(product.risks) card.append(el('p',`⚠ Riesgos: ${product.risks}`));
    card.append(el('p','Pendiente de cotización — sin margen calculado','research-caution'));
    if(product.marketListings?.length || !job.simulated) card.append(renderListings(product.marketListings));
    if(product.marketStats) {
      const m=product.marketStats;
      card.append(el('p',`Comparación de ${m.count} publicaciones verificadas: mínimo $${m.minimumArs.toLocaleString('es-AR')} · mediana $${m.medianArs.toLocaleString('es-AR')} · máximo $${m.maximumArs.toLocaleString('es-AR')} ARS`,'research-confirmed'));
      card.append(el('p',m.warning,'footnote'));
    }
    if(product.suppliers?.length || !job.simulated) card.append(renderSuppliers(product.suppliers));
    const sources=el('div',null,'research-sources');
    sources.append(el('strong',job.simulated?'Sin fuentes: datos ficticios de prueba':'Fuentes para contrastar'));
    for(const source of product.sources || []) sources.append(renderSource(source));
    card.append(sources); grid.append(card);
  }
  wrap.append(grid); return wrap;
}

/** Diagnóstico exclusivamente LOCAL. Siempre muestra un cambio visible y NO llama a OpenAI. */
async function showDiagnostics() {
  const checkNumber = ++verifyCount;
  doctorButton.disabled = true;
  doctor.replaceChildren(el('p', `Comprobación ${checkNumber} en curso… (sin usar API de OpenAI)`));
  try {
    const d = await request(`/api/research/diagnostics?t=${Date.now()}`, { cache: 'no-store' });
    doctor.replaceChildren();
    doctor.append(el('strong', d.configured ? '✓ Configuración local de clave detectada' : '⚠ Falta configurar la clave API'));
    doctor.append(el('p', `Comprobación gratuita N.º ${checkNumber} · ${new Date().toLocaleTimeString('es-AR')} · Servidor ${d.version || 'desconocido'}`));
    doctor.append(el('p', `Archivo .env: ${d.envFile ? 'encontrado' : 'no encontrado'} · API: ${d.apiKeyPresent ? 'clave detectada (no validada online)' : 'sin clave'} · Modelo: ${d.researchModel}`));
    const mlMode = d.mlOAuthConfigured && d.mlStorageConfigured ? 'OAuth y almacenamiento configurados (conexión y accesos no comprobados aquí)' :
      d.mlTokenPresent ? 'token manual presente (no validado online)' : 'sin configuración completa; referencias aportadas disponibles';
    doctor.append(el('p', `Mercado Libre: ${mlMode} · China/Argentina: descubrimiento web con IA, sujeto a evidencia.`));
    doctor.append(el('p', d.paidEnabled ? '⚠ PAGOS HABILITADOS: una investigación real podría consumir créditos.' : '✓ MODO SEGURO: API de pago BLOQUEADA. Esta app no enviará investigaciones pagas.'));
    for (const issue of d.warnings || []) doctor.append(el('p', issue, 'research-error'));
    doctor.append(el('p', d.nextStep || 'Comprobación local finalizada.', 'footnote'));
    if (d.version !== '0.5.4') doctor.append(el('p','⚠ El servidor está ejecutando una versión distinta de la interfaz esperada. Actualizá el navegador.','research-error'));
    if (!d.envFile) doctor.append(el('p','Si querés configurar la IA, copiá .env.example como .env dentro de guicon-ai. Podés seguir probando sin hacerlo.','footnote'));
  } catch (err) {
    doctor.replaceChildren(el('p', `Comprobación N.º ${checkNumber} falló: ${err.message}. Asegurate de entrar por http://localhost:3000, NO desde index.html.`, 'research-error'));
  } finally {
    doctorButton.disabled = false;
  }
}

doctorButton.addEventListener('click', showDiagnostics);

/** Demo aislada: consulta ÚNICAMENTE el servidor local, sin OpenAI ni datos persistidos. */
demoButton.addEventListener('click', async () => {
  demoButton.disabled = true;
  demoResults.replaceChildren(el('p','Generando simulación local… No se utilizarán créditos.'));
  try {
    const job = await request('/api/research/demo', { cache: 'no-store' });
    if (!job.simulated) throw new Error('La respuesta no está marcada como simulación.');
    demoResults.replaceChildren(renderJob(job));
  } catch (err) {
    demoResults.replaceChildren(el('p',`Error de demostración: ${err.message}`,'research-error'));
  } finally {
    demoButton.disabled = false;
  }
});

async function refreshResearch() {
  try {
    const data = await request('/api/research');
    const enabled = data.aiEnabled;
    start.disabled = data.running || !enabled || !data.paidEnabled;
    help.textContent = !data.paidEnabled ? 'Modo seguro: investigaciones PAGAS bloqueadas. Podés verificar y probar la demo sin gastar créditos. Para activar investigaciones reales, cambiá PAID_API_ENABLED=true conscientemente.' : !enabled ? 'No se puede investigar todavía: falta OPENAI_API_KEY. Tocá «Verificar configuración» para ver los pasos.' :
      data.running ? 'Investigación en marcha. El agente puede tardar unos minutos. Mantené Node.js encendido.' :
      `Listo para investigar. Programación semanal ${data.scheduled ? `activada (cada ${data.intervalDays} días)` : 'desactivada'}. La investigación automática requiere que el servidor esté encendido.`;
    results.replaceChildren();
    if(!data.jobs.length) results.append(el('p','Aún no hay investigaciones. Pulsá «Investigar automáticamente».','footnote'));
    else for(const job of data.jobs.slice(0,8)) results.append(renderJob(job));
    summary.textContent = `${data.jobs.filter(j=>j.status==='completed').length} investigaciones completadas · ${data.jobs.filter(j=>j.status==='running').length} en curso`;
    if (data.running) {
      if(!timer) timer=setTimeout(()=>{timer=null;refreshResearch();}, 5000);
    } else if(timer) {clearTimeout(timer);timer=null;}
  } catch (error) { help.textContent = `No se pudo consultar el agente: ${error.message}`; }
}
start.addEventListener('click', async ()=>{
  if (!window.confirm('Esta investigación usa OpenAI y puede consumir créditos de API. ¿Querés ejecutarla ahora?')) return;
  start.disabled=true;
  help.textContent='Iniciando investigación real con posible consumo de API...';
  try {
    await request('/api/research/start',{method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({focus:byId('researchFocus').value.trim()})});
    await refreshResearch();
  } catch(err) { help.textContent=`No se pudo comenzar: ${err.message}`;start.disabled=false; }
});
if (location.protocol === 'file:') {
  doctor.replaceChildren(el('p','Abriste el archivo directamente. Iniciá el servidor con npm.cmd run dev y entrá en http://localhost:3000/#investigador.','research-error'));
}
refreshResearch();
