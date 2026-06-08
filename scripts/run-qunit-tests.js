/* eslint-env node, browser */
const puppeteer = require('puppeteer');

(async () => {
    const QUNIT_URL = process.env.QUNIT_URL || 'http://localhost:4004/products/webapp/test/unit/unitTests.qunit.html';

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Inject QUnit.done listener BEFORE the page scripts run.
    // This guarantees we don't miss the event for fast-running tests.
    await page.evaluateOnNewDocument(() => {
        window.__qunitResult = null;
        const installListener = () => {
            if (window.QUnit && typeof window.QUnit.done === 'function') {
                window.QUnit.done((details) => {
                    window.__qunitResult = details;
                });
            } else {
                setTimeout(installListener, 10);
            }
        };
        installListener();
    });

    page.on('console', (msg) => console.log('[browser]', msg.text()));

    await page.goto(QUNIT_URL, { waitUntil: 'networkidle0' });

    // Wait until QUnit.done has fired
    await page.waitForFunction(() => window.__qunitResult !== null, { timeout: 30000 });

    const result = await page.evaluate(() => window.__qunitResult);

    console.log(`QUnit Tests: ${result.passed} passed, ${result.failed} failed, ${result.total} total (${result.runtime} ms)`);

    await browser.close();

    if (result.failed > 0) {
        console.error('FAILED: ' + result.failed + ' test(s) did not pass.');
        process.exit(1);
    }
    console.log('All tests passed.');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
