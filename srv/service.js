const cds = require('@sap/cds');
const bus = require('./adapters/eventBus');
const ai = require('./adapters/aiProvider');

module.exports = class ProductService extends cds.ApplicationService {
  init() {
    const { Products, AuditLog } = this.entities;

    this.before('CREATE', Products, req => {
      if (req.data.price < 0) req.reject(400, 'Price cannot be negative');
      if (req.data.stock < 0) req.reject(400, 'Stock cannot be negative');
    });

    this.before('UPDATE', Products, req => {
      if (req.data.price !== undefined && req.data.price < 0) req.reject(400, 'Price cannot be negative');
      if (req.data.stock !== undefined && req.data.stock < 0) req.reject(400, 'Stock cannot be negative');
      if (req.data.stock !== undefined && req.data.stock < 100) req.data.status = 'low_stock';
    });

    this.after('READ', Products, data => {
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || item.stock === undefined) continue;
        if (item.stock === 0) item.stockCriticality = 1;
        else if (item.stock < 100) item.stockCriticality = 2;
        else item.stockCriticality = 3;
      }
    });

    this.after('CREATE', Products, async (data, req) => {
      await INSERT.into(AuditLog).entries({
        entity_name: 'Products',
        entity_id: data.ID,
        product_ID: data.ID,
        action: 'CREATE',
        field: '*',
        newValue: data.name,
        user: req.user?.id || 'anonymous'
      });

      bus.publish('sap.ern.product.created.v1', {
        ID: data.ID,
        name: data.name,
        category: data.category,
        price: data.price,
        stock: data.stock,
        status: data.status
      });

      if (data.stock === 0) {
        bus.publish('sap.ern.stock.critical.v1', {
          ID: data.ID,
          name: data.name,
          stock: 0,
          criticality: 1,
          trigger: 'create'
        });
      }
    });

    this.after('UPDATE', Products, async (data, req) => {
      const changes = Object.keys(req.data).filter(k => k !== 'ID');
      const newValues = {};
      for (const field of changes) {
        newValues[field] = req.data[field];
        await INSERT.into(AuditLog).entries({
          entity_name: 'Products',
          entity_id: data.ID,
          product_ID: data.ID,
          action: 'UPDATE',
          field,
          newValue: String(req.data[field]),
          user: req.user?.id || 'anonymous'
        });
      }

      if (changes.length > 0) {
        bus.publish('sap.ern.product.changed.v1', {
          ID: data.ID,
          changedFields: changes,
          newValues
        });
      }

      if (req.data.stock === 0) {
        bus.publish('sap.ern.stock.critical.v1', {
          ID: data.ID,
          stock: 0,
          criticality: 1,
          trigger: 'update'
        });
      }
    });

    this.on('flagLowStock', async req => {
      const { ids } = req.data;
      if (!ids || ids.length === 0) return req.reject(400, 'No products selected');
      await UPDATE(Products).where({ ID: { in: ids } }).set({ status: 'low_stock' });
      for (const id of ids) {
        await INSERT.into(AuditLog).entries({
          entity_name: 'Products',
          entity_id: id,
          product_ID: id,
          action: 'UPDATE',
          field: 'status',
          newValue: 'low_stock',
          user: req.user?.id || 'anonymous'
        });
        bus.publish('sap.ern.stock.low.v1', {
          ID: id,
          criticality: 2,
          trigger: 'flagLowStock'
        });
      }
      return `${ids.length} product(s) flagged as low stock`;
    });

    this.on('suggestRestock', async req => {
      const { ids } = req.data;
      if (!ids || ids.length === 0) return req.reject(400, 'No products selected');

      const products = await SELECT.from(Products).where({ ID: { in: ids } });
      if (products.length === 0) return req.reject(404, 'No matching products found');

      const auditEntries = await SELECT.from(AuditLog).where({ product_ID: { in: ids } });
      const auditByProduct = {};
      for (const entry of auditEntries) {
        if (!auditByProduct[entry.product_ID]) auditByProduct[entry.product_ID] = [];
        auditByProduct[entry.product_ID].push(entry);
      }

      const suggestions = await ai.suggestRestock({ products, auditByProduct });

      bus.publish('sap.ern.ai.restock.suggested.v1', {
        count: suggestions.length,
        model: ai.MODEL_ID,
        productIDs: suggestions.map(s => s.productID)
      });

      return suggestions;
    });

    return super.init();
  }
};
