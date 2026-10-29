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
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
