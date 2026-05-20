describe('mock AI client', () => {
  let ai;

  beforeAll(() => {
    process.env.MOCK_AI_LATENCY_MIN_MS = '0';
    process.env.MOCK_AI_LATENCY_MAX_MS = '0';
    delete require.cache[require.resolve('../mocks/ai/client')];
    ai = require('../mocks/ai/client');
  });

  test('returns one suggestion per input product', async () => {
    const result = await ai.suggestRestock({
      products: [
        { ID: 'P-001', stock: 50 },
        { ID: 'P-002', stock: 200 }
      ]
    });
    expect(result).toHaveLength(2);
    expect(result[0].productID).toBe('P-001');
    expect(result[1].productID).toBe('P-002');
  });

  test('contract: each suggestion has all required fields', async () => {
    const [s] = await ai.suggestRestock({
      products: [{ ID: 'P-001', stock: 50 }]
    });
    expect(s).toEqual(expect.objectContaining({
      productID: expect.any(String),
      currentStock: expect.any(Number),
      suggestedOrder: expect.any(Number),
      reason: expect.any(String),
      confidence: expect.any(Number),
      model: expect.any(String),
      groundingDocs: expect.any(Array)
    }));
    expect(s.confidence).toBeGreaterThanOrEqual(0);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });

  test('confidence is deterministic for same (id, stock)', async () => {
    const [a] = await ai.suggestRestock({ products: [{ ID: 'P-001', stock: 50 }] });
    const [b] = await ai.suggestRestock({ products: [{ ID: 'P-001', stock: 50 }] });
    expect(a.confidence).toBe(b.confidence);
  });

  test('confidence differs across different products', async () => {
    const [a] = await ai.suggestRestock({ products: [{ ID: 'P-001', stock: 50 }] });
    const [b] = await ai.suggestRestock({ products: [{ ID: 'P-002', stock: 50 }] });
    expect(a.confidence).not.toBe(b.confidence);
  });

  test('suggestedOrder follows the rule table', async () => {
    const cases = [
      { stock: 0, expected: 500 },
      { stock: 30, expected: 300 },
      { stock: 80, expected: 200 },
      { stock: 150, expected: 100 },
      { stock: 500, expected: 50 }
    ];
    for (const c of cases) {
      const [s] = await ai.suggestRestock({
        products: [{ ID: `P-${c.stock}`, stock: c.stock }]
      });
      expect(s.suggestedOrder).toBe(c.expected);
    }
  });

  test('groundingDocs includes audit-log when audit entries are provided', async () => {
    const [withAudit] = await ai.suggestRestock({
      products: [{ ID: 'P-001', stock: 50 }],
      auditByProduct: { 'P-001': [{ action: 'CREATE' }] }
    });
    const [withoutAudit] = await ai.suggestRestock({
      products: [{ ID: 'P-002', stock: 50 }]
    });
    expect(withAudit.groundingDocs).toContain('audit-log:P-001');
    expect(withoutAudit.groundingDocs).not.toContain('audit-log:P-002');
  });

  test('reason text adapts to stock level', async () => {
    const [zero] = await ai.suggestRestock({ products: [{ ID: 'A', stock: 0 }] });
    const [crit] = await ai.suggestRestock({ products: [{ ID: 'B', stock: 30 }] });
    const [low]  = await ai.suggestRestock({ products: [{ ID: 'C', stock: 80 }] });
    expect(zero.reason).toMatch(/depleted/i);
    expect(crit.reason).toMatch(/critical/i);
    expect(low.reason).toMatch(/below low_stock/i);
  });

  test('model field is present and matches MODEL_ID export', async () => {
    const [s] = await ai.suggestRestock({ products: [{ ID: 'X', stock: 100 }] });
    expect(s.model).toBe(ai.MODEL_ID);
  });

  test('latency is applied when configured', async () => {
    process.env.MOCK_AI_LATENCY_MIN_MS = '50';
    process.env.MOCK_AI_LATENCY_MAX_MS = '60';
    const start = Date.now();
    await ai.suggestRestock({ products: [{ ID: 'P-001', stock: 50 }] });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
    process.env.MOCK_AI_LATENCY_MIN_MS = '0';
    process.env.MOCK_AI_LATENCY_MAX_MS = '0';
  });

  test('observability: every suggestion carries mock=true, provider=mock, latencyMs', async () => {
    const [s] = await ai.suggestRestock({ products: [{ ID: 'P-001', stock: 50 }] });
    expect(s.mock).toBe(true);
    expect(s.provider).toBe('mock');
    expect(typeof s.latencyMs).toBe('number');
    expect(s.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
