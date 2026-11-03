/** Scenario calculator, not a customs classification or a carrier quote. All rates are user supplied. */
const bad = message => Object.assign(new Error(message), {status:400});
function number(value, label, min=0, max=1e9, integer=false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value<min || value>max || (integer && !Number.isInteger(value)))
    throw bad('Revisá '+label+'.');
  return value;
}
function text(value,label,max=240) {
  if(typeof value!=='string' || !value.trim() || value.length>max) throw bad('Completá '+label+'.');
  return value.trim();
}
export function calculateImport(input) {
  if(!input || !Array.isArray(input.products) || !input.products.length || input.products.length>30) throw bad('Ingresá entre 1 y 30 productos.');
  if(!Array.isArray(input.packages) || !input.packages.length || input.packages.length>30) throw bad('Ingresá entre 1 y 30 tipos de bulto con medidas conocidas.');
  const products=input.products.map(p=>{
    if(!p || typeof p!=='object') throw bad('Producto inválido.');
    const description=text(p.description,'descripción');
    const ncm=typeof p.ncm==='string'?p.ncm.trim():'';
    if(ncm && !/^\d{4}\.?(\d{2})\.?(\d{2})$/.test(ncm)) throw bad('El NCM sugerido debe tener 8 dígitos.');
    if(typeof p.battery!=='boolean') throw bad('Indicá si el producto tiene batería.');
    return {description,ncm,battery:p.battery,unitUsd:number(p.unitUsd,'valor unitario',0.01,1e7),
      quantity:number(p.quantity,'cantidad',1,1e6,true),dutyPct:number(p.dutyPct,'derechos %',0,100),
      vatPct:number(p.vatPct,'IVA %',0,100)};
  });
  const packages=input.packages.map(b=>{
    if(!b || typeof b!=='object') throw bad('Bulto inválido.');
    return {count:number(b.count,'cantidad de bultos',1,10000,true),
      length:number(b.length,'largo',0.01,10000),width:number(b.width,'ancho',0.01,10000),
      height:number(b.height,'alto',0.01,10000),kg:number(b.kg,'peso bruto por bulto',0.001,1e5)};
  });
  const r=input.rates || {};
  const rates={source:text(r.source,'fuente y fecha de las tarifas',500),
    airPerKg:number(r.airPerKg,'tarifa aérea USD/kg',0.01,1e6),
    airMinimum:number(r.airMinimum,'mínimo aéreo'),divisor:number(r.divisor,'divisor volumétrico',1,1e6),
    seaPerM3:number(r.seaPerM3,'tarifa marítima USD/m³',0.01,1e6),seaMinimum:number(r.seaMinimum,'mínimo marítimo'),
    insurancePct:number(r.insurancePct,'seguro % sobre FOB',0,100),
    statPct:number(r.statPct,'tasa estadística %',0,100),
    statCapUsd:r.statCapUsd===null?null:number(r.statCapUsd,'tope de tasa por producto'),
    otherTaxesUsd:number(r.otherTaxesUsd,'otros tributos y percepciones'),
    destinationUsd:number(r.destinationUsd,'gastos de destino'),fx:number(r.fx,'tipo de cambio',0.01,1e7)};
  const fob=products.reduce((s,p)=>s+p.unitUsd*p.quantity,0);
  const grossKg=packages.reduce((s,b)=>s+b.kg*b.count,0);
  const volumeM3=packages.reduce((s,b)=>s+b.length*b.width*b.height*b.count/1e6,0);
  const volumetricKg=volumeM3*1e6/rates.divisor;
  const billableKg=Math.max(grossKg,volumetricKg);
  const warnings=['Estimación con tarifas aportadas; NCM y alícuotas sin validación automática.',
    'Modelo simplificado: seguro sobre FOB; derechos y tasa sobre CIF; IVA sobre CIF + derechos + tasa. No aplica regímenes especiales, antidumping ni exenciones automáticamente.',
    'Incluí en otros tributos las percepciones y cargos aplicables. El desembolso incluye IVA sin descontar créditos fiscales.',
    'Flete, seguro, otros tributos y destino se prorratean por valor FOB, no por peso de cada producto.'];
  if(products.some(p=>p.battery)) warnings.push('Baterías: admisión, documentación y recargos pendientes de confirmación con el transportista. Los resultados no confirman que pueda embarcarse.');
  if(products.some(p=>!p.ncm)) warnings.push('Hay productos sin NCM sugerido: clasificación pendiente.');
  const options=[['Aéreo',Math.max(rates.airMinimum,billableKg*rates.airPerKg)],
    ['Marítimo',Math.max(rates.seaMinimum,volumeM3*rates.seaPerM3)]].map(([mode,freight])=>{
    const insurance=fob*rates.insurancePct/100;
    const rows=products.map(p=>{
      const value=p.unitUsd*p.quantity,share=value/fob;
      const cif=value+(freight+insurance)*share;
      const duty=cif*p.dutyPct/100;
      const statistical=Math.min(cif*rates.statPct/100,rates.statCapUsd ?? Infinity);
      const vat=(cif+duty+statistical)*p.vatPct/100;
      const otherTaxes=rates.otherTaxesUsd*share,destination=rates.destinationUsd*share;
      const landed=cif+duty+statistical+vat+otherTaxes+destination;
      return {...p,fob:value,cif,duty,statistical,vat,otherTaxes,destination,
        importUnitUsd:(landed-value)/p.quantity,landedUnitUsd:landed/p.quantity,totalUsd:landed};
    });
    const taxes=rows.reduce((s,p)=>s+p.duty+p.statistical+p.vat+p.otherTaxes,0);
    const importUsd=freight+insurance+taxes+rates.destinationUsd;
    return {mode,freight,insurance,taxes,destination:rates.destinationUsd,importUsd,
      totalUsd:fob+importUsd,totalArs:(fob+importUsd)*rates.fx,products:rows};
  });
  return {origin:'China',currency:'USD',estimated:true,fob,grossKg,volumeM3,volumetricKg,billableKg,rates,warnings,options};
}
