/** JavaScript (navegador): interfaz sin librerías para poder entenderla y modificarla fácilmente. */
const $ = s => document.querySelector(s);
const form = $('#offerForm');
const money = value => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(value);
const number = value => new Intl.NumberFormat('es-AR',{ maximumFractionDigits:1 }).format(value);
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const originLabel = { importacion:'China · importación', fabricante:'Argentina · fábrica', mayorista:'Argentina · mayorista' };
let offers = [];
let editingId = null;

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('Content-Type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
  return data;
}
function bodyFromForm() {
  const raw=Object.fromEntries(new FormData(form).entries());
  const textual=new Set(['productName','category','supplierName','sourceUrl','notes','currency','sourcingType','quoteStatus','quoteDate']);
  return Object.fromEntries(Object.entries(raw).map(([key,val]) => [key,textual.has(key)?val:Number(val)]));
}
function formFeedback(message,error=false) {
  $('#formFeedback').textContent = message;
  $('#formFeedback').className = error ? 'form-feedback negative' : 'form-feedback';
}
function setOriginDefaults() {
  const importation=$('#sourcingType').value==='importacion';
  const currency=$('#currency');
  currency.value=importation?'USD':'ARS';
  currencyChanged();
  if (!editingId) {
    form.elements.unitPurchase.value=importation?'5':'12000';
    form.elements.unitFreight.value=importation?'2':'0';
    form.elements.unitImportFees.value=importation?'2':'0';
    form.elements.leadDays.value=importation?'45':'10';
  }
}
function currencyChanged() {
  const usd=$('#currency').value==='USD';
  document.querySelectorAll('.unitLabel').forEach(el => el.textContent=`(${usd?'USD':'ARS'})`);
  form.elements.fxRate.disabled = !usd;
  form.elements.fxRate.title = usd?'Cotización manual que ingresás vos':'No hace falta convertir precios argentinos';
}
function renderSimulation(m) {
  $('#simulation').classList.remove('hidden');
  const boxes = [
    ['Costo puesto por unidad', money(m.landedUnitArs)],
    ['Publicidad variable / unidad', money(m.adsUnitArs)],
    ['Ganancia unitaria final', money(m.unitProfitArs)],
    ['Margen final',`${number(m.marginPct)}%`],
    ['Capital comprometido',money(m.initialOutlayArs)],
    ['Ganancia vendiendo todo',money(m.totalProfitArs)],
    ['Máximo publicidad / venta',money(m.breakEvenAdPerSaleArs)],
    ['Uso del presupuesto',`${number(m.budgetUsagePct)}%`]
  ];
  $('#simulation').innerHTML=`<h3 class="sim-title">Resultado del escenario</h3><div class="sim-grid">${boxes.map(([title,value],index)=>`<div class="sim-box"><small>${safe(title)}</small><strong class="${index===2||index===3||index===5?m.unitProfitArs<0?'negative':'positive':''}">${safe(value)}</strong></div>`).join('')}</div><p class="sim-note">${m.fitsBudget?'✓ El escenario entra dentro del capital de referencia.':'⚠ El escenario supera los $3.000.000 disponibles.'} Ganancia proyectada suponiendo venta del 100% del stock; no es una predicción de ventas. Capital inicial estimado: ${money(m.upfrontNeededArs)}. Reserva para anuncios variables: ${money(m.variableAdsReserveArs)}. ACOS estimado: ${number(m.acosPct)}%. ROAS estimado: ${m.roas===null?'No aplica':number(m.roas)+'×'}. El gasto fijo publicitario se resta una sola vez de la ganancia total.</p>`;
}
async function simulate() {
  try {
    const result=await api('/api/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyFromForm())});
    renderSimulation(result); formFeedback('Cálculo actualizado.');
  } catch(err) { formFeedback(err.message,true); }
}
function clearForm() {
  form.reset(); editingId=null; $('#saveButton').textContent='Guardar evaluación';
  $('#simulation').classList.add('hidden'); formFeedback('');
  setOriginDefaults();
}
function editOffer(id) {
  const o=offers.find(item=>item.id===id); if(!o)return;
  editingId=id;
  for(const element of form.elements) if(element.name && o[element.name] !== undefined) element.value=o[element.name];
  $('#saveButton').textContent='Guardar cambios';
  currencyChanged(); formFeedback('Editando evaluación existente.');
  location.hash='#evaluacion'; window.scrollTo({top:$('#evaluacion').getBoundingClientRect().top+window.scrollY-15,behavior:'smooth'});
}
async function save(e) {
  e.preventDefault();
  try {
    const url=editingId?`/api/offers/${editingId}`:'/api/offers';
    await api(url,{method:editingId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyFromForm())});
    formFeedback('Evaluación guardada correctamente.');
    const m=await api('/api/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyFromForm())});
    renderSimulation(m);
    editingId=null; $('#saveButton').textContent='Guardar evaluación';
    await refresh();
  } catch(err) {formFeedback(err.message,true);}
}
async function removeOffer(id) {
  if (!confirm('¿Eliminar esta evaluación de forma permanente?')) return;
  try { await api(`/api/offers/${id}`,{method:'DELETE'}); await refresh(); }
  catch(err) { alert(err.message); }
}
async function analyze(id) {
  if (!$('#aiIndicator').dataset.enabled) return alert('Para activar el análisis asistido, configurá OPENAI_API_KEY en el archivo .env. El comparador financiero funciona sin IA.');
  $('#aiDialog').showModal(); $('#aiResult').textContent='Analizando los datos guardados...';
  try {
    const result=await api('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
    $('#aiResult').textContent=result.text+`\n\nModelo: ${result.model} · Tokens de entrada: ${result.usage?.input_tokens ?? '—'} · Salida: ${result.usage?.output_tokens ?? '—'}`;
  } catch(err) {$('#aiResult').textContent=`No se pudo completar el análisis: ${err.message}`;}
}
function renderRows() {
  const q=$('#search').value.trim().toLocaleLowerCase('es');
  const type=$('#filterType').value;
  const sort=$('#sortBy').value;
  const arr=offers.filter(o=>(type==='all'||o.sourcingType===type)&&`${o.productName} ${o.supplierName}`.toLocaleLowerCase('es').includes(q));
  arr.sort((a,b)=>sort==='margin'?b.metrics.marginPct-a.metrics.marginPct:sort==='investment'?a.metrics.initialOutlayArs-b.metrics.initialOutlayArs:sort==='lead'?a.leadDays-b.leadDays:b.metrics.priorityScore-a.metrics.priorityScore);
  const tbody=$('#offerRows');tbody.replaceChildren();
  if (!arr.length) {const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=7;td.className='empty';td.textContent='No hay resultados con los filtros seleccionados.';tr.append(td);tbody.append(tr);return;}
  for (const o of arr) {
    const m=o.metrics;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><b>${safe(o.productName)}</b><small>${safe(o.supplierName)}</small></td><td><span class="pill">${safe(originLabel[o.sourcingType])}</span></td><td class="${m.marginPct>=0?'positive':'negative'}"><b>${number(m.marginPct)}%</b></td><td><b>${safe(money(m.initialOutlayArs))}</b><small>${o.quantity} unidades</small></td><td><b>${m.priorityScore}/100</b></td><td><span class="pill ${m.fitsBudget?'green':'red'}">${m.fitsBudget?'Dentro':'Excede'} presupuesto</span><small>${safe(o.quoteStatus)}${o.quoteDate?' · '+safe(o.quoteDate):''}</small></td><td class="row-buttons"></td>`;
    const buttons=tr.querySelector('.row-buttons');
    const options=[['Editar',()=>editOffer(o.id),'subtle'],['IA',()=>analyze(o.id),'outline'],['Eliminar',()=>removeOffer(o.id),'danger']];
    for(const [label,fn,kind] of options){const btn=document.createElement('button');btn.type='button';btn.className=`button small ${kind}`;btn.textContent=label;btn.addEventListener('click',fn);buttons.append(btn);}
    tbody.append(tr);
  }
}
function renderComparison() {
  const selector=$('#productSelector');
  const previous=selector?.value;
  const names=[...new Map(offers.map(o=>[o.productName.trim().toLocaleLowerCase('es'),o.productName.trim()])).values()].sort((a,b)=>a.localeCompare(b,'es'));
  if (!names.length) {$('#comparison').innerHTML='<h3>Comparación por producto</h3><p class="footnote">Agregá dos proveedores del mismo producto para compararlos aquí.</p>';return;}
  $('#comparison').innerHTML='<h3>Comparación por producto</h3><select id="productSelector" aria-label="Elegir producto a comparar"></select><div class="compare-detail" id="compareDetail"></div>';
  const select=$('#productSelector');
  for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}
  select.value=names.includes(previous)?previous:names[0];
  select.addEventListener('change',()=>renderComparisonDetail(select.value));
  renderComparisonDetail(select.value);
}
function renderComparisonDetail(name) {
  const same=offers.filter(o=>o.productName.trim().toLocaleLowerCase('es')===name.trim().toLocaleLowerCase('es'));
  same.sort((a,b)=>b.metrics.unitProfitArs-a.metrics.unitProfitArs);
  $('#compareDetail').innerHTML=same.map(o=>{
    const m=o.metrics;
    return `<article class="compare-box"><h4>${safe(o.supplierName)}</h4><small>${safe(originLabel[o.sourcingType])} · ${safe(o.quoteStatus)}</small><p><span>Costo por unidad</span><b>${safe(money(m.landedUnitArs))}</b></p><p><span>Compra inicial</span><b>${safe(money(m.initialOutlayArs))}</b></p><p><span>Margen final</span><b class="${m.marginPct<0?'negative':'positive'}">${number(m.marginPct)}%</b></p><p><span>Plazo de entrega</span><b>${o.leadDays} días</b></p><p><span>MOQ</span><b>${o.minOrder} unidades</b></p><p class="highlight"><span>Ganancia estimada/u.</span><b>${safe(money(m.unitProfitArs))}</b></p>${o.sourceUrl?`<p><a href="${safe(o.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver fuente del proveedor</a></p>`:''}</article>`;
  }).join('');
}
async function refresh() {
  try {
    offers=await api('/api/offers');
    $('#offerCount').textContent=offers.length;
    $('#productCount').textContent=new Set(offers.map(o=>o.productName.trim().toLocaleLowerCase('es'))).size;
    $('#bestMargin').textContent=offers.length?`${number(Math.max(...offers.map(o=>o.metrics.marginPct)))}%`:'—';
    renderRows(); renderComparison();
  } catch(err) { $('#offerRows').innerHTML=`<tr><td colspan="7" class="empty">${safe(err.message)}</td></tr>`; }
}
async function setup() {
  try {const status=await api('/api/status');$('#aiIndicator').textContent=!status.paidEnabled?'IA de pago bloqueada':status.aiEnabled?`IA habilitada · ${status.model}`:'IA sin configurar';if(status.paidEnabled && status.aiEnabled)$('#aiIndicator').dataset.enabled='true';}
  catch { $('#aiIndicator').textContent='Servidor desconectado'; }
  $('#sourcingType').addEventListener('change',setOriginDefaults);
  $('#currency').addEventListener('change',currencyChanged);
  $('#simulateButton').addEventListener('click',simulate);
  $('#resetForm').addEventListener('click',clearForm);
  form.addEventListener('submit',save);
  $('#search').addEventListener('input',renderRows);
  $('#filterType').addEventListener('change',renderRows);
  $('#sortBy').addEventListener('change',renderRows);
  $('#closeDialog').addEventListener('click',()=>$('#aiDialog').close());
  clearForm(); await refresh();
}
setup();
