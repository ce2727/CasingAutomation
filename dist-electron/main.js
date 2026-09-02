import { BrowserWindow as e, app as t, dialog as n, shell as r } from "electron";
import i from "path";
import a from "fs";
import { fileURLToPath as o } from "url";
var s = i.dirname(o(import.meta.url)), c = null;
function l(e, t) {
	let n = e.replace(/^v/, "").split(".").map((e) => parseInt(e, 10) || 0), r = t.replace(/^v/, "").split(".").map((e) => parseInt(e, 10) || 0);
	for (let e = 0; e < Math.max(n.length, r.length); e++) {
		let t = n[e] || 0, i = r[e] || 0;
		if (i > t) return !0;
		if (i < t) return !1;
	}
	return !1;
}
function u(e = []) {
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
async function d() {
	if (!(process.env.VITE_DEV_SERVER_URL || !t.isPackaged)) try {
		let e = t.getVersion(), o = await fetch("https://api.github.com/repos/ce2727/CasingAutomation/releases/latest", { headers: { "User-Agent": "ProCase-Desktop-App" } });
		if (!o.ok) return;
		let s = await o.json(), d = (s.tag_name || "").replace(/^v/, "").trim();
		if (d && l(e, d) && c) {
			let o = u(s.assets), l = process.platform === "win32";
			if ((await n.showMessageBox(c, {
				type: "info",
				title: "Update Available",
				message: `A new version of ProCase is available: v${d}`,
				detail: `You are currently running v${e}.\n\nWould you like to download and install the update now?`,
				buttons: ["Update Now", "Later"],
				defaultId: 0,
				cancelId: 1
			})).response !== 0) return;
			n.showMessageBox(c, {
				type: "info",
				title: "Downloading Update",
				message: `Downloading ProCase v${d}...`,
				detail: l ? "The installer is downloading in the background and will launch automatically when ready." : "The disk image is downloading and will open automatically in Finder when ready.",
				buttons: ["OK"]
			});
			try {
				let e = i.join(t.getPath("temp"), o.name), s = await fetch(o.url, { headers: { "User-Agent": "ProCase-Desktop-App" } });
				if (!s.ok || !s.body) throw Error(`Download failed with status ${s.status}`);
				let u = s.body.getReader(), f = a.createWriteStream(e);
				for (;;) {
					let { done: e, value: t } = await u.read();
					if (e) break;
					t && f.write(Buffer.from(t));
				}
				await new Promise((e, t) => {
					f.end((n) => {
						n ? t(n) : e(!0);
					});
				}), l ? (await r.openPath(e), setTimeout(() => {
					t.quit();
				}, 1500)) : (await r.openPath(e), c && n.showMessageBox(c, {
					type: "info",
					title: "Update Ready",
					message: `ProCase v${d} downloaded!`,
					detail: "The installer disk image has been opened. Drag ProCase to Applications to complete the update.",
					buttons: ["OK"]
				}));
			} catch (e) {
				console.error("Download update error:", e), c && (await n.showMessageBox(c, {
					type: "error",
					title: "Download Failed",
					message: "Could not download the update automatically.",
					detail: "Would you like to open the download page in your browser instead?",
					buttons: ["Open Browser", "Cancel"],
					defaultId: 0,
					cancelId: 1
				})).response === 0 && r.openExternal(o.url || s.html_url || "https://github.com/ce2727/CasingAutomation/releases/latest");
			}
		}
	} catch (e) {
		console.warn("Update check error:", e);
	}
}
function f() {
	let r = !!process.env.VITE_DEV_SERVER_URL;
	if (process.platform === "darwin" && t.dock) try {
		let e = r ? i.join(process.cwd(), "public/desktop-icon.png") : i.join(s, "../dist/desktop-icon.png");
		t.dock.setIcon(e);
	} catch {}
	if (c = new e({
		width: 1200,
		height: 800,
		title: "ProCase",
		show: !0,
		webPreferences: {
			nodeIntegration: !0,
			contextIsolation: !1
		}
	}), c.once("ready-to-show", () => {
		c?.show(), c?.focus();
	}), c.on("closed", () => {
		c = null;
	}), process.env.VITE_DEV_SERVER_URL) c.loadURL(process.env.VITE_DEV_SERVER_URL);
	else {
		let e = i.join(s, "../dist/index.html");
		c.loadFile(e).catch((e) => {
			console.error("Failed to load index.html:", e), n.showErrorBox("Launch Error", `Could not load app interface: ${e.message}`);
		});
	}
}
t.whenReady().then(() => {
	f(), setTimeout(d, 3e3);
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && f();
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
