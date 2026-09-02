import { app, BrowserWindow, dialog, shell, Menu, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
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

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

function getTargetAsset(assets: ReleaseAsset[] = []): { name: string; url: string } {
  if (process.platform === 'win32') {
    const exe = assets.find(a => a.name.toLowerCase().endsWith('.exe'));
    if (exe) return { name: exe.name, url: exe.browser_download_url };
    return {
      name: 'ProCase-Windows-Setup.exe',
      url: 'https://github.com/ce2727/CasingAutomation/releases/latest/download/ProCase-Windows-Setup.exe',
    };
  }

  // macOS
  const isArm = process.arch === 'arm64';
  const targetPattern = isArm ? 'arm64.dmg' : 'x64.dmg';
  const dmg = assets.find(a => a.name.toLowerCase().includes(targetPattern)) || assets.find(a => a.name.toLowerCase().endsWith('.dmg'));
  if (dmg) return { name: dmg.name, url: dmg.browser_download_url };
  return {
    name: isArm ? 'ProCase-macOS-arm64.dmg' : 'ProCase-macOS-x64.dmg',
    url: `https://github.com/ce2727/CasingAutomation/releases/latest/download/ProCase-macOS-${isArm ? 'arm64' : 'x64'}.dmg`,
  };
}

async function checkForUpdates(manual = false) {
  if (process.env.VITE_DEV_SERVER_URL || !app.isPackaged) {
    if (manual && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Check for Updates',
        message: 'Running in development mode',
        detail: 'Auto-update is only active when running a packaged application.',
        buttons: ['OK'],
      });
    }
    return;
  }

  try {
    const currentVersion = app.getVersion();
    const response = await fetch('https://api.github.com/repos/ce2727/CasingAutomation/releases/latest', {
      headers: { 'User-Agent': 'ProCase-Desktop-App' },
    });

    if (!response.ok) {
      if (manual && mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Update Check Failed',
          message: `Unable to check for updates (Status ${response.status}).`,
          detail: response.status === 403
            ? 'GitHub API rate limit reached. Please try again in a few minutes or check GitHub releases directly.'
            : 'Could not fetch release information from GitHub.',
          buttons: ['OK'],
        });
      }
      return;
    }

    const data = (await response.json()) as {
      tag_name?: string;
      html_url?: string;
      assets?: ReleaseAsset[];
    };
    const latestTag = data.tag_name || '';
    const latestVersion = latestTag.replace(/^v/, '').trim();

    if (!latestVersion || !isNewerVersion(currentVersion, latestVersion)) {
      if (manual && mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: "You're Up to Date",
          message: `ProCase v${currentVersion} is the latest version.`,
          detail: 'There are no newer updates available at this time.',
          buttons: ['OK'],
        });
      }
      return;
    }

    if (latestVersion && isNewerVersion(currentVersion, latestVersion) && mainWindow) {
      const targetAsset = getTargetAsset(data.assets);
      const isWindows = process.platform === 'win32';

      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version of ProCase is available: v${latestVersion}`,
        detail: `You are currently running v${currentVersion}.\n\nWould you like to download and install the update now?`,
        buttons: ['Update Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response !== 0) return;

      // Notify that background download is starting
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Downloading Update',
        message: `Downloading ProCase v${latestVersion}...`,
        detail: isWindows
          ? 'The installer is downloading in the background and will launch automatically when ready.'
          : 'The disk image is downloading and will open automatically in Finder when ready.',
        buttons: ['OK'],
      });

      try {
        const tempFilePath = path.join(app.getPath('temp'), targetAsset.name);
        const downloadRes = await fetch(targetAsset.url, {
          headers: { 'User-Agent': 'ProCase-Desktop-App' },
        });

        if (!downloadRes.ok || !downloadRes.body) {
          throw new Error(`Download failed with status ${downloadRes.status}`);
        }

        const reader = downloadRes.body.getReader();
        const fileStream = fs.createWriteStream(tempFilePath);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) fileStream.write(Buffer.from(value));
        }

        await new Promise((resolve, reject) => {
          fileStream.end((err?: Error | null) => {
            if (err) reject(err);
            else resolve(true);
          });
        });

        // Launch installer or open disk image
        if (isWindows) {
          await shell.openPath(tempFilePath);
          setTimeout(() => {
            app.quit();
          }, 1500);
        } else {
          await shell.openPath(tempFilePath);
          if (mainWindow) {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Update Ready',
              message: `ProCase v${latestVersion} downloaded!`,
              detail: 'The installer disk image has been opened. Drag ProCase to Applications to complete the update.',
              buttons: ['OK'],
            });
          }
        }
      } catch (downloadErr) {
        console.error('Download update error:', downloadErr);
        if (mainWindow) {
          const fallback = await dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Download Failed',
            message: 'Could not download the update automatically.',
            detail: 'Would you like to open the download page in your browser instead?',
            buttons: ['Open Browser', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          });

          if (fallback.response === 0) {
            shell.openExternal(targetAsset.url || data.html_url || 'https://github.com/ce2727/CasingAutomation/releases/latest');
          }
        }
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

function setupAppMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              {
                label: 'Check for Updates...',
                click: () => checkForUpdates(true),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      role: 'help' as const,
      submenu: [
        ...(!isMac
          ? [
              {
                label: 'Check for Updates...',
                click: () => checkForUpdates(true),
              },
              { type: 'separator' as const },
            ]
          : []),
        {
          label: 'ProCase GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/ce2727/CasingAutomation');
          },
        },
        {
          label: 'View Latest Releases',
          click: async () => {
            await shell.openExternal('https://github.com/ce2727/CasingAutomation/releases/latest');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  setupAppMenu();
  ipcMain.handle('check-for-updates', () => checkForUpdates(true));
  createWindow();
  setTimeout(() => checkForUpdates(false), 3000);
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
