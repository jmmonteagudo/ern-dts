const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8765', 10);
const FIXTURE = process.env.MOCK_ATC_FIXTURE || 'run-success';
const LATENCY = parseInt(process.env.MOCK_ATC_LATENCY_MS || '0', 10);

const runs = new Map();

function xmlRunCreated(id) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<atc:run xmlns:atc="http://www.sap.com/adt/atc" id="${id}" status="running"/>`;
}

function xmlRunCompleted(id, findings) {
  const items = findings
    .map(f => `    <finding priority="${f.priority}" check="${f.check}" object="${f.object}" line="${f.line}">${f.message}</finding>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<atc:run xmlns:atc="http://www.sap.com/adt/atc" id="${id}" status="completed">
  <findings count="${findings.length}">
${items}
  </findings>
</atc:run>`;
}

function fixtureFindings(name) {
  if (name === 'run-with-findings') {
    return [
      { priority: 3, check: 'EXTENDED_CHECK', object: 'ZI_ERN_PRODUCT', line: 42, message: 'Unused variable lv_temp' },
      { priority: 3, check: 'UNIT_TESTS', object: 'ZCL_ERN_PRODUCT_HELPER', line: 18, message: 'Public method without unit test' }
    ];
  }
  if (name === 'run-with-blocking-findings') {
    return [
      { priority: 1, check: 'SECURITY', object: 'ZCL_ERN_AUTH', line: 7, message: 'Hardcoded credentials' }
    ];
  }
  return [];
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/vnd.sap.atc.run.v1+xml',
    'X-Mock': 'true',
    'X-Mock-Provider': 'atc-mock',
    'X-Mock-Fixture': FIXTURE,
    ...headers
  });
  res.end(body);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', mock: 'atc', fixture: FIXTURE }));
    return;
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ') || auth.length < 10) {
    send(res, 401, '<error>Unauthorized: missing or invalid Bearer token</error>');
    return;
  }

  if (req.method === 'POST' && url.pathname === '/sap/bc/adt/atc/runs') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      const id = `run-mock-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      runs.set(id, { createdAt: Date.now(), body, fixture: FIXTURE });
      if (LATENCY) await sleep(LATENCY);
      send(res, 201, xmlRunCreated(id));
    });
    return;
  }

  const runMatch = url.pathname.match(/^\/sap\/bc\/adt\/atc\/runs\/(.+)$/);
  if (req.method === 'GET' && runMatch) {
    const id = runMatch[1];
    const run = runs.get(id);
    if (!run) {
      send(res, 404, `<error>Run ${id} not found</error>`);
      return;
    }
    if (LATENCY) await sleep(LATENCY);
    const findings = fixtureFindings(run.fixture);
    send(res, 200, xmlRunCompleted(id, findings));
    return;
  }

  send(res, 404, '<error>Not found</error>');
});

server.listen(PORT, () => {
  console.log(`[mock-atc] listening on http://localhost:${PORT} (fixture=${FIXTURE}, latency=${LATENCY}ms)`);
});

process.on('SIGINT', () => { console.log('[mock-atc] shutdown'); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });

module.exports = { server };
