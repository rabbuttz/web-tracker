const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const osc = require('node-osc');
const { spawn, exec } = require('child_process');
const AutoLaunch = require('auto-launch');

const oscClient = new osc.Client('127.0.0.1', 9000);
let serverProcess = null;
let resoniteMonitorInterval = null;
let mainWindow = null;
let tray = null;
const RESONITE_PROCESS_NAME = 'Resonite.exe';
const MONITOR_INTERVAL_MS = 5000;

const autoLauncher = new AutoLaunch({
    name: 'Web Tracker',
    path: app.getPath('exe'),
});

async function isResoniteRunning() {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            exec(`tasklist /FI "IMAGENAME eq ${RESONITE_PROCESS_NAME}" /NH`, (err, stdout) => {
                if (err) {
                    resolve(false);
                    return;
                }
                resolve(stdout.toLowerCase().includes(RESONITE_PROCESS_NAME.toLowerCase()));
            });
        } else {
            exec(`pgrep -x Resonite`, (err, stdout) => {
                resolve(!err && stdout.trim().length > 0);
            });
        }
    });
}

function startResoniteMonitor() {
    if (resoniteMonitorInterval) {
        clearInterval(resoniteMonitorInterval);
    }

    console.log('[Electron] Starting Resonite monitor...');

    resoniteMonitorInterval = setInterval(async () => {
        const running = await isResoniteRunning();

        if (running && !mainWindow) {
            console.log('[Electron] Resonite started. Opening window...');
            if (tray) {
                tray.setToolTip('Web Tracker - Running');
            }
            startServer();
            createWindow();
        } else if (!running && mainWindow) {
            console.log('[Electron] Resonite stopped. Closing window...');
            if (tray) {
                tray.setToolTip('Web Tracker - Waiting for Resonite...');
            }
            killServerProcess();
            if (mainWindow) {
                mainWindow.close();
                mainWindow = null;
            }
        }
    }, MONITOR_INTERVAL_MS);
}

function stopResoniteMonitor() {
    if (resoniteMonitorInterval) {
        clearInterval(resoniteMonitorInterval);
        resoniteMonitorInterval = null;
        console.log('[Electron] Resonite monitor stopped.');
    }
}

function createTray() {
    try {
        const { nativeImage } = require('electron');
        const iconPath = path.join(__dirname, 'build', 'icon.png');
        const fs = require('fs');

        let icon;
        if (fs.existsSync(iconPath)) {
            icon = nativeImage.createFromPath(iconPath);
        } else {
            icon = nativeImage.createEmpty();
        }

        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show Window',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            {
                label: 'Quit',
                click: () => {
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('Web Tracker - Waiting for Resonite...');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
    } catch (err) {
        console.error('[Electron] Failed to create tray:', err);
    }
}

function createWindow() {
    if (mainWindow) {
        mainWindow.focus();
        return;
    }

    const iconPath = path.join(__dirname, 'build', 'icon.png');

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
        autoHideMenuBar: true,
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
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

app.whenReady().then(async () => {
    try {
        await autoLauncher.enable();
        console.log('[Electron] Auto-launch enabled');
    } catch (err) {
        console.error('[Electron] Failed to enable auto-launch:', err);
    }

    createTray();

    const resoniteRunning = await isResoniteRunning();

    if (resoniteRunning) {
        console.log('[Electron] Resonite is running. Starting app...');
        startServer();
        createWindow();
    } else {
        console.log('[Electron] Resonite is not running. Waiting in background...');
    }

    startResoniteMonitor();

    app.on('activate', () => {
        if (mainWindow) {
            mainWindow.show();
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
    // Don't quit the app when all windows are closed
    // Keep running in background to monitor Resonite
    console.log('[Electron] All windows closed. Running in background...');
});

app.on('before-quit', (event) => {
    stopResoniteMonitor();

    if (serverProcess) {
        event.preventDefault();
        killServerProcess();

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
