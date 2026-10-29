/** JavaScript + Node.js: diagnóstico local. No realiza peticiones pagas ni muestra la clave API. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Carga variables de .env sin dependencias. Las variables del sistema tienen prioridad. */
export function loadLocalEnv(root = projectRoot) {
  const location = path.join(root, '.env');
  if (!fs.existsSync(location)) return false;
  for (const line of fs.readFileSync(location, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !line.trim().startsWith('#') && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return true;
}

/** Solo revisa la configuración. No comprueba saldo ni validez remota de la clave. */
export function getDiagnostics(root = projectRoot, env = process.env) {
  const hasEnv = fs.existsSync(path.join(root, '.env'));
  const key = (env.OPENAI_API_KEY || '').trim();
  const placeholder = /^(tu[_ -]?clave|pega|sk-ejemplo|your[_ -]?key|<|xxx)/i.test(key);
  const hasKey = key.length >= 20 && !placeholder;
  const model = (env.RESEARCH_MODEL || 'gpt-5-mini').trim();
  const warnings = [];
  if (!hasKey) warnings.push('Falta una clave API real. Creá guicon-ai/.env y agregá OPENAI_API_KEY=tu_clave_real.');
  if (key && !hasKey) warnings.push('La clave configurada parece incompleta o de ejemplo.');
  if (!model) warnings.push('Configurá RESEARCH_MODEL=gpt-5-mini.');
  return {
    configured: hasKey && Boolean(model),
    paidEnabled: env.PAID_API_ENABLED === 'true',
    version: '0.4.1',
    envFile: hasEnv,
    apiKeyPresent: hasKey,
    researchModel: model,
    mlTokenPresent: Boolean((env.ML_ACCESS_TOKEN || "").trim()),
    marketplaceMode: (env.ML_ACCESS_TOKEN || "").trim() ? "api_oficial_opcional" : "enlaces_web_sin_precio_verificado",
    automaticSchedule: env.AUTO_RESEARCH_ENABLED === 'true',
    serverReady: true,
    liveApiVerified: false,
    warnings,
    nextStep: !hasKey
      ? 'Seguí la guía de configuración y reiniciá la aplicación.'
      : env.PAID_API_ENABLED !== 'true'
        ? 'Clave detectada. El modo pago está BLOQUEADO: PAID_API_ENABLED=false. Podés usar la demostración gratuita.'
        : 'Modo pago habilitado. La validez remota de la clave solo se comprueba con una solicitud real que puede generar cargos.'
  };
}
