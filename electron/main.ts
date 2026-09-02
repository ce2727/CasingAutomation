import { app, BrowserWindow, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function isNewerVersion(current: string, latest: string): boolean {
  const cParts = current.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const lParts = latest.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const c = cParts[i] || 0;
    const l = lParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

async function checkForUpdates() {
  if (process.env.VITE_DEV_SERVER_URL || !app.isPackaged) {
    return;
  }

  try {
    const currentVersion = app.getVersion();
    const response = await fetch('https://api.github.com/repos/ce2727/CasingAutomation/releases/latest', {
      headers: { 'User-Agent': 'ProCase-Desktop-App' },
    });

    if (!response.ok) return;

    const data = (await response.json()) as { tag_name?: string; html_url?: string };
    const latestTag = data.tag_name || '';
    const latestVersion = latestTag.replace(/^v/, '').trim();

    if (latestVersion && isNewerVersion(currentVersion, latestVersion) && mainWindow) {
      const releaseUrl = data.html_url || 'https://github.com/ce2727/CasingAutomation/releases/latest';
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version of ProCase is available: v${latestVersion}`,
        detail: `You are currently running v${currentVersion}.\n\nWould you like to open GitHub to download the latest installer?`,
        buttons: ['Download Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        shell.openExternal(releaseUrl);
      }
    }
  } catch (err) {
    console.warn('Update check error:', err);
  }
}

function createWindow() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;

  if (process.platform === 'darwin' && app.dock) {
    try {
      const iconPath = isDev 
        ? path.join(process.cwd(), 'public/desktop-icon.png')
        : path.join(__dirname, '../dist/desktop-icon.png');
      app.dock.setIcon(iconPath);
    } catch {
      // In production, dock icon is already bundled by macOS
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "ProCase",
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
      dialog.showErrorBox('Launch Error', `Could not load app interface: ${err.message}`);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  setTimeout(checkForUpdates, 3000);
});

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
