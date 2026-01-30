const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const osc = require('node-osc');
const { spawn } = require('child_process');

const oscClient = new osc.Client('127.0.0.1', 9000);
let serverProcess = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
        autoHideMenuBar: true,
    });

    // check if we are in dev mode
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
}

function startServer() {
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev) {
        // In production, start server.js
        const serverPath = path.join(__dirname, 'server.js');
        console.log('[Electron] Starting server at:', serverPath);

        serverProcess = spawn('node', [serverPath], {
            stdio: 'inherit',
            shell: true
        });

        serverProcess.on('error', (err) => {
            console.error('[Electron] Server error:', err);
        });

        serverProcess.on('exit', (code) => {
            console.log(`[Electron] Server exited with code ${code}`);
        });
    }
}

app.whenReady().then(() => {
    startServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Kill server process if running
    if (serverProcess) {
        console.log('[Electron] Stopping server...');
        serverProcess.kill();
        serverProcess = null;
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    // Ensure server is killed before app quits
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});

ipcMain.on('osc-send', (event, { path, value }) => {
    const oscPath = path.startsWith('/') ? path : `/${path}`;
    oscClient.send(oscPath, value, (err) => {
        if (err) console.error('OSC Error:', err);
    });
});
