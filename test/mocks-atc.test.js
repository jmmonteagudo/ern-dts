const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function makeReq(BASE) {
  return function req(method, pathname, { headers = {}, body = null } = {}) {
    return new Promise((resolve, reject) => {
      const r = http.request(BASE + pathname, { method, headers, agent: false }, res => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      });
      r.on('error', reject);
      if (body) r.write(body);
      r.end();
    });
  };
}

function waitForReady(req, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      req('GET', '/health').then(r => r.status === 200 ? resolve() : reject(new Error('bad health')))
        .catch(() => {
          if (Date.now() - start > timeoutMs) return reject(new Error('mock-atc not ready'));
          setTimeout(attempt, 100);
        });
    })();
  });
}

describe('mock ATC server', () => {
  let proc;
  let req;

  beforeAll(async () => {
    const PORT = await pickFreePort();
    const BASE = `http://localhost:${PORT}`;
    req = makeReq(BASE);
    proc = spawn('node', [path.join(__dirname, '..', 'mocks', 'atc', 'server.js')], {
      env: { ...process.env, PORT: String(PORT), MOCK_ATC_FIXTURE: 'run-success' },
      stdio: 'pipe'
    });
    await waitForReady(req);
  });

  afterAll(async () => {
    if (!proc) return;
    await new Promise(resolve => {
      proc.once('exit', resolve);
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_e) { /* already dead */ } resolve(); }, 2000);
    });
  });

  test('GET /health returns ok', async () => {
    const res = await req('GET', '/health');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe('ok');
    expect(json.mock).toBe('atc');
  });

  test('POST without auth returns 401', async () => {
    const res = await req('POST', '/sap/bc/adt/atc/runs', { body: '<atc:run/>' });
    expect(res.status).toBe(401);
  });

  test('POST with bearer creates run', async () => {
    const res = await req('POST', '/sap/bc/adt/atc/runs', {
      headers: { Authorization: 'Bearer mock-token-test', 'Content-Type': 'application/vnd.sap.atc.run.parameters.v1+xml' },
      body: '<?xml version="1.0"?><atc:run xmlns:atc="http://www.sap.com/adt/atc"><objectSets><objectSet kind="inclusive"><objects><object name="ZERN_PRODUCTS" type="DEVC/K"/></objects></objectSet></objectSets></atc:run>'
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatch(/id="run-mock-/);
    expect(res.body).toMatch(/status="running"/);
  });

  test('GET run returns completed with findings count 0 (success fixture)', async () => {
    const created = await req('POST', '/sap/bc/adt/atc/runs', {
      headers: { Authorization: 'Bearer mock-token-test' },
      body: '<atc:run/>'
    });
    const id = created.body.match(/id="([^"]+)"/)[1];

    const res = await req('GET', `/sap/bc/adt/atc/runs/${id}`, {
      headers: { Authorization: 'Bearer mock-token-test' }
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatch(/status="completed"/);
    expect(res.body).toMatch(/count="0"/);
  });

  test('GET non-existent run returns 404', async () => {
    const res = await req('GET', '/sap/bc/adt/atc/runs/nope', {
      headers: { Authorization: 'Bearer mock-token-test' }
    });
    expect(res.status).toBe(404);
  });

  test('contract: response XML has expected ATC namespace', async () => {
    const created = await req('POST', '/sap/bc/adt/atc/runs', {
      headers: { Authorization: 'Bearer mock-token-test' },
      body: '<atc:run/>'
    });
    expect(created.body).toContain('xmlns:atc="http://www.sap.com/adt/atc"');
  });

  test('observability: every response carries X-Mock + X-Mock-Provider + X-Mock-Fixture headers', async () => {
    const res = await req('POST', '/sap/bc/adt/atc/runs', {
      headers: { Authorization: 'Bearer mock-token-test' },
      body: '<atc:run/>'
    });
    expect(res.headers['x-mock']).toBe('true');
    expect(res.headers['x-mock-provider']).toBe('atc-mock');
    expect(res.headers['x-mock-fixture']).toBe('run-success');
  });
});
