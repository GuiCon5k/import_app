import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getDiagnostics } from '../src/diagnostics.js';

test('sin API no hay investigación lista, y no revela secretos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guicon-doctor-'));
  try {
    const d = getDiagnostics(dir, { OPENAI_API_KEY: '' });
    assert.equal(d.configured, false);
    assert.equal(d.apiKeyPresent, false);
    assert.match(d.nextStep, /guía/);
    fs.writeFileSync(path.join(dir,'.env'),'OPENAI_API_KEY=sk-proj-EXAMPLE_FOR_TEST_ONLY-1234567890');
    const ready = getDiagnostics(dir,{ OPENAI_API_KEY: 'sk-proj-EXAMPLE_FOR_TEST_ONLY-1234567890' });
    assert.equal(ready.configured, true);
    assert.equal(ready.liveApiVerified, false);
    assert.ok(!JSON.stringify(ready).includes('EXAMPLE_FOR_TEST_ONLY'));
    const oauth=getDiagnostics(dir,{ML_CLIENT_ID:'123456',ML_CLIENT_SECRET:'SECRET_EXAMPLE',
      ML_REDIRECT_URI:'https://example.com/auth/mercadolibre/callback',ML_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),
      UPSTASH_REDIS_REST_URL:'https://example.upstash.io',UPSTASH_REDIS_REST_TOKEN:'SECRET_EXAMPLE'});
    assert.equal(oauth.mlTokenPresent,false);
    assert.equal(oauth.marketplaceMode,'oauth_configurado_acceso_no_comprobado');
    assert.equal(oauth.liveApiVerified,false);
    assert.doesNotMatch(JSON.stringify(oauth),/SECRET_EXAMPLE/);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
