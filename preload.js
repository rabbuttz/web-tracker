const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    oscSend: (path, value) => ipcRenderer.send('osc-send', { path, value }),
    onWindowVisibilityChange: (callback) => ipcRenderer.on('window-visibility-change', (event, isVisible) => callback(isVisible)),
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
