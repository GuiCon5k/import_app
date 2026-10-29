/** JavaScript + Node.js: comprobación sin costo de la configuración local. */
import { loadLocalEnv, getDiagnostics } from './diagnostics.js';
loadLocalEnv();
const d = getDiagnostics();
console.log('\nGUICON AI — DIAGNÓSTICO LOCAL (sin gastos de API)');
console.log(`Node.js: ${process.version}`);
console.log(`Archivo .env: ${d.envFile ? 'encontrado' : 'no encontrado'}`);
console.log(`Clave API: ${d.apiKeyPresent ? 'configurada (no validada online)' : 'faltante o incompleta'}`);
console.log(`Modelo: ${d.researchModel}`);
console.log(`API de pago: ${d.paidEnabled ? 'HABILITADA (puede generar cargos)' : 'BLOQUEADA (modo seguro)'}`);
console.log(`Programación automática: ${d.automaticSchedule ? 'activada' : 'desactivada'}`);
for (const w of d.warnings) console.log(`Aviso: ${w}`);
console.log(`Próximo paso: ${d.nextStep}\n`);
