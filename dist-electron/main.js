import { BrowserWindow as e, app as t, dialog as n, shell as r } from "electron";
import i from "path";
import { fileURLToPath as a } from "url";
var o = i.dirname(a(import.meta.url)), s = null;
function c(e, t) {
	let n = e.replace(/^v/, "").split(".").map((e) => parseInt(e, 10) || 0), r = t.replace(/^v/, "").split(".").map((e) => parseInt(e, 10) || 0);
	for (let e = 0; e < Math.max(n.length, r.length); e++) {
		let t = n[e] || 0, i = r[e] || 0;
		if (i > t) return !0;
		if (i < t) return !1;
	}
	return !1;
}
async function l() {
	if (!(process.env.VITE_DEV_SERVER_URL || !t.isPackaged)) try {
		let e = t.getVersion(), i = await fetch("https://api.github.com/repos/ce2727/CasingAutomation/releases/latest", { headers: { "User-Agent": "ProCase-Desktop-App" } });
		if (!i.ok) return;
		let a = await i.json(), o = (a.tag_name || "").replace(/^v/, "").trim();
		if (o && c(e, o) && s) {
			let t = a.html_url || "https://github.com/ce2727/CasingAutomation/releases/latest";
			(await n.showMessageBox(s, {
				type: "info",
				title: "Update Available",
				message: `A new version of ProCase is available: v${o}`,
				detail: `You are currently running v${e}.\n\nWould you like to open GitHub to download the latest installer?`,
				buttons: ["Download Update", "Later"],
				defaultId: 0,
				cancelId: 1
			})).response === 0 && r.openExternal(t);
		}
	} catch (e) {
		console.warn("Update check error:", e);
	}
}
function u() {
	let n = process.env.VITE_DEV_SERVER_URL ? i.join(process.cwd(), "public/desktop-icon.png") : i.join(process.cwd(), "dist/desktop-icon.png");
	process.platform === "darwin" && t.dock && t.dock.setIcon(n), s = new e({
		width: 1200,
		height: 800,
		title: "ProCase",
		icon: n,
		webPreferences: {
			nodeIntegration: !0,
			contextIsolation: !1
		}
	}), process.env.VITE_DEV_SERVER_URL ? s.loadURL(process.env.VITE_DEV_SERVER_URL) : s.loadFile(i.join(o, "../dist/index.html"));
}
t.whenReady().then(() => {
	u(), setTimeout(l, 3e3);
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
