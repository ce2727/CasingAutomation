import { BrowserWindow as e, app as t } from "electron";
import n from "path";
import { fileURLToPath as r } from "url";
var i = n.dirname(r(import.meta.url)), a = null;
function o() {
	let r = process.env.VITE_DEV_SERVER_URL ? n.join(process.cwd(), "public/desktop-icon.png") : n.join(process.cwd(), "dist/desktop-icon.png");
	process.platform === "darwin" && t.dock && t.dock.setIcon(r), a = new e({
		width: 1200,
		height: 800,
		title: "ProCase",
		icon: r,
		webPreferences: {
			nodeIntegration: !0,
			contextIsolation: !1
		}
	}), process.env.VITE_DEV_SERVER_URL ? a.loadURL(process.env.VITE_DEV_SERVER_URL) : a.loadFile(n.join(i, "../dist/index.html"));
}
t.whenReady().then(o), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
