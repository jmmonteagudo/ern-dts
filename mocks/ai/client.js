const crypto = require('crypto');

const ENABLED = process.env.MOCK_AI === 'true' || process.env.AI_PROVIDER === 'mock';
const MODEL_ID = process.env.MOCK_AI_MODEL || 'mock-llm-v1';

function getLatencyRange() {
  // In test/CI runs default to 0 so suites stay fast and deterministic.
  const isTest = process.env.NODE_ENV === 'test'
    || process.env.CI === 'true'
    || process.env.JEST_WORKER_ID !== undefined;
  const defaultMin = isTest ? '0' : '500';
  const defaultMax = isTest ? '0' : '1500';
  return {
    min: parseInt(process.env.MOCK_AI_LATENCY_MIN_MS || defaultMin, 10),
    max: parseInt(process.env.MOCK_AI_LATENCY_MAX_MS || defaultMax, 10)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function deterministicConfidence(productId, stock) {
  const hash = crypto.createHash('sha256').update(`${productId}:${stock}`).digest();
  const raw = hash.readUInt16BE(0) / 0xffff;
  return Math.round((0.6 + raw * 0.39) * 100) / 100;
}

function suggestedOrderFor(stock) {
  if (stock === 0) return 500;
  if (stock < 50) return 300;
  if (stock < 100) return 200;
  if (stock < 200) return 100;
  return 50;
}

function reasonFor(stock, auditCount) {
  if (stock === 0) return 'Stock depleted; immediate replenishment required.';
  if (stock < 50) return `Critical stock level (${stock} units); historical turnover suggests +300 order.`;
  if (stock < 100) return `Stock below low_stock threshold (${stock} units); restock recommended within 7 days.`;
  if (auditCount > 5) return `Stock at ${stock} units; high update activity suggests demand trend.`;
  return `Stock at ${stock} units; preventive replenishment.`;
}

async function suggestRestock({ products = [], auditByProduct = {} } = {}) {
  const { min, max } = getLatencyRange();
  let latencyMs = 0;
  if (min > 0) {
    latencyMs = min + Math.floor(Math.random() * Math.max(0, max - min));
    await sleep(latencyMs);
  }

  return products.map(p => {
    const stock = typeof p.stock === 'number' ? p.stock : 0;
    const auditCount = auditByProduct[p.ID]?.length || 0;
    const confidence = deterministicConfidence(p.ID, stock);
    const groundingDocs = [`product:${p.ID}`];
    if (auditCount > 0) groundingDocs.push(`audit-log:${p.ID}`);
    return {
      productID: p.ID,
      currentStock: stock,
      suggestedOrder: suggestedOrderFor(stock),
      reason: reasonFor(stock, auditCount),
      confidence,
      model: MODEL_ID,
      groundingDocs,
      mock: true,
      provider: 'mock',
      latencyMs
    };
  });
}

module.exports = {
  suggestRestock,
  ENABLED,
  MODEL_ID,
  _internals: { deterministicConfidence, suggestedOrderFor, reasonFor }
};
