import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOffer, calculateOffer, migrateLegacy } from '../src/finance.js';

const sample = {
  productName:'Banda fitness', category:'Fitness', supplierName:'Fábrica Nacional', sourceUrl:'',
  sourcingType:'fabricante', quoteStatus:'cotizado', currency:'ARS', quoteDate:'2026-10-28',
  quantity:100, minOrder:50, unitPurchase:10000, fxRate:1500,
  unitFreight:0, unitImportFees:0, fixedSourcingFees:10000,
  unitLocalDelivery:1000, unitPackaging:500, unitOther:0,
  salePrice:30000, marketplaceFeePct:10, adsPct:5, adsPerSale:500,
  launchAdsBudget:50000, leadDays:10, notes:'Cotizar colores'
};

test('calcula fabricación nacional, gastos publicitarios fijos y variables sin duplicar', () => {
  const m=calculateOffer(normalizeOffer(sample));
  assert.equal(m.landedUnitArs,11600); // 10000+1000+500+100 fijo repartido
  assert.equal(m.feesUnitArs,3000);
  assert.equal(m.adsUnitArs,2000); // 5% + 500 por venta
  assert.equal(m.unitContributionArs,13400);
  assert.equal(m.totalProfitArs,1290000); // 13400*100 - 50000 lanzamiento
  assert.equal(m.unitProfitArs,12900);
  assert.equal(m.upfrontNeededArs,1210000); // inventario + lanzamiento
  assert.equal(m.variableAdsReserveArs,200000);
  assert.equal(m.initialOutlayArs,1410000); // más reserva publicitaria para las 100 ventas
  assert.equal(m.marginPct,43);
  assert.equal(m.breakEvenAdPerSaleArs,14900);
});

test('compra china en USD convierte todos los componentes monetarios de abastecimiento',()=>{
  const o=normalizeOffer({...sample,sourcingType:'importacion',currency:'USD',quantity:10,minOrder:1,unitPurchase:5,unitFreight:2,unitImportFees:1,fixedSourcingFees:10,fxRate:1500});
  const m=calculateOffer(o);
  assert.equal(m.landedUnitArs, 5*1500+2*1500+1*1500 + 10*1500/10 + 1000+500);
});

test('rechaza MOQ mayor a cantidad, errores negativos e importaciones sin tipo de cambio',()=>{
  assert.throws(()=>normalizeOffer({...sample,minOrder:101}),/MOQ/);
  assert.throws(()=>normalizeOffer({...sample,adsPct:-1}),/inválido/);
  assert.throws(()=>normalizeOffer({...sample,currency:'USD',fxRate:0}),/tipo de cambio/);
});

test('migración de datos anteriores mantiene sus valores base',()=>{
  const o=migrateLegacy({name:'Straps',quantity:100,exchangeRate:1500,purchaseUsd:7,freightUsd:2,importTaxUsd:1,salePrice:20000});
  assert.equal(o.productName,'Straps'); assert.equal(o.sourcingType,'importacion');assert.equal(o.fxRate,1500);
  assert.equal(calculateOffer(o).landedUnitArs,15000);
});

test('alerta cuando supera capital y si la ganancia es negativa',()=>{
  const m=calculateOffer(normalizeOffer({...sample,unitPurchase:40000,quantity:100,salePrice:20000}));
  assert.equal(m.fitsBudget,false);
  assert.ok(m.marginPct<0);
  assert.equal(m.breakEvenUnits,null);
});
