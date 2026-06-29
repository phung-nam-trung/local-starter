'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('node:path');

// Dev mode unless the app is packaged. In dev we boot a Vite dev server in-process
// (no extra concurrently/wait-on deps); in production we load the built file.
const isDev = !app.isPackaged;

let mainWindow = null;
let viteServer = null;

async function startViteServer() {
  // Vite is a devDependency; only require it when running unpackaged.
  const { createServer } = require('vite');
  const server = await createServer({
    configFile: path.join(__dirname, '..', '..', 'vite.config.js'),
  });
  await server.listen();
  return server;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    title: 'Local Dev Launcher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    viteServer = await startViteServer();
    const address = viteServer.httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 5173;
    await mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html')
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', async () => {
  if (viteServer) {
    await viteServer.close();
    viteServer = null;
  }
});
