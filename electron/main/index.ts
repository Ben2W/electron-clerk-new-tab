import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  protocol,
  net,
  session,
} from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import url from "node:url";
import { update } from "./update";
import setCookie from "set-cookie-parser";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
const preload = path.join(__dirname, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");

async function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });

  const filter = {
    urls: ["https://*/*", "http://*/*"],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details, callback) => {
      details.requestHeaders["Origin"] = "https://www.croak.app";
      details.requestHeaders["Referer"] = "https://www.croak.app";

      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );
  session.defaultSession.webRequest.onHeadersReceived(
    filter,
    (details, callback) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      //set the domain back to our custom protocol so cors works
      details.responseHeaders["access-control-allow-origin"] =
        "http://localhost:5173";

      if (details?.responseHeaders?.["set-cookie"]) {
        if (details.url.includes("clerk.croak.app")) {
          const cookies = setCookie.parse(
            details.responseHeaders["set-cookie"]
          );

          cookies.forEach((cookie) => {
            let sameSite: "unspecified" | "no_restriction" | "lax" | "strict" =
              "no_restriction";
            if (cookie.sameSite === "Lax") {
              sameSite = "lax";
            } else if (cookie.sameSite === "Strict") {
              sameSite = "strict";
            }
            if (cookie.sameSite === "None") {
              sameSite = "unspecified";
            }

            const newCookie: Electron.CookiesSetDetails = {
              url: details.url,
              domain: cookie.domain,
              name: cookie.name,
              value: cookie.value,
              path: cookie.path,
              expirationDate: cookie.expires
                ? Math.floor(cookie.expires.getTime() / 1000)
                : undefined,
              httpOnly: cookie.httpOnly,
              secure: cookie.secure,
              sameSite: sameSite,
            };
            session.defaultSession.cookies
              .set(newCookie)
              .then(() => console.log("Cookies set successfully"))
              .catch((error) =>
                console.error("Failed to set cookie:", error, cookie)
              );
          });

          // Remove the Set-Cookie header from the response
          delete details.responseHeaders["set-cookie"];
        }
      }

      callback({ responseHeaders: details.responseHeaders });
    }
  );

  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Auto update
  update(win);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});
