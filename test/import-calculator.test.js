import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateImport} from '../src/import-calculator.js';
const example=()=>({products:[{description:'Ejemplo',unitUsd:5,quantity:10,ncm:'6307.90.90',battery:false,dutyPct:20,vatPct:21}],
  packages:[{count:1,length:60,width:40,height:20,kg:10.5}],
  rates:{source:'Tarifas ficticias de prueba',airPerKg:10,airMinimum:0,divisor:5000,seaPerM3:1000,seaMinimum:100,
    insurancePct:1,statPct:3,statCapUsd:null,otherTaxesUsd:0,destinationUsd:0,fx:1000}});
test('peso facturable, mínimos, base IVA y total incluyen mercadería una sola vez',()=>{
  const r=calculateImport(example());
  assert.equal(r.fob,50);assert.equal(r.volumeM3,0.048);assert.equal(r.volumetricKg,9.6);assert.equal(r.billableKg,10.5);
  const a=r.options[0];assert.equal(a.freight,105);assert.equal(a.insurance,0.5);
  assert.ok(Math.abs(a.products[0].vat-40.16565)<1e-8);
  assert.ok(Math.abs(a.totalUsd-231.43065)<1e-8);
  assert.equal(a.totalUsd,a.importUsd+50);
  assert.ok(Math.abs(a.products[0].landedUnitUsd-a.products[0].importUnitUsd-5)<1e-8);
  assert.equal(r.options[1].freight,100);
});
test('bultos múltiples, batería y prorrateo conservan totales',()=>{
  const x=example();x.products.push({...x.products[0],description:'Segundo',unitUsd:15,battery:true});x.packages[0].count=2;
  const r=calculateImport(x);assert.equal(r.grossKg,21);assert.equal(r.volumeM3,0.096);
  assert.ok(r.warnings.some(x=>x.includes('Baterías')));
  for(const o of r.options)assert.ok(Math.abs(o.products.reduce((s,p)=>s+p.totalUsd,0)-o.totalUsd)<1e-8);
});
test('rechaza campos ausentes, negativos, fracciones de cantidad y divisor cero',()=>{
  for(const edit of [x=>x.rates.divisor=0,x=>x.products[0].quantity=1.5,x=>x.rates.airPerKg=null,
    x=>x.packages[0].kg=-1,x=>x.products[0].battery='no',x=>x.products[0].ncm='texto',x=>x.products=[null]]){
    const x=example();edit(x);assert.throws(()=>calculateImport(x),e=>e.status===400);
  }
});
