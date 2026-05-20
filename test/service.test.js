const cds = require('@sap/cds');
const { GET, POST, PATCH } = cds.test('serve', '--in-memory');

describe('ProductService', () => {

  describe('READ operations', () => {
    it('should return all products', async () => {
      const { data } = await GET('/api/Products');
      expect(data.value.length).toBeGreaterThan(0);
    });

    it('should filter products by category', async () => {
      const { data } = await GET("/api/Products?$filter=category eq 'Chemicals'");
      expect(data.value.length).toBe(3);
      data.value.forEach(p => expect(p.category).toBe('Chemicals'));
    });

    it('should filter products by status', async () => {
      const { data } = await GET("/api/Products?$filter=status eq 'low_stock'");
      data.value.forEach(p => expect(p.status).toBe('low_stock'));
    });

    it('should return a single product by ID', async () => {
      const { data: all } = await GET('/api/Products?$top=1');
      const id = all.value[0].ID;
      const { data } = await GET(`/api/Products(${id})`);
      expect(data.ID).toBe(id);
      expect(data.name).toBeDefined();
    });
  });

  describe('CREATE operations', () => {
    it('should create a product with valid data', async () => {
      const { data } = await POST('/api/Products', {
        name: 'Test Product',
        category: 'Test',
        price: 10.00,
        stock: 100,
        status: 'available',
        supplier: 'TestSupplier'
      });
      expect(data.name).toBe('Test Product');
      expect(data.ID).toBeDefined();
    });

    it('should reject product with negative price', async () => {
      expect.assertions(1);
      try {
        await POST('/api/Products', {
          name: 'Bad Product',
          category: 'Test',
          price: -5.00,
          stock: 100,
          status: 'available'
        });
      } catch (err) {
        expect(err.response.status).toBe(400);
      }
    });

    it('should reject product with negative stock', async () => {
      expect.assertions(1);
      try {
        await POST('/api/Products', {
          name: 'Bad Stock Product',
          category: 'Test',
          price: 10.00,
          stock: -1,
          status: 'available'
        });
      } catch (err) {
        expect(err.response.status).toBe(400);
      }
    });
  });

  describe('UPDATE operations', () => {
    it('should auto-set low_stock status when stock < 100', async () => {
      const { data: created } = await POST('/api/Products', {
        name: 'Stock Test',
        category: 'Test',
        price: 5.00,
        stock: 200,
        status: 'available',
        supplier: 'TestSupplier'
      });

      await PATCH(`/api/Products(${created.ID})`, { stock: 50 });
      const { data: updated } = await GET(`/api/Products(${created.ID})`);
      expect(updated.status).toBe('low_stock');
    });
  });

  describe('AuditLog', () => {
    it('should log CREATE events', async () => {
      const { data: product } = await POST('/api/Products', {
        name: 'Audit Test',
        category: 'Test',
        price: 20.00,
        stock: 500,
        status: 'available',
        supplier: 'AuditSupplier'
      });

      const { data: logs } = await GET(`/api/AuditLog?$filter=entity_id eq '${product.ID}'`);
      expect(logs.value.length).toBeGreaterThan(0);
      expect(logs.value[0].action).toBe('CREATE');
      expect(logs.value[0].entity_name).toBe('Products');
    });

    it('should log UPDATE events with changed fields', async () => {
      const { data: product } = await POST('/api/Products', {
        name: 'Audit Update Test',
        category: 'Test',
        price: 15.00,
        stock: 300,
        status: 'available',
        supplier: 'AuditSupplier'
      });

      await PATCH(`/api/Products(${product.ID})`, { price: 25.00 });

      const { data: logs } = await GET(
        `/api/AuditLog?$filter=entity_id eq '${product.ID}' and action eq 'UPDATE'`
      );
      expect(logs.value.length).toBeGreaterThan(0);
      expect(logs.value.some(l => l.field === 'price')).toBe(true);
    });
  });

  describe('Custom Actions', () => {
    it('should flag products as low stock', async () => {
      const { data: p1 } = await POST('/api/Products', {
        name: 'Action Test 1', category: 'Test', price: 10, stock: 500, status: 'available', supplier: 'S'
      });
      const { data: p2 } = await POST('/api/Products', {
        name: 'Action Test 2', category: 'Test', price: 20, stock: 400, status: 'available', supplier: 'S'
      });

      const { data: result } = await POST('/api/flagLowStock', { ids: [p1.ID, p2.ID] });
      expect(result.value).toContain('2 product(s)');

      const { data: updated } = await GET(`/api/Products(${p1.ID})`);
      expect(updated.status).toBe('low_stock');
    });

    it('should reject flagLowStock with no ids', async () => {
      expect.assertions(1);
      try {
        await POST('/api/flagLowStock', { ids: [] });
      } catch (err) {
        expect(err.response.status).toBe(400);
      }
    });
  });

  describe('Criticality', () => {
    it('should compute stockCriticality based on stock level', async () => {
      const { data } = await GET("/api/Products?$filter=stock eq 0");
      if (data.value.length > 0) {
        expect(data.value[0].stockCriticality).toBe(1);
      }

      const { data: low } = await GET("/api/Products?$filter=stock lt 100 and stock gt 0");
      if (low.value.length > 0) {
        expect(low.value[0].stockCriticality).toBe(2);
      }

      const { data: high } = await GET("/api/Products?$filter=stock ge 100");
      if (high.value.length > 0) {
        expect(high.value[0].stockCriticality).toBe(3);
      }
    });

    it('should reject UPDATE with negative price', async () => {
      expect.assertions(1);
      const { data: product } = await POST('/api/Products', {
      name: 'Neg Price Update', category: 'Test', price: 5, stock: 10, status: 'available', supplier: 'S'
      });
      try {
      await PATCH(`/api/Products(${product.ID})`, { price: -20 });
      } catch (err) {
      expect(err.response.status).toBe(400);
      }
    });

    it('should reject UPDATE with negative stock', async () => {
      expect.assertions(1);
      const { data: product } = await POST('/api/Products', {
      name: 'Neg Stock Update', category: 'Test', price: 5, stock: 10, status: 'available', supplier: 'S'
      });
      try {
      await PATCH(`/api/Products(${product.ID})`, { stock: -5 });
      } catch (err) {
      expect(err.response.status).toBe(400);
      }
    });

    it('should create audit log entries for multiple updated fields', async () => {
      const { data: product } = await POST('/api/Products', {
      name: 'Multi Field Audit', category: 'Test', price: 10, stock: 200, status: 'available', supplier: 'S'
      });
      await PATCH(`/api/Products(${product.ID})`, { price: 15, stock: 50 });
      const { data: logs } = await GET(
      `/api/AuditLog?$filter=entity_id eq '${product.ID}' and action eq 'UPDATE'`
      );
      expect(logs.value.length).toBeGreaterThanOrEqual(2);
      expect(logs.value.some(l => l.field === 'price')).toBe(true);
      expect(logs.value.some(l => l.field === 'stock')).toBe(true);
    });

    it('should assign correct stockCriticality for newly created product with zero stock', async () => {
      const { data: product } = await POST('/api/Products', {
      name: 'Criticality Zero', category: 'Test', price: 1, stock: 0, status: 'available', supplier: 'S'
      });
      const { data: fetched } = await GET(`/api/Products(${product.ID})`);
      expect(fetched.stockCriticality).toBe(1);
    });
  });
});
