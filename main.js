// main.js
const { app, BrowserWindow, BrowserView, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const clipboardDir = path.join(app.getPath('userData'), 'temp-clipboard');

const services = {
  gemini: { url: 'https://gemini.google.com/app', name: 'Gemini' },
  chatgpt: { url: 'https://chatgpt.com/', name: 'ChatGPT' },
  manus: { url: 'https://manus.im/app', name: 'Manus' },
  perplexity: { url: 'https://www.perplexity.ai/', name: 'Perplexity' },
  grok: { url: 'https://x.com/i/grok', name: 'Grok' },
  deepseek: { url: 'https://chat.deepseek.com/', name: 'DeepSeek' },
  claude: { url: 'https://claude.ai/new', name: 'Claude' } // 新增
};

let mainWindow;
// FIX: Changed 'const' to 'let' to allow re-initialization
let views = {};
let rightSidebarVisible = false;
let currentViewKey = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MultiMind',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    const contentBounds = mainWindow.getContentBounds();
    const sidebarWidth = 65;
    for (const [key, config] of Object.entries(services)) {
        const view = new BrowserView({ webPreferences: { partition: `persist:${key}`, nodeIntegration: false, contextIsolation: true } });
        mainWindow.addBrowserView(view);
        view.setBounds({ x: sidebarWidth, y: 0, width: contentBounds.width - sidebarWidth, height: contentBounds.height });
        view.setAutoResize({ width: true, height: true });
        view.webContents.loadURL(config.url);
        views[key] = view;

        view.webContents.on('did-start-loading', () => {
            if (key === currentViewKey) {
                mainWindow.webContents.send('set-loading-state', true);
            }
        });
        view.webContents.on('did-stop-loading', () => {
            if (key === currentViewKey) {
                mainWindow.webContents.send('set-loading-state', false);
            }
        });
    }
    showView('gemini');
  });

  mainWindow.on('resize', resizeBrowserView);

  // FIX: Added 'closed' event listener to clean up references
  mainWindow.on('closed', () => {
    // When the window is closed, its views are destroyed.
    // We must clear our references to them to prevent using them again.
    views = {};
    currentViewKey = null;
    mainWindow = null;
  });

  // 新增：Mac 上点击关闭按钮时隐藏窗口而不是退出
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function resizeBrowserView() {
    if (!mainWindow) return;
    const contentBounds = mainWindow.getContentBounds();
    const leftSidebarWidth = 65;
    const rightSidebarWidth = rightSidebarVisible ? 250 : 0;
    for (const key in views) {
        if (views.hasOwnProperty(key)) {
            views[key].setBounds({
                x: leftSidebarWidth, y: 0,
                width: contentBounds.width - leftSidebarWidth - rightSidebarWidth,
                height: contentBounds.height
            });
        }
    }
}

// --- IPC 通信 ---
ipcMain.on('show-view', (event, key) => {
  // FIX: Check if the view exists before showing
  if (views && views[key]) {
    showView(key);
  }
});

function showView(key) {
  if (!mainWindow) return;
  mainWindow.setBrowserView(views[key]);
  currentViewKey = key;
  resizeBrowserView();
}

ipcMain.on('reload-current-view', () => {
    if (currentViewKey && views[currentViewKey]) {
        views[currentViewKey].webContents.reload();
    }
});

ipcMain.on('toggle-right-sidebar', (event, isVisible) => {
    rightSidebarVisible = isVisible;
    resizeBrowserView();
});

ipcMain.handle('get-initial-clipboard', () => {
    if (!fs.existsSync(clipboardDir)) return [];
    return fs.readdirSync(clipboardDir).map(file => ({ name: file, path: path.join(clipboardDir, file) }));
});

ipcMain.handle('save-dropped-item', async (event, { type, content, name }) => {
    if (type === 'text') {
        const sanitizedContent = content.replace(/[\\/:"*?<>|]/g, '_');
        const prefix = sanitizedContent.substring(0, 5);
        const finalName = `${prefix}${content.length > 5 ? '...' : ''}.txt`;
        const filePath = path.join(clipboardDir, finalName);
        fs.writeFileSync(filePath, content);
    } else if (type === 'file') {
        const filePath = path.join(clipboardDir, name);
        fs.copyFileSync(content, filePath);
    }
    if (mainWindow) {
        mainWindow.webContents.send('clipboard-updated');
    }
});

ipcMain.on('delete-clipboard-item', (event, filePath) => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (mainWindow) {
        mainWindow.webContents.send('clipboard-updated');
    }
});

ipcMain.on('start-drag', (event, filePath) => {
    event.sender.startDrag({ file: filePath, icon: path.join(__dirname, 'icons/file-icon.png') });
});

ipcMain.on('copy-text-from-file', (event, filePath) => {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        clipboard.writeText(content);
        if (mainWindow) {
            mainWindow.webContents.send('show-notification', '文本已复制!');
        }
    }
});

ipcMain.on('open-item', (event, filePath) => {
    shell.openPath(filePath);
});

// --- App 生命周期 ---
app.whenReady().then(() => {
    if (!fs.existsSync(clipboardDir)) fs.mkdirSync(clipboardDir, { recursive: true });
    createWindow();
    app.on('activate', () => {
        // FIX: Check if mainWindow is null before creating a new window
        if (mainWindow) {
            mainWindow.show();
        } else {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
