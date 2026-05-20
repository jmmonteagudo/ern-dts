const path = require('path');

exports.config = {
  runner: 'local',
  specs: [path.join(__dirname, 'specs', '**', '*.spec.js')],
  maxInstances: 1,
  capabilities: [{
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: process.env.CI
        ? ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        : []
    }
  }],
  logLevel: 'error',
  bail: 0,
  baseUrl: 'http://localhost:4004',
  waitforTimeout: 60000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['ui5'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000
  },
  wdi5: {
    waitForUI5Timeout: 60000
  }
};
