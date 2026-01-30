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

function killServerProcess() {
    if (!serverProcess) return;

    console.log('[Electron] Stopping server...');

    if (process.platform === 'win32') {
        // Windows: Use taskkill to ensure all child processes are killed
        try {
            spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t'], {
                stdio: 'ignore'
            });
        } catch (err) {
            console.error('[Electron] Error killing server:', err);
        }
    } else {
        // Unix-like: Use regular kill
        try {
            serverProcess.kill('SIGTERM');
        } catch (err) {
            console.error('[Electron] Error killing server:', err);
        }
    }

    serverProcess = null;
}

app.on('window-all-closed', () => {
    killServerProcess();

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', (event) => {
    if (serverProcess) {
        event.preventDefault(); // Wait for server to stop
        killServerProcess();

        // Give it a moment, then quit
        setTimeout(() => {
            app.exit(0);
        }, 500);
    }
});

ipcMain.on('osc-send', (event, { path, value }) => {
    const oscPath = path.startsWith('/') ? path : `/${path}`;
    oscClient.send(oscPath, value, (err) => {
        if (err) console.error('OSC Error:', err);
    });
});
