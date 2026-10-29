/**
 * JavaScript (Node.js): motor financiero independiente de la interfaz.
 * Todos los importes se convierten a ARS antes de calcular márgenes.
 * NO calcula impuestos automáticamente: se cargan como estimaciones/cotizaciones.
 */
export const CAPITAL_ARS = 3_000_000;

export const num = value => {
  if (value === '' || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

const requiredNonNegative = (object, keys) => {
  for (const key of keys) {
    if (!Number.isFinite(num(object[key]))) throw new Error(`Valor inválido: ${key}`);
  }
};

export const TYPES = ['importacion', 'fabricante', 'mayorista'];
export const STATUSES = ['estimado', 'cotizado', 'verificado'];

export function normalizeOffer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('La evaluación no es válida');
  const o = { ...raw };
  for (const key of ['productName', 'category', 'supplierName', 'sourceUrl', 'notes', 'currency', 'sourcingType', 'quoteStatus']) {
    o[key] = String(o[key] ?? '').trim().slice(0, key === 'notes' ? 1000 : 250);
  }
  if (!o.productName) throw new Error('El producto necesita un nombre');
  if (!o.supplierName) throw new Error('Indicá el proveedor o escribí "Por investigar"');
  if (!TYPES.includes(o.sourcingType)) throw new Error('Tipo de proveedor inválido');
  if (!STATUSES.includes(o.quoteStatus)) throw new Error('Estado de cotización inválido');
  if (!['ARS', 'USD'].includes(o.currency)) throw new Error('Moneda inválida');
  if (o.sourceUrl && !/^https?:\/\//i.test(o.sourceUrl)) throw new Error('El enlace debe comenzar con https:// o http://');
  const fields = ['quantity','minOrder','unitPurchase','fxRate','unitFreight','unitImportFees','fixedSourcingFees',
    'unitLocalDelivery','unitPackaging','unitOther','salePrice','marketplaceFeePct','adsPct','adsPerSale','launchAdsBudget','leadDays'];
  requiredNonNegative(o, fields);
  for (const field of fields) o[field] = num(o[field]);
  if (!Number.isInteger(o.quantity) || o.quantity < 1 || o.quantity > 1000000) throw new Error('Cantidad inválida');
  if (!Number.isInteger(o.minOrder) || !Number.isInteger(o.leadDays)) throw new Error('MOQ y plazo deben ser números enteros');
  if (o.minOrder > o.quantity) throw new Error('La cantidad es menor al mínimo del proveedor (MOQ)');
  if (o.currency === 'USD' && o.fxRate <= 0) throw new Error('Cargá un tipo de cambio mayor a cero');
  if (o.marketplaceFeePct > 100 || o.adsPct > 100) throw new Error('El porcentaje no puede superar 100');
  if (o.salePrice <= 0) throw new Error('El precio de venta debe ser mayor a cero');
  o.quoteDate = /^\d{4}-\d{2}-\d{2}$/.test(String(o.quoteDate ?? '')) ? o.quoteDate : '';
  return o;
}

export function calculateOffer(o, capitalArs = CAPITAL_ARS) {
  // Convertimos compra/flete/tributos por unidad a pesos; el IVA recuperable debe excluirse del costo económico.
  const fx = o.currency === 'USD' ? o.fxRate : 1;
  const purchaseUnit = o.unitPurchase * fx;
  const landedUnit = (o.unitPurchase + o.unitFreight + o.unitImportFees) * fx
    + o.unitLocalDelivery + o.unitPackaging + o.unitOther + o.fixedSourcingFees * fx / o.quantity;
  const unitFee = o.salePrice * o.marketplaceFeePct / 100;
  // La publicidad por venta y el presupuesto de lanzamiento son gastos DISTINTOS.
  const adsPerUnit = o.salePrice * o.adsPct / 100 + o.adsPerSale;
  const unitContribution = o.salePrice - landedUnit - unitFee - adsPerUnit;
  const profitAtSellout = unitContribution * o.quantity - o.launchAdsBudget;
  const unitProfitFullyAllocated = profitAtSellout / o.quantity;
  // Reservamos publicidad variable para todas las unidades: criterio conservador de capital.
  const upfrontNeeded = landedUnit * o.quantity + o.launchAdsBudget;
  const variableAdsReserve = adsPerUnit * o.quantity;
  const initialOutlay = upfrontNeeded + variableAdsReserve;
  const breakEvenAdPerSale = Math.max(0, o.salePrice - landedUnit - unitFee - o.launchAdsBudget / o.quantity);
  const breakEvenUnits = unitContribution > 0 ? Math.ceil(o.launchAdsBudget / unitContribution) : null;
  const budgetUsagePct = capitalArs > 0 ? initialOutlay / capitalArs * 100 : null;
  return {
    purchaseUnitArs: purchaseUnit, landedUnitArs: landedUnit, feesUnitArs: unitFee,
    adsUnitArs: adsPerUnit, unitContributionArs: unitContribution,
    unitProfitArs: unitProfitFullyAllocated, totalProfitArs: profitAtSellout,
    marginPct: unitProfitFullyAllocated / o.salePrice * 100,
    initialOutlayArs: initialOutlay, upfrontNeededArs: upfrontNeeded, variableAdsReserveArs: variableAdsReserve, budgetUsagePct, fitsBudget: initialOutlay <= capitalArs,
    breakEvenAdPerSaleArs: breakEvenAdPerSale, breakEvenUnits,
    acosPct: o.salePrice ? (adsPerUnit + o.launchAdsBudget / o.quantity) / o.salePrice * 100 : null,
    roas: adsPerUnit + o.launchAdsBudget / o.quantity > 0 ? o.salePrice / (adsPerUnit + o.launchAdsBudget / o.quantity) : null,
    revenueArs: o.salePrice * o.quantity,
    // Esta clasificación NO simula demanda real; solo valora economía y calidad de datos.
    priorityScore: Math.max(0, Math.min(100, Math.round(
      Math.max(0, Math.min(45, (unitProfitFullyAllocated / o.salePrice * 100) * 1.25)) +
      (initialOutlay <= capitalArs ? 20 : 0) +
      (o.quoteStatus === 'verificado' ? 20 : o.quoteStatus === 'cotizado' ? 12 : 3) +
      (o.leadDays <= 20 ? 10 : o.leadDays <= 45 ? 5 : 0) +
      (o.sourceUrl ? 5 : 0)
    )))
  };
}

// Compatibilidad: transforma evaluaciones de la versión 0.1 sin modificar sus archivos.
export function migrateLegacy(old) {
  if (!old || old.productName) return old;
  if (!old.name) return null;
  const fx = Number(old.exchangeRate) || 1;
  return {
    id: old.id, createdAt: old.createdAt, productName: old.name, category: old.category ?? '',
    supplierName: 'Proveedor anterior (sin identificar)', sourcingType: 'importacion', quoteStatus: 'estimado',
    currency: 'USD', quoteDate: '', sourceUrl: old.sourceUrl ?? '', quantity: Math.max(1, Number(old.quantity) || 1),
    minOrder: 1, unitPurchase: Number(old.purchaseUsd) || 0, fxRate: fx,
    unitFreight: Number(old.freightUsd) || 0, unitImportFees: Number(old.importTaxUsd) || 0,
    fixedSourcingFees: 0, unitLocalDelivery: Number(old.localShippingArs) || 0,
    unitPackaging: Number(old.packagingArs) || 0, unitOther: Number(old.otherCostArs) || 0,
    salePrice: Number(old.salePrice) || 1, marketplaceFeePct: Number(old.marketplaceFeePct) || 0,
    adsPct: Number(old.advertisingPct) || 0, adsPerSale: Number(old.advertisingFixedArs) || 0,
    launchAdsBudget: Number(old.fixedLaunchBudgetArs) || 0, leadDays: 0,
    notes: 'Migrado de Guicon AI 0.1. Revisar todos los costos antes de decidir.'
  };
}
