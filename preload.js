// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showView: (key) => ipcRenderer.send('show-view', key),
  reloadCurrentView: () => ipcRenderer.send('reload-current-view'),
  toggleRightSidebar: (isVisible) => ipcRenderer.send('toggle-right-sidebar', isVisible),
  getInitialClipboard: () => ipcRenderer.invoke('get-initial-clipboard'),
  saveDroppedItem: (item) => ipcRenderer.invoke('save-dropped-item', item),
  deleteClipboardItem: (filePath) => ipcRenderer.send('delete-clipboard-item', filePath),
  startDrag: (filePath) => ipcRenderer.send('start-drag', filePath),
  openItem: (filePath) => ipcRenderer.send('open-item', filePath), // 用于非txt文件
  onClipboardUpdate: (callback) => ipcRenderer.on('clipboard-updated', callback),
  
  // 新增API
  setLoadingState: (callback) => ipcRenderer.on('set-loading-state', (e, ...args) => callback(...args)),
  copyTextFromFile: (filePath) => ipcRenderer.send('copy-text-from-file', filePath),
  onShowNotification: (callback) => ipcRenderer.on('show-notification', (e, ...args) => callback(...args)),
});
