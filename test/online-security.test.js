import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../src/server.js';

// Node.js node:test: comprueba que el público NO pueda usar las rutas de API.
test('modo Render: bloquea visitas sin contraseña y acepta credenciales correctas', async () => {
  const vars = ['NODE_ENV', 'APP_USERNAME', 'APP_PASSWORD', 'PAID_API_ENABLED'];
  const previous = Object.fromEntries(vars.map(x => [x, process.env[x]]));
  Object.assign(process.env, {
    NODE_ENV: 'production', APP_USERNAME: 'guicon',
    APP_PASSWORD: 'password-privada-de-prueba-123456', PAID_API_ENABLED: 'false'
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const authorized = 'Basic ' + Buffer.from('guicon:password-privada-de-prueba-123456').toString('base64');
  try {
    const anon = await fetch(origin + '/');
    assert.equal(anon.status, 401);
    assert.match(anon.headers.get('www-authenticate'), /Basic/);
    assert.equal((await fetch(origin + '/api/status')).status, 401);
    assert.equal((await fetch(origin + '/api/research/demo')).status, 401);
    const wrong = await fetch(origin + '/', {headers:{Authorization: 'Basic ' + Buffer.from('guicon:incorrecta').toString('base64')}});
    assert.equal(wrong.status, 401);
    const home = await fetch(origin + '/', {headers:{Authorization: authorized}});
    assert.equal(home.status, 200);
    const status = await fetch(origin + '/api/status', {headers:{Authorization: authorized}});
    assert.equal((await status.json()).paidEnabled, false);
    const blocked = await fetch(origin + '/api/research/start', {method:'POST',headers:{Authorization:authorized,'Content-Type':'application/json'},body:'{}'});
    assert.equal(blocked.status, 503);
    const csrf = await fetch(origin + '/api/calculate', {method:'POST',headers:{Authorization:authorized,Origin:'https://otro-dominio.com','Content-Type':'application/json'},body:'{}'});
    assert.equal(csrf.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const v of vars) previous[v] === undefined ? delete process.env[v] : process.env[v]=previous[v];
  }
});
