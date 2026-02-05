const { app, BrowserWindow, ipcMain, Tray, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const osc = require('node-osc');
const { spawn, exec } = require('child_process');
const AutoLaunch = require('auto-launch');

// Logging setup (local time)
const LOG_DIR = app.getPath('logs');
let logStream = null;

const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

function formatLocalDate(date) {
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatLocalTimestamp(date) {
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const ms = pad(date.getMilliseconds(), 3);
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${offsetHours}:${offsetMins}`;
}

function initLogging() {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        const today = formatLocalDate(new Date());
        const logFilePath = path.join(LOG_DIR, `app-${today}.log`);
        logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
        log('info', '=== Application Starting ===');
        log('info', `Log file: ${logFilePath}`);
    } catch (err) {
        originalConsole.error('[Electron] Failed to initialize logging:', err);
    }
}

function log(level, ...args) {
    const timestamp = formatLocalTimestamp(new Date());
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');

    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    const consoleFn = originalConsole[level] || originalConsole.log;
    consoleFn(...args);

    if (logStream) {
        logStream.write(logLine);
    }
}

console.log = (...args) => log('log', ...args);
console.info = (...args) => log('info', ...args);
console.warn = (...args) => log('warn', ...args);
console.error = (...args) => log('error', ...args);

initLogging();

const oscClient = new osc.Client('127.0.0.1', 9000);
let serverProcess = null;
let resoniteMonitorInterval = null;
let mainWindow = null;
let tray = null;
let manuallyOpened = false;
let isQuitting = false;
let lastResoniteState = false;
let trackingEnabled = false;
let manualTrackingOverride = false;  // User manually enabled tracking despite VR
const RESONITE_PROCESS_NAME = 'Resonite.exe';
const MONITOR_INTERVAL_MS = 5000;

// Helper function to format vectors for OSC
function formatVec(values) {
    return `[${values.map(n => n.toFixed(4)).join(';')}]`;
}

// Send OSC parameter reset values
function sendOSCReset() {
    console.log('[Electron] Sending OSC reset values...');

    const resetFloat = 0.0001;
    const resetVec3 = formatVec([resetFloat, resetFloat, resetFloat]);
    const resetQuat = formatVec([0, 0, 0, 1]);  // Identity quaternion (no rotation)

    // Head tracking reset
    oscClient.send('/avatar/parameters/Head.Position', resetVec3);
    oscClient.send('/avatar/parameters/Head.Rotation', resetQuat);
    oscClient.send('Head.Rotation', resetQuat);
    oscClient.send('/avatar/parameters/Head.Detected', 0);

    // Hand tracking reset (Left)
    oscClient.send('/avatar/parameters/Hand.L.Position', resetVec3);
    oscClient.send('/avatar/parameters/Hand.L.Rotation', resetQuat);
    oscClient.send('/avatar/parameters/Hand.L.Detected', 0);

    // Hand tracking reset (Right)
    oscClient.send('/avatar/parameters/Hand.R.Position', resetVec3);
    oscClient.send('/avatar/parameters/Hand.R.Rotation', resetQuat);
    oscClient.send('/avatar/parameters/Hand.R.Detected', 0);

    // Mouth and visemes reset
    oscClient.send('/avatar/parameters/MouthOpen', resetFloat);
    oscClient.send('/avatar/parameters/aa', resetFloat);
    oscClient.send('/avatar/parameters/ih', resetFloat);
    oscClient.send('/avatar/parameters/ou', resetFloat);
    oscClient.send('/avatar/parameters/E', resetFloat);
    oscClient.send('/avatar/parameters/oh', resetFloat);

    // Blendshapes reset
    oscClient.send('/avatar/parameters/Blendshapes/EyeBlinkLeft', resetFloat);
    oscClient.send('/avatar/parameters/Blendshapes/EyeBlinkRight', resetFloat);
    oscClient.send('/avatar/parameters/Blendshapes/BrowInnerUp', resetFloat);
    oscClient.send('/avatar/parameters/Blendshapes/CheekPuff', resetFloat);
    oscClient.send('/avatar/parameters/Blendshapes/JawOpen', resetFloat);
    oscClient.send('/avatar/parameters/Blendshapes/MouthOpen', resetFloat);
    oscClient.send('/avatar/parameters/Blendshapes/MouthPucker', resetFloat);
    oscClient.send('/avatar/parameters/Blendshapes/MouthSmile', resetFloat);

    console.log('[Electron] OSC reset values sent');
}

const autoLauncher = new AutoLaunch({
    name: 'WebCamTracker4Resonite',
    path: app.getPath('exe'),
});

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('[Electron] Another instance is already running. Quitting...');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        console.log('[Electron] Second instance attempted. Showing existing window...');
        // Someone tried to run a second instance, show the existing window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        } else {
            // If no window exists, create one
            manuallyOpened = true;
            if (!serverProcess) {
                startServer();
            }
            createWindow();
        }
    });
}

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

async function isProcessRunning(processName) {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            exec(`tasklist /FI "IMAGENAME eq ${processName}" /NH`, (err, stdout) => {
                if (err) {
                    resolve(false);
                    return;
                }
                resolve(stdout.toLowerCase().includes(processName.toLowerCase()));
            });
        } else {
            // For non-Windows platforms, assume not running
            resolve(false);
        }
    });
}

async function isVRRuntimeActive() {
    // Check for SteamVR
    const steamVR = await isProcessRunning('vrserver.exe');
    // Check for Oculus Runtime
    const oculus = await isProcessRunning('OculusClient.exe');

    const isActive = steamVR || oculus;
    if (isActive) {
        console.log('[Electron] VR Runtime detected:', steamVR ? 'SteamVR' : 'Oculus');
    }
    return isActive;
}

async function startTracking() {
    if (trackingEnabled) {
        console.log('[Electron] Tracking already enabled');
        return;
    }

    console.log('[Electron] Starting tracking...');
    trackingEnabled = true;

    if (tray) {
        tray.setToolTip('WebCamTracker4Resonite - Tracking');
        const trackingIconPath = path.join(__dirname, 'build', 'tracking.png');
        const nativeImage = require('electron').nativeImage;
        if (require('fs').existsSync(trackingIconPath)) {
            tray.setImage(nativeImage.createFromPath(trackingIconPath));
        }
        updateTrayMenu();
    }

    // Start server (only in production)
    if (!serverProcess) {
        startServer();
    }

    // Create window for tracking
    if (!mainWindow) {
        console.log('[Electron] Creating window for tracking...');
        createWindow(false);
    }
}

function stopTracking() {
    if (!trackingEnabled) {
        console.log('[Electron] Tracking already disabled');
        return;
    }

    console.log('[Electron] Stopping tracking...');

    // Send OSC reset values before stopping
    sendOSCReset();

    trackingEnabled = false;
    manualTrackingOverride = false;

    if (tray) {
        tray.setToolTip('WebCamTracker4Resonite - Waiting for Resonite...');
        const nonTrackingIconPath = path.join(__dirname, 'build', 'non-tracking.png');
        const nativeImage = require('electron').nativeImage;
        if (require('fs').existsSync(nonTrackingIconPath)) {
            tray.setImage(nativeImage.createFromPath(nonTrackingIconPath));
        }
        updateTrayMenu();
    }

    killServerProcess();

    // Destroy window to stop camera and tracking (unless manually opened by user)
    if (mainWindow && !manuallyOpened) {
        console.log('[Electron] Destroying window to stop camera and tracking');
        mainWindow.destroy();
        mainWindow = null;
    }
}

function startResoniteMonitor() {
    if (resoniteMonitorInterval) {
        clearInterval(resoniteMonitorInterval);
    }

    console.log('[Electron] Starting Resonite monitor...');

    resoniteMonitorInterval = setInterval(async () => {
        const running = await isResoniteRunning();

        // Only react to state changes
        if (running && !lastResoniteState) {
            // Resonite just started
            console.log('[Electron] Resonite started.');
            lastResoniteState = true;

            // Check if VR runtime is active
            const vrActive = await isVRRuntimeActive();

            if (vrActive && !manualTrackingOverride) {
                console.log('[Electron] VR mode detected. Tracking disabled by default.');
                const notification = new Notification({
                    title: 'WebCamTracker4Resonite',
                    body: 'Resonite detected in VR mode. Tracking disabled. Enable manually from tray if needed.',
                    icon: path.join(__dirname, 'build', 'icon.png')
                });
                notification.show();
            } else {
                // Start tracking automatically
                await startTracking();
                const notification = new Notification({
                    title: 'WebCamTracker4Resonite',
                    body: 'Resonite detected. Tracking started in background.',
                    icon: path.join(__dirname, 'build', 'icon.png')
                });
                notification.show();
            }
        } else if (!running && lastResoniteState) {
            // Resonite just stopped
            console.log('[Electron] Resonite stopped.');
            lastResoniteState = false;
            stopTracking();
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

function updateTrayMenu() {
    if (!tray) return;

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Window',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    manuallyOpened = true;
                    startServer();
                    createWindow(true);
                }
            }
        },
        {
            type: 'separator'
        },
        {
            label: trackingEnabled ? 'Disable Tracking' : 'Enable Tracking',
            enabled: lastResoniteState,  // Only enabled when Resonite is running
            click: async () => {
                if (trackingEnabled) {
                    stopTracking();
                } else {
                    manualTrackingOverride = true;  // User manually enabled despite VR
                    await startTracking();
                }
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: () => {
                console.log('[Electron] Quit button clicked');
                isQuitting = true;

                // Send OSC reset values before quitting
                sendOSCReset();

                stopResoniteMonitor();

                if (serverProcess) {
                    killServerProcess();
                }

                if (mainWindow) {
                    mainWindow.destroy();
                    mainWindow = null;
                }

                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
}

function createTray() {
    try {
        const { nativeImage } = require('electron');
        const trackingIconPath = path.join(__dirname, 'build', 'tracking.png');
        const nonTrackingIconPath = path.join(__dirname, 'build', 'non-tracking.png');
        const fs = require('fs');

        let icon;
        // Default to non-tracking icon
        if (fs.existsSync(nonTrackingIconPath)) {
            icon = nativeImage.createFromPath(nonTrackingIconPath);
        } else {
            // Fallback to empty if missing
            icon = nativeImage.createEmpty();
        }

        tray = new Tray(icon);
        tray.setToolTip('WebCamTracker4Resonite - Waiting for Resonite...');

        updateTrayMenu();

        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            } else {
                manuallyOpened = true;
                startServer();
                createWindow(true);
            }
        });
    } catch (err) {
        console.error('[Electron] Failed to create tray:', err);
    }
}

function createWindow(showWindow = true) {
    if (mainWindow) {
        if (showWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
        return;
    }

    const iconPath = path.join(__dirname, 'build', 'icon.png');

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        icon: iconPath,
        show: false,  // Don't show immediately
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
        },
        autoHideMenuBar: true,
    });

    // Show window and wait for tracking to start before hiding
    mainWindow.once('ready-to-show', () => {
        if (showWindow) {
            mainWindow.show();
        } else {
            // Show window for background tracking initialization
            console.log('[Electron] Showing window to initialize tracking...');
            mainWindow.show();
            // Window will be hidden automatically when 'tracking-started' event is received
        }
    });

    mainWindow.on('close', async (event) => {
        // When quitting, allow window to close
        if (isQuitting) {
            return;
        }
        // Prevent window from closing
        event.preventDefault();

        // Check if Resonite is running
        const resoniteRunning = await isResoniteRunning();

        if (!resoniteRunning) {
            // Resonite is not running - stop tracking and destroy window to release camera
            console.log('[Electron] Window closed while Resonite is not running. Stopping tracker and releasing camera...');
            if (serverProcess) {
                killServerProcess();
            }
            if (tray) {
                tray.setToolTip('WebCamTracker4Resonite - Waiting for Resonite...');
            }
            // Destroy window to release camera resources
            mainWindow.destroy();
        } else {
            // Resonite is running - just hide the window, keep tracking
            mainWindow.hide();
        }
    });

    mainWindow.on('hide', () => {
        mainWindow.webContents.send('window-visibility-change', false);
    });

    mainWindow.on('show', () => {
        mainWindow.webContents.send('window-visibility-change', true);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        manuallyOpened = false;
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
        // In production, start server.mjs from unpacked directory if available
        let serverPath = path.join(__dirname, 'server.mjs');
        if (serverPath.includes('app.asar')) {
            const unpackedPath = serverPath.replace('app.asar', 'app.asar.unpacked');
            if (fs.existsSync(unpackedPath)) {
                serverPath = unpackedPath;
            }
        }
        console.log('[Electron] Starting server at:', serverPath);

        serverProcess = spawn(process.execPath, [serverPath], {
            stdio: ['ignore', 'pipe', 'pipe'],  // stdin: ignore, stdout: pipe, stderr: pipe
            shell: false,
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
        });

        serverProcess.stdout.on('data', (data) => {
            console.log('[Server][stdout]', data.toString().trim());
        });

        serverProcess.stderr.on('data', (data) => {
            console.error('[Server][stderr]', data.toString().trim());
        });

        serverProcess.on('error', (err) => {
            console.error('[Electron] Server error:', err);
        });

        serverProcess.on('exit', (code) => {
            console.log(`[Electron] Server exited with code ${code}`);
        });
    } else {
        console.log('[Electron] Development mode - server should be started manually (npm run dev)');
    }
}

app.whenReady().then(async () => {
    try {
        await autoLauncher.enable();
        console.log('[Electron] Auto-launch enabled');
    } catch (err) {
        console.error('[Electron] Failed to enable auto-launch:', err);
    }

    console.log('[Electron] Environment:', process.env.NODE_ENV || 'production');

    createTray();

    const resoniteRunning = await isResoniteRunning();
    lastResoniteState = resoniteRunning;

    if (resoniteRunning) {
        console.log('[Electron] Resonite is running at startup.');

        // Check if VR runtime is active
        const vrActive = await isVRRuntimeActive();

        if (vrActive) {
            console.log('[Electron] VR mode detected at startup. Tracking disabled by default.');
            const notification = new Notification({
                title: 'WebCamTracker4Resonite',
                body: 'Resonite detected in VR mode. Tracking disabled. Enable manually from tray if needed.',
                icon: path.join(__dirname, 'build', 'icon.png')
            });
            notification.show();
        } else {
            await startTracking();
            const notification = new Notification({
                title: 'WebCamTracker4Resonite',
                body: 'Resonite detected. Tracking started in background.',
                icon: path.join(__dirname, 'build', 'icon.png')
            });
            notification.show();
        }
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

app.on('will-quit', () => {
    console.log('[Electron] App is quitting...');

    // Send OSC reset values before app quits
    sendOSCReset();

    stopResoniteMonitor();

    if (serverProcess) {
        killServerProcess();
    }

    if (logStream) {
        logStream.end();
        logStream = null;
    }
});

ipcMain.on('osc-send', (event, { path, value }) => {
    const oscPath = path.startsWith('/') ? path : `/${path}`;
    oscClient.send(oscPath, value, (err) => {
        if (err) console.error('[Electron] OSC Error:', err);
    });
});

// Receive logs from renderer process
ipcMain.on('renderer-log', (event, { level, args }) => {
    const prefix = '[Renderer]';
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');

    switch (level) {
        case 'error':
            console.error(prefix, message);
            break;
        case 'warn':
            console.warn(prefix, message);
            break;
        case 'info':
        case 'log':
        default:
            console.log(prefix, message);
            break;
    }
});

// Receive tracking started notification from renderer
ipcMain.on('tracking-started', () => {
    // Hide window if it was auto-opened for background tracking
    if (mainWindow && !manuallyOpened) {
        console.log('[Electron] Tracking confirmed - hiding window for background operation');
        mainWindow.hide();
    }
});
