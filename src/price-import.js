/** Importación declarativa: nunca visita la URL ni confunde datos aportados con API. */
const invalid = message => Object.assign(new Error(message), {status:400});
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value))
    throw invalid('Revisá los textos de la referencia.');
  return value.trim();
}
export function sourceUrl(value) {
  let url;
  try { url = new URL(text(value, 2000)); } catch { throw invalid('Ingresá una URL HTTPS pública sin credenciales.'); }
  // Se rechazan parámetros y fragmentos: pueden contener tokens o enlaces firmados.
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port ||
      !url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname) ||
      /\.(local|internal|test|localhost)$/.test(url.hostname))
    throw invalid('Usá una URL HTTPS pública sin credenciales, parámetros ni fragmentos.');
  return url.href;
}
export function listingId(value) {
  if (/^MLA\d{6,14}$/i.test(value)) return value.toUpperCase();
  const url = new URL(sourceUrl(value));
  if (!(url.hostname === 'mercadolibre.com.ar' || url.hostname.endsWith('.mercadolibre.com.ar')))
    throw invalid('La URL debe pertenecer a Mercado Libre Argentina.');
  // /p/MLA... identifica catálogo, no una publicación concreta de vendedor.
  if (/\/p\//i.test(url.pathname)) throw invalid('Pegá la URL de una publicación, no la ficha de catálogo.');
  const match = url.pathname.match(/(?:^|\/)MLA-?(\d{6,14})(?=[-_/]|$)/i);
  if (!match) throw invalid('La URL no contiene un ID MLA de publicación.');
  return `MLA${match[1]}`;
}
export function importPrices(payload, now = new Date()) {
  if (!Array.isArray(payload?.records) || !payload.records.length || payload.records.length > 100)
    throw invalid('Importá entre 1 y 100 referencias.');
  const records = payload.records.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('Referencia inválida.');
    const url = sourceUrl(raw.url);
    const observedAt = text(raw.observedAt, 30);
    const observed = new Date(observedAt);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(observedAt) ||
        !Number.isFinite(observed.getTime()) || observed > now || observed.toISOString().slice(0,19) !== observedAt.slice(0,19))
      throw invalid('La fecha de observación debe ser UTC válida y no futura.');
    if (typeof raw.priceArs !== 'number' || !Number.isFinite(raw.priceArs) || raw.priceArs <= 0 || raw.priceArs > 1e12)
      throw invalid('El precio ARS debe ser un número positivo.');
    // Lista explícita: ignora verification/checkedAt o cualquier estado inyectado por el archivo.
    return {title:text(raw.title,240), url, sourceName:text(raw.sourceName,120),
      evidence:text(raw.evidence,500), priceArs:raw.priceArs, currency:'ARS',
      observedAt:observed.toISOString(), importedAt:now.toISOString(),
      verification:'aportado_sin_verificacion_api', checkedAt:null};
  });
  return {schemaVersion:1, records, warning:'Datos aportados por el usuario; fuente enlazada, contenido y precio sin verificar por API. No se consultó Internet. Guardá el archivo exportado.'};
}
