import { BrowserWindow, app } from "electron";
import path from "path";
import { fileURLToPath } from "url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var mainWindow = null;
function createWindow() {
	const iconPath = !!process.env.VITE_DEV_SERVER_URL ? path.join(process.cwd(), "public/desktop-icon.png") : path.join(process.cwd(), "dist/desktop-icon.png");
	if (process.platform === "darwin" && app.dock) app.dock.setIcon(iconPath);
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		title: "ProCase",
		icon: iconPath,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
