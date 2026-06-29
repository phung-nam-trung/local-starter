'use strict';

const { contextBridge } = require('electron');

// Empty, safe bridge skeleton. Business IPC (listRepos, etc.) is added in TA2.
// contextIsolation stays on; the renderer only sees what we explicitly expose here.
contextBridge.exposeInMainWorld('launcher', {
  version: '0.1.0',
});
