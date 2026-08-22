# LaTeX Studio (TeXForge)

A modern, offline-first LaTeX & HTML-to-PDF desktop studio and web editor with real-time PDF rendering, SyncTeX jump-to-source navigation, auto-detection of missing packages, automated MiKTeX package installation, and full Unicode/Bengali language support.

---

## Key Features

- 🖥️ **Zero-Setup Desktop App** — Standalone Windows application (Portable & Installer) with an embedded compilation server and UI. No terminal commands required.
- ⚡ **Three LaTeX Engines** — `pdfLaTeX`, `XeLaTeX`, and `LuaLaTeX` (XeLaTeX / LuaLaTeX for Unicode and Bengali support).
- 📦 **Automated MiKTeX Package Installation** — Automatically configures and triggers on-the-fly MiKTeX package downloads (`-enable-installer`) during compilation.
- 🔍 **SyncTeX Two-Way Jump** — Click on code to jump to the corresponding PDF location, or click on the preview to jump to source code.
- 🖨️ **HTML-to-PDF Engine** — Built-in Chromium PDF rendering engine for generating PDFs from HTML/CSS.
- 🛠️ **Smart Code Analysis & Auto-Fix** — Detects missing packages, unclosed environments, and document structure issues with one-click fixes.
- 🎨 **Built-in Templates** — Blank, Mathematics, Chemistry, Physics, Bengali (বাংলা), Formal Report, and Cheat Sheet.
- ⌨️ **Productivity Shortcuts** — `Ctrl + Enter` to compile, `Ctrl + S` to save, `Ctrl + Shift + I` for Developer Tools.
- 🔒 **100% Private & Local** — All compilation occurs strictly on your machine.

---

## Windows Desktop Application

You can run LaTeX Studio directly as a native Windows desktop application:

- **Portable Executable:** Run `release/LaTeX-Studio-Portable-1.0.0.exe` directly from any folder or USB drive without installation.
- **Setup Installer:** Run `release/LaTeX Studio Setup 1.0.0.exe` to install to Windows with Desktop and Start Menu shortcuts.

### Building Windows Binaries

To build the standalone Windows executables yourself:

```bash
# 1. Install dependencies
npm install
npm --prefix latex-studio install

# 2. Build UI and package Windows installer & portable binaries
npm run dist:win
```

The output executables will be generated in the `release/` folder:
- `release/LaTeX-Studio-Portable-1.0.0.exe`
- `release/LaTeX Studio Setup 1.0.0.exe`

---

## Prerequisites (LaTeX Distribution)

To compile LaTeX documents locally, ensure you have a TeX distribution installed:

### Windows (Recommended)
- Install **[MiKTeX](https://miktex.org/)** or **[TeX Live](https://tug.org/texlive/)**.
- LaTeX Studio automatically detects MiKTeX and enables automatic missing-package downloads during compilation.

### Linux (Ubuntu / Debian)
```bash
sudo apt update
sudo apt install -y texlive-full
```

### macOS
```bash
brew install --cask mactex
```

### Bengali / Indic Language Support
For Bengali and Indic language documents, use the **XeLaTeX** engine:
- **Ubuntu/Debian:** `sudo apt install -y fonts-noto-bengali texlive-lang-other`
- **Windows/macOS:** Install the [Noto Serif Bengali](https://fonts.google.com/noto/specimen/Noto+Serif+Bengali) or Kalpurush font. Local project fonts placed in the `fonts/` directory are also automatically bundled.

---

## Project Structure & Development

```
latex-studio/
├── electron/              # Electron desktop wrapper (main.cjs, preload.cjs)
├── fonts/                 # Local font assets copied into compilation passes
├── latex-studio/          # Vite + React frontend web application
│   ├── src/               # React components (App.jsx, UI tools, templates)
│   └── dist/              # Production web build output
├── release/               # Packaged Windows desktop executables
├── server.js              # Local Node.js compilation & static web server (port 2345)
└── package.json           # Root configuration & electron-builder packaging scripts
```

### Development Scripts

| Command | Action |
| :--- | :--- |
| `npm run app:start` | Builds the frontend and launches the native Electron desktop app in development mode |
| `npm run build:ui` | Compiles the Vite React frontend into `latex-studio/dist` |
| `npm run dist:win` | Builds the UI and packages Windows Portable and Setup executables into `release/` |
| `npm start` | Starts the standalone local backend server on `http://localhost:2345` |
| `npm --prefix latex-studio run dev` | Runs the Vite frontend development server with hot module reloading (HMR) |

---

## REST API Endpoints

The internal server (`http://localhost:2345`) provides the following endpoints:

### 1. `POST /compile`
Compiles LaTeX code or HTML to PDF.

**Request Body:**
```json
{
  "code": "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}",
  "engine": "pdflatex"
}
```

**Response:**
- `200 OK` with `Content-Type: application/pdf` on successful compilation.
- `422 Unprocessable Entity` with error JSON and compilation log on failure.

### 2. `GET /health`
Returns available LaTeX engines, MiKTeX status, and server state.

**Response:**
```json
{
  "status": "ok",
  "engines": {
    "pdflatex": true,
    "xelatex": true,
    "lualatex": true
  },
  "isMiKTeX": true,
  "autoInstallPackages": true
}
```

---

## License

MIT — Free for personal, academic, and commercial use.