const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const osc = require('node-osc');

const oscClient = new osc.Client('127.0.0.1', 9000);

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

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('osc-send', (event, { path, value }) => {
    const oscPath = path.startsWith('/') ? path : `/${path}`;
    oscClient.send(oscPath, value, (err) => {
        if (err) console.error('OSC Error:', err);
    });
});
