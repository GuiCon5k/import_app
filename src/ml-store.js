/** JavaScript + Node.js: tokens OAuth cifrados con AES-256-GCM en Upstash Redis REST.
 * Render Free no tiene disco persistente. Nunca guardamos tokens en el navegador ni en Git. */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const STORE_KEY = 'guicon:mercadolibre:credentials:v1';
export function storeConfigured(env = process.env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN && /^[a-f\d]{64}$/i.test(env.ML_TOKEN_ENCRYPTION_KEY || ''));
}
function encryptionKey(env) {
  if (!/^[a-f\d]{64}$/i.test(env.ML_TOKEN_ENCRYPTION_KEY || '')) throw new Error('Configurá ML_TOKEN_ENCRYPTION_KEY: 64 caracteres hexadecimales.');
  return Buffer.from(env.ML_TOKEN_ENCRYPTION_KEY, 'hex');
}
export function encryptTokens(value, env = process.env) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  const content = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), content.toString('base64url')].join('.');
}
export function decryptTokens(ciphertext, env = process.env) {
  const parts = String(ciphertext).split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Formato de tokens almacenados inválido.');
  const [, iv, tag, data] = parts;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(env), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8'));
}

export class RedisTokenStore {
  constructor({ env = process.env, fetchImpl = fetch } = {}) { this.env = env; this.fetchImpl = fetchImpl; }
  async command(args) {
    if (!storeConfigured(this.env)) throw Object.assign(new Error('Falta configurar el almacenamiento persistente para Mercado Libre.'), { status: 503 });
    const base = new URL(this.env.UPSTASH_REDIS_REST_URL);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
      throw Object.assign(new Error('UPSTASH_REDIS_REST_URL debe ser una dirección HTTPS de la API REST.'), { status: 503 });
    }
    let response;
    try {
      response = await this.fetchImpl(base.href, {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { 'Authorization': `Bearer ${this.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
    } catch { throw Object.assign(new Error('No se pudo contactar el almacenamiento de tokens.'), { status: 502 }); }
    if (!response.ok) throw Object.assign(new Error('El almacenamiento de tokens rechazó la operación. Revisá la configuración de Upstash.'), { status: 502 });
    const result = await response.json();
    if (result.error) throw Object.assign(new Error('El almacenamiento de tokens devolvió un error.'), { status: 502 });
    return result.result;
  }
  async load() {
    const encrypted = await this.command(['GET', STORE_KEY]);
    return encrypted ? decryptTokens(encrypted, this.env) : null;
  }
  async save(tokens) {
    const response = await this.command(['SET', STORE_KEY, encryptTokens(tokens, this.env)]);
    if (response !== 'OK') throw new Error('No se pudieron persistir los tokens.');
  }
}
