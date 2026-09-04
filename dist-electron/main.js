import { BrowserWindow as e, Menu as t, app as n, dialog as r, ipcMain as i, shell as a } from "electron";
import o from "path";
import s from "fs";
import { fileURLToPath as c } from "url";
var l = o.dirname(c(import.meta.url)), u = null;
function d(e, t) {
	let n = e.replace(/^v/, "").split(".").map((e) => parseInt(e, 10) || 0), r = t.replace(/^v/, "").split(".").map((e) => parseInt(e, 10) || 0);
	for (let e = 0; e < Math.max(n.length, r.length); e++) {
		let t = n[e] || 0, i = r[e] || 0;
		if (i > t) return !0;
		if (i < t) return !1;
	}
	return !1;
}
function f(e = []) {
	if (process.platform === "win32") {
		let t = e.find((e) => e.name.toLowerCase().endsWith(".exe"));
		return t ? {
			name: t.name,
			url: t.browser_download_url
		} : {
			name: "ProCase-Windows-Setup.exe",
			url: "https://github.com/ce2727/CasingAutomation/releases/latest/download/ProCase-Windows-Setup.exe"
		};
	}
	let t = process.arch === "arm64", n = t ? "arm64.dmg" : "x64.dmg", r = e.find((e) => e.name.toLowerCase().includes(n)) || e.find((e) => e.name.toLowerCase().endsWith(".dmg"));
	return r ? {
		name: r.name,
		url: r.browser_download_url
	} : {
		name: t ? "ProCase-macOS-arm64.dmg" : "ProCase-macOS-x64.dmg",
		url: `https://github.com/ce2727/CasingAutomation/releases/latest/download/ProCase-macOS-${t ? "arm64" : "x64"}.dmg`
	};
}
async function p(e = !1) {
	if (process.env.VITE_DEV_SERVER_URL || !n.isPackaged) {
		e && u && r.showMessageBox(u, {
			type: "info",
			title: "Check for Updates",
			message: "Running in development mode",
			detail: "Auto-update is only active when running a packaged application.",
			buttons: ["OK"]
		});
		return;
	}
	try {
		let t = n.getVersion(), i = await fetch("https://api.github.com/repos/ce2727/CasingAutomation/releases/latest", { headers: { "User-Agent": "ProCase-Desktop-App" } });
		if (!i.ok) {
			e && u && r.showMessageBox(u, {
				type: "warning",
				title: "Update Check Failed",
				message: `Unable to check for updates (Status ${i.status}).`,
				detail: i.status === 403 ? "GitHub API rate limit reached. Please try again in a few minutes or check GitHub releases directly." : "Could not fetch release information from GitHub.",
				buttons: ["OK"]
			});
			return;
		}
		let c = await i.json(), l = (c.tag_name || "").replace(/^v/, "").trim();
		if (!l || !d(t, l)) {
			e && u && r.showMessageBox(u, {
				type: "info",
				title: "You're Up to Date",
				message: `ProCase v${t} is the latest version.`,
				detail: "There are no newer updates available at this time.",
				buttons: ["OK"]
			});
			return;
		}
		if (l && d(t, l) && u) {
			let e = f(c.assets), i = process.platform === "win32";
			if ((await r.showMessageBox(u, {
				type: "info",
				title: "Update Available",
				message: `A new version of ProCase is available: v${l}`,
				detail: `You are currently running v${t}.\n\nWould you like to download and install the update now?`,
				buttons: ["Update Now", "Later"],
				defaultId: 0,
				cancelId: 1
			})).response !== 0) return;
			r.showMessageBox(u, {
				type: "info",
				title: "Downloading Update",
				message: `Downloading ProCase v${l}...`,
				detail: i ? "The installer is downloading in the background and will launch automatically when ready." : "The disk image is downloading and will open automatically in Finder when ready.",
				buttons: ["OK"]
			});
			try {
				let t = o.join(n.getPath("temp"), e.name), c = await fetch(e.url, { headers: { "User-Agent": "ProCase-Desktop-App" } });
				if (!c.ok || !c.body) throw Error(`Download failed with status ${c.status}`);
				let d = c.body.getReader(), f = s.createWriteStream(t);
				for (;;) {
					let { done: e, value: t } = await d.read();
					if (e) break;
					t && f.write(Buffer.from(t));
				}
				await new Promise((e, t) => {
					f.end((n) => {
						n ? t(n) : e(!0);
					});
				}), i ? (await a.openPath(t), setTimeout(() => {
					n.quit();
				}, 1500)) : (await a.openPath(t), u && r.showMessageBox(u, {
					type: "info",
					title: "Update Ready",
					message: `ProCase v${l} downloaded!`,
					detail: "The installer disk image has been opened. Drag ProCase to Applications to complete the update.",
					buttons: ["OK"]
				}));
			} catch (t) {
				console.error("Download update error:", t), u && (await r.showMessageBox(u, {
					type: "error",
					title: "Download Failed",
					message: "Could not download the update automatically.",
					detail: "Would you like to open the download page in your browser instead?",
					buttons: ["Open Browser", "Cancel"],
					defaultId: 0,
					cancelId: 1
				})).response === 0 && a.openExternal(e.url || c.html_url || "https://github.com/ce2727/CasingAutomation/releases/latest");
			}
		}
	} catch (e) {
		console.warn("Update check error:", e);
	}
}
function m() {
	let t = !!process.env.VITE_DEV_SERVER_URL;
	if (process.platform === "darwin" && n.dock) try {
		let e = t ? o.join(process.cwd(), "public/desktop-icon.png") : o.join(l, "../dist/desktop-icon.png");
		n.dock.setIcon(e);
	} catch {}
	if (u = new e({
		width: 1200,
		height: 800,
		title: "ProCase",
		show: !0,
		webPreferences: {
			nodeIntegration: !0,
			contextIsolation: !1
		}
	}), u.once("ready-to-show", () => {
		u?.show(), u?.focus();
	}), u.on("closed", () => {
		u = null;
	}), process.env.VITE_DEV_SERVER_URL) u.loadURL(process.env.VITE_DEV_SERVER_URL);
	else {
		let e = o.join(l, "../dist/index.html");
		u.loadFile(e).catch((e) => {
			console.error("Failed to load index.html:", e), r.showErrorBox("Launch Error", `Could not load app interface: ${e.message}`);
		});
	}
}
function h() {
	let e = process.platform === "darwin", r = [
		...e ? [{
			label: n.name,
			submenu: [
				{ role: "about" },
				{
					label: "Check for Updates...",
					click: () => p(!0)
				},
				{ type: "separator" },
				{ role: "services" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit" }
			]
		}] : [],
		{
			label: "File",
			submenu: [e ? { role: "close" } : { role: "quit" }]
		},
		{
			label: "Edit",
			submenu: [
				{ role: "undo" },
				{ role: "redo" },
				{ type: "separator" },
				{ role: "cut" },
				{ role: "copy" },
				{ role: "paste" },
				{ role: "selectAll" }
			]
		},
		{
			label: "View",
			submenu: [
				{ role: "reload" },
				{ role: "forceReload" },
				{ type: "separator" },
				{ role: "togglefullscreen" }
			]
		},
		{
			label: "Window",
			submenu: [
				{ role: "minimize" },
				{ role: "zoom" },
				...e ? [
					{ type: "separator" },
					{ role: "front" },
					{ type: "separator" },
					{ role: "window" }
				] : [{ role: "close" }]
			]
		},
		{
			role: "help",
			submenu: [
				...e ? [] : [{
					label: "Check for Updates...",
					click: () => p(!0)
				}, { type: "separator" }],
				{
					label: "ProCase GitHub Repository",
					click: async () => {
						await a.openExternal("https://github.com/ce2727/CasingAutomation");
					}
				},
				{
					label: "View Latest Releases",
					click: async () => {
						await a.openExternal("https://github.com/ce2727/CasingAutomation/releases/latest");
					}
				}
			]
		}
	], i = t.buildFromTemplate(r);
	t.setApplicationMenu(i);
}
n.whenReady().then(() => {
	h(), i.handle("check-for-updates", () => p(!0)), m(), setTimeout(() => p(!1), 3e3);
}), n.on("activate", () => {
	e.getAllWindows().length === 0 && m();
}), n.on("window-all-closed", () => {
	process.platform !== "darwin" && n.quit();
});
