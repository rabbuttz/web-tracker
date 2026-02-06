const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    oscSend: (path, value) => ipcRenderer.send('osc-send', { path, value }),
    onWindowVisibilityChange: (callback) => {
        const handler = (event, isVisible) => callback(isVisible);
        ipcRenderer.removeAllListeners('window-visibility-change');
        ipcRenderer.on('window-visibility-change', handler);
    },
    onAutoHideNotice: (callback) => {
        const handler = (event, payload) => callback(payload);
        ipcRenderer.removeAllListeners('auto-hide-notice');
        ipcRenderer.on('auto-hide-notice', handler);
    },
    log: (level, ...args) => ipcRenderer.send('renderer-log', { level, args }),
    notifyTrackingStarted: () => ipcRenderer.send('tracking-started')
});

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});
