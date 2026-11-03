const el=id=>document.getElementById(id);
const form=el('importCalculator');
const result=el('importCalculation');
let lastCalculation=null;
let revision=0;
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function field(parent,key,label,type='number',value='') {
  const l=node('label',label),i=document.createElement('input');i.name=key;i.type=type;
  i.required=true;i.value=value;
  if(type==='number'){i.min='0';i.step='any';}
  if(type==='text')i.maxLength=240;
  l.append(i);parent.append(l);return i;
}
function addRow(kind) {
  const target=el(kind==='product'?'importProducts':'importPackages');
  if(target.children.length>=30)return;
  const row=node('fieldset');row.className='form-grid import-row';
  row.append(node('legend',kind==='product'?'Producto':'Bulto · medidas y peso por bulto'));
  if(kind==='product') {
    field(row,'description','Descripción','text');
    field(row,'unitUsd','Valor FOB unitario (USD)');
    field(row,'quantity','Cantidad','number','1');
    field(row,'ncm','NCM sugerido (opcional)','text').required=false;
    const l=node('label','¿Tiene batería?'),s=document.createElement('select');s.name='battery';
    for(const [v,t] of [['false','No'],['true','Sí']]){const o=node('option',t);o.value=v;s.append(o);}l.append(s);row.append(l);
    field(row,'dutyPct','Derechos (%) · según NCM');field(row,'vatPct','IVA (%)');
  } else {
    field(row,'count','Cantidad de bultos iguales','number','1');
    for(const [k,l] of [['length','Largo (cm)'],['width','Ancho (cm)'],['height','Alto (cm)'],['kg','Peso bruto por bulto (kg)']])field(row,k,l);
  }
  const remove=node('button','Quitar');remove.type='button';remove.className='button subtle';
  remove.addEventListener('click',()=>{if(target.children.length>1){row.remove();invalidate();}});row.append(remove);target.append(row);
  invalidate();
}
function invalidate(){revision++;lastCalculation=null;el('importExport').hidden=true;result.replaceChildren(node('p','Completá los datos y calculá el escenario.'));}
const rows=id=>[...el(id).children].map(row=>Object.fromEntries([...row.querySelectorAll('input,select')].map(i=>[i.name,i.name==='battery'?i.value==='true':i.type==='number'?(i.value===''?null:Number(i.value)):i.value])));
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(n);
el('addImportProduct').addEventListener('click',()=>addRow('product'));
el('addImportPackage').addEventListener('click',()=>addRow('package'));
form.addEventListener('input',invalidate);
form.addEventListener('change',invalidate);
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=el('importCalculate');button.disabled=true;
  const submittedRevision=revision;
  try {
    const rates=Object.fromEntries([...el('importRates').querySelectorAll('input')].map(i=>[i.name,i.type==='number'?(i.value===''?null:Number(i.value)):i.value]));
    const input={products:rows('importProducts'),packages:rows('importPackages'),rates};
    const response=await fetch('/api/import/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    const data=await response.json();if(!response.ok)throw Error(data.error);
    if(submittedRevision!==revision)return;
    lastCalculation={input,result:data};result.replaceChildren();
    result.append(node('p',`FOB ${money(data.fob)} · Peso bruto ${data.grossKg.toFixed(2)} kg · Volumétrico ${data.volumetricKg.toFixed(2)} kg · Facturable aéreo ${data.billableKg.toFixed(2)} kg · Volumen ${data.volumeM3.toFixed(3)} m³`));
    const notes=node('details');notes.append(node('summary','Supuestos y límites del cálculo'));
    for(const warning of data.warnings){const n=node('p',warning);n.className='footnote';notes.append(n);}
    result.append(notes);
    for(const option of data.options){
      const card=node('article');card.className='research-card';card.append(node('h3',option.mode+' · estimación'));
      card.append(node('p',`Flete ${money(option.freight)} + seguro ${money(option.insurance)} + tributos ${money(option.taxes)} + destino ${money(option.destination)}`));
      card.append(node('p',`Importación (sin mercadería): ${money(option.importUsd)}`));
      card.append(node('h4',`Total con mercadería: ${money(option.totalUsd)} · ARS ${option.totalArs.toLocaleString('es-AR',{maximumFractionDigits:2})}`));
      const table=node('table'),head=node('tr');for(const label of ['Producto','Cantidad','FOB/u','Importación/u','Puesto en Argentina/u','Total'])head.append(node('th',label));
      const thead=node('thead');thead.append(head);table.append(thead);const body=node('tbody');
      for(const p of option.products){const tr=node('tr');for(const v of [p.description,p.quantity,money(p.unitUsd),money(p.importUnitUsd),money(p.landedUnitUsd),money(p.totalUsd)])tr.append(node('td',String(v)));body.append(tr);}
      table.append(body);const wrap=node('div');wrap.className='table-wrap';wrap.append(table);card.append(wrap);result.append(card);
    }
    el('importExport').hidden=false;
  }catch(error){result.replaceChildren(node('p',error.message));}finally{button.disabled=false;}
});
el('importExport').addEventListener('click',()=>{
  if(!lastCalculation)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(lastCalculation,null,2)],{type:'application/json'}));
  const a=node('a');a.href=url;a.download='estimacion-importacion-china.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
addRow('product');addRow('package');
