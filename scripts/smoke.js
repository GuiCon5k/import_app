/** GET-only production checks. Credentials from environment, never printed. */
const base=new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000');
if(base.protocol!=='https:' && !['127.0.0.1','localhost'].includes(base.hostname)) throw new Error('Usá HTTPS fuera de localhost');
const headers=process.env.APP_USERNAME && process.env.APP_PASSWORD
  ? {Authorization:'Basic '+Buffer.from(process.env.APP_USERNAME+':'+process.env.APP_PASSWORD).toString('base64')} : {};
const response=await fetch(new URL('/api/status',base),{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error('Estado HTTP '+response.status);
const status=await response.json();
if(status.version!=='0.5.5')throw new Error('Versión inesperada');
if(process.env.EXPECTED_COMMIT && status.commit!==process.env.EXPECTED_COMMIT)throw new Error('Commit inesperado');
if(status.paidEnabled)throw new Error('API de pago habilitada: revisar configuración');
for(const endpoint of ['/','/api/research/demo','/api/prices']) {
  const result=await fetch(new URL(endpoint,base),{headers,redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!result.ok)throw new Error(endpoint+': HTTP '+result.status);
}
console.log('Versión, commit solicitado, pagos bloqueados, interfaz, demo y referencias: OK. No se consultó ML.');
