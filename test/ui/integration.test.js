const cds = require('@sap/cds');
const { GET, POST } = cds.test('serve', '--in-memory');

describe('UI Integration Tests', () => {

  describe('Fiori Elements App Serving', () => {
    it('should serve the webapp index.html', async () => {
      const { status, data } = await GET('/products/webapp/index.html');
      expect(status).toBe(200);
      expect(data).toContain('sap-ui-bootstrap');
      expect(data).toContain('erndts.products');
    });

    it('should serve the manifest.json', async () => {
      const { status, data } = await GET('/products/webapp/manifest.json');
      expect(status).toBe(200);
      expect(data['sap.app'].id).toBe('erndts.products');
      expect(data['sap.ui5'].routing.targets.ProductsList).toBeDefined();
      expect(data['sap.ui5'].routing.targets.ProductsDetail).toBeDefined();
    });

    it('should serve Component.js', async () => {
      const { status, data } = await GET('/products/webapp/Component.js');
      expect(status).toBe(200);
      expect(data).toContain('sap/fe/core/AppComponent');
    });

    it('should serve i18n properties', async () => {
      const { status, data } = await GET('/products/webapp/i18n/i18n.properties');
      expect(status).toBe(200);
      expect(data).toContain('appTitle');
    });
  });

  describe('OData Metadata', () => {
    it('should expose $metadata for Fiori Elements', async () => {
      const { status, data } = await GET('/api/$metadata');
      expect(status).toBe(200);
      expect(data).toContain('ProductService');
      expect(data).toContain('Products');
      expect(data).toContain('AuditLog');
    });

    it('should include navigation properties for Object Page', async () => {
      const { status, data } = await GET('/api/$metadata');
      expect(status).toBe(200);
      expect(data).toContain('auditTrail');
    });

    it('should expose the flagLowStock action', async () => {
      const { status, data } = await GET('/api/$metadata');
      expect(status).toBe(200);
      expect(data).toContain('flagLowStock');
    });
  });

  describe('Fiori Elements Data Contract', () => {
    it('should support $count for List Report', async () => {
      const { status, data } = await GET('/api/Products/$count');
      expect(status).toBe(200);
      expect(Number(data)).toBeGreaterThan(0);
    });

    it('should support $expand for Object Page audit trail', async () => {
      const { data: created } = await POST('/api/Products', {
        name: 'Expand Test', category: 'Test', price: 5, stock: 100, status: 'available', supplier: 'S'
      });

      const { status, data } = await GET(`/api/Products(${created.ID})?$expand=auditTrail`);
      expect(status).toBe(200);
      expect(data.auditTrail).toBeDefined();
      expect(Array.isArray(data.auditTrail)).toBe(true);
      expect(data.auditTrail.length).toBeGreaterThan(0);
    });

    it('should return stockCriticality for conditional styling', async () => {
      const { data } = await GET('/api/Products?$top=1&$select=stock,stockCriticality');
      expect(data.value[0].stockCriticality).toBeDefined();
      expect([1, 2, 3]).toContain(data.value[0].stockCriticality);
    });
  });
});
