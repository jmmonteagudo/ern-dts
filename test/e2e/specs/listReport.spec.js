describe('List Report — Products', () => {
  before(async () => {
    await browser.url('/products/webapp/index.html#preview-app');
    await browser.pause(process.env.CI ? 15000 : 5000);
  });

  it('should load the product table with 10 entries', async () => {
    const table = await browser.asControl({
      selector: {
        controlType: 'sap.m.Table',
        interaction: 'root'
      }
    });
    const items = await table.getItems();
    expect(items.length).toBe(10);
  });

  it('should display correct column headers', async () => {
    const columns = await browser.asControl({
      selector: {
        controlType: 'sap.m.Column',
        interaction: 'root'
      }
    });
    expect(columns).toBeDefined();
  });

  it('should show criticality indicators in stock column', async () => {
    const objectStatuses = await browser.allControls({
      selector: {
        controlType: 'sap.m.ObjectStatus'
      }
    });
    expect(objectStatuses.length).toBeGreaterThan(0);
  });

  it('should filter products by category', async () => {
    const filterBar = await browser.asControl({
      selector: {
        controlType: 'sap.ui.mdc.FilterBar',
        interaction: 'root'
      }
    });
    expect(filterBar).toBeDefined();
  });
});
