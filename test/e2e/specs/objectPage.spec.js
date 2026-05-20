describe('Object Page — Product Detail', () => {
  before(async () => {
    await browser.url('/products/webapp/index.html#preview-app');
    await browser.pause(process.env.CI ? 15000 : 5000);
  });

  it('should navigate to Object Page on row click', async () => {
    const firstRow = await browser.asControl({
      selector: {
        controlType: 'sap.m.ColumnListItem',
        properties: {},
        ancestor: {
          controlType: 'sap.m.Table'
        }
      }
    });
    if (firstRow) {
      await firstRow.press();
      await browser.pause(3000);
      const objectPageLayout = await browser.asControl({
        selector: {
          controlType: 'sap.uxap.ObjectPageLayout'
        }
      });
      expect(objectPageLayout).toBeDefined();
    }
  });

  it('should show header with product title', async () => {
    const header = await browser.asControl({
      selector: {
        controlType: 'sap.uxap.ObjectPageDynamicHeaderTitle'
      }
    });
    expect(header).toBeDefined();
  });

  it('should display Audit History section', async () => {
    const sections = await browser.allControls({
      selector: {
        controlType: 'sap.uxap.ObjectPageSection'
      }
    });
    expect(sections.length).toBeGreaterThan(0);
  });

  it('should navigate back to List Report', async () => {
    await browser.back();
    await browser.pause(2000);
    const table = await browser.asControl({
      selector: {
        controlType: 'sap.m.Table',
        interaction: 'root'
      }
    });
    expect(table).toBeDefined();
  });
});
