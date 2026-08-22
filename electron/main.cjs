const { app, BrowserWindow, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let serverInstance = null;
const SERVER_PORT = 2345;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function startInternalServer() {
  return new Promise((resolve, reject) => {
    try {
      // In-process server loading works across packaged asar and development environments
      let serverModule;
      try {
        serverModule = require("../server.js");
      } catch (err1) {
        if (process.resourcesPath) {
          serverModule = require(path.join(process.resourcesPath, "server.js"));
        } else {
          throw err1;
        }
      }

      if (serverModule && typeof serverModule.startServer === "function") {
        serverInstance = serverModule.startServer(SERVER_PORT, () => {
          console.log(`[Electron] Internal server listening on ${SERVER_URL}`);
          resolve();
        });
      } else if (serverModule && serverModule.server) {
        serverInstance = serverModule.server;
        if (!serverInstance.listening) {
          serverInstance.listen(SERVER_PORT, "0.0.0.0", () => {
            console.log(`[Electron] Internal server listening on ${SERVER_URL}`);
            resolve();
          });
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    } catch (err) {
      console.error("[Electron] Failed to start internal server:", err);
      reject(err);
    }
  });
}

function createWindow() {
  let iconPath = path.join(__dirname, "..", "latex-studio", "public", "TeXForge.png");
  if (process.resourcesPath) {
    const candidate = path.join(process.resourcesPath, "latex-studio", "public", "TeXForge.png");
    if (fs.existsSync(candidate)) {
      iconPath = candidate;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "LaTeX Studio",
    icon: iconPath,
    backgroundColor: "#0d0e15",
    autoHideMenuBar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true
    }
  });

  // Create standard application menu
  const menuTemplate = [
    {
      label: "File",
      submenu: [
        { label: "Reload App", accelerator: "CmdOrCtrl+R", click: () => mainWindow.reload() },
        { label: "Force Reload", accelerator: "CmdOrCtrl+Shift+R", click: () => mainWindow.webContents.reloadIgnoringCache() },
        { type: "separator" },
        { label: "Exit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() }
      ]
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
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        { role: "togglefullscreen" },
        {
          label: "Toggle Developer Tools",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => mainWindow.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open in External Browser",
          click: () => shell.openExternal(SERVER_URL)
        },
        {
          label: "About LaTeX Studio",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About LaTeX Studio",
              message: "LaTeX Studio v1.0.0",
              detail: "Offline Desktop LaTeX & HTML-to-PDF Studio with automated MiKTeX compilation."
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // Open external links in user's default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error(`[Electron] Page failed to load (${errorCode}): ${errorDescription}`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(SERVER_URL);
      }
    }, 1000);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (serverInstance && typeof serverInstance.close === "function") {
    try {
      serverInstance.close();
    } catch (e) {
      console.error("[Electron] Error closing server:", e);
    }
    serverInstance = null;
  }
}

app.whenReady().then(async () => {
  try {
    await startInternalServer();
  } catch (err) {
    dialog.showErrorBox("Server Startup Error", "Failed to start local server:\n" + err.message);
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopServer();
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
