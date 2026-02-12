# LaTeX Studio — Local LaTeX-to-PDF App

A fully local, offline LaTeX editor with live PDF preview, syntax highlighting, auto-detection of missing packages, and support for Bengali, math, chemistry, physics, and more.

![LaTeX Studio](https://img.shields.io/badge/LaTeX-Studio-purple)

---

## Features

- **Smart Code Analysis** — Detects missing `\documentclass`, `\begin{document}`, `\end{document}`, and missing packages before compilation
- **Auto-fix Suggestions** — Prompts you to add missing packages with one click (or fix all at once)
- **70+ Package Detections** — Recognizes commands from amsmath, physics, mhchem, chemfig, tikz, circuitikz, siunitx, booktabs, hyperref, and many more
- **Three Compile Engines** — pdfLaTeX, XeLaTeX, LuaLaTeX (XeLaTeX/LuaLaTeX needed for Bengali/Unicode)
- **Built-in Templates** — Blank, Mathematics, Chemistry, Physics, Bengali (বাংলা), Formal Report
- **Syntax Highlighting** — Commands, braces, math delimiters, comments, brackets
- **PDF Preview & Download** — Inline preview with download button
- **Keyboard Shortcut** — Ctrl+Enter to compile
- **Fully Local** — No data leaves your machine

---

## Prerequisites

### 1. Node.js (v16+)
Download from [nodejs.org](https://nodejs.org/)

### 2. TeX Distribution
You need a full LaTeX distribution installed:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y texlive-full
```

**For a lighter install (covers most use cases):**
```bash
sudo apt install -y texlive-base texlive-latex-extra texlive-science \
  texlive-fonts-extra texlive-lang-other texlive-xetex texlive-luatex \
  texlive-fonts-recommended texlive-pictures
```

**macOS (via Homebrew):**
```bash
brew install --cask mactex
```

**Windows:**
Download and install [MiKTeX](https://miktex.org/) or [TeX Live](https://tug.org/texlive/)

### 3. Bengali / Indic Language Support
For Bengali documents, you need XeLaTeX or LuaLaTeX plus:
```bash
# Ubuntu/Debian
sudo apt install -y fonts-noto-bengali texlive-lang-other

# Or install Noto Serif Bengali font manually from:
# https://fonts.google.com/noto/specimen/Noto+Serif+Bengali
```

---

## Quick Start

### 1. Start the backend server
```bash
node server.js
```
You should see:
```
╔══════════════════════════════════════════════════╗
║           LaTeX Studio - Local Server            ║
║   Server running on http://localhost:2345        ║
╚══════════════════════════════════════════════════╝
  ✓ pdflatex found
  ✓ xelatex found
  ✓ lualatex found
```

### 2. Open the frontend
The `latex-to-pdf-app.jsx` is a **React component**. You can run it in several ways:

#### Option A: Use with Vite (recommended)
```bash
npm create vite@latest latex-studio -- --template react
cd latex-studio
# Copy latex-to-pdf-app.jsx into src/App.jsx (replace contents)
cp /path/to/latex-to-pdf-app.jsx src/App.jsx
npm install
npm run dev
```

#### Option B: Open in Claude.ai
Just upload the `.jsx` file as an artifact — it will render directly in the Claude interface, and compile requests will be sent to your local server on port 2345.

---

## Usage

1. **Write LaTeX** in the editor (or pick a template)
2. **Press Compile** (or Ctrl+Enter)
3. If missing packages/structure are detected, you'll see suggestions:
   - Click **"Fix All & Continue"** to auto-add everything
   - Click individual fix buttons for selective fixes
   - Click **"Compile Anyway"** to skip fixes
4. **View PDF** in the preview pane
5. **Download** the PDF with the download button

### Engine Selection
- **pdfLaTeX** — Fast, great for English + math + science
- **XeLaTeX** — Required for Bengali/Unicode fonts (uses fontspec)
- **LuaLaTeX** — Alternative Unicode engine, good for complex scripts

> **Tip:** When using the Bengali template, switch to XeLaTeX or LuaLaTeX!

---

## Supported Subjects & Packages

| Subject | Key Packages | Template |
|---------|-------------|----------|
| Mathematics | amsmath, amssymb, amsthm, physics, siunitx | ✅ |
| Chemistry | mhchem, chemfig | ✅ |
| Physics | physics, tikz, circuitikz, pgfplots, siunitx | ✅ |
| Bengali (বাংলা) | fontspec, polyglossia, Noto Serif Bengali | ✅ |
| Reports | booktabs, fancyhdr, titlesec, hyperref | ✅ |
| Diagrams | tikz, pgfplots, circuitikz, forest | Auto-detected |
| Code Listings | listings, minted | Auto-detected |
| Algorithms | algorithm2e, algorithmicx | Auto-detected |

---

## API

### `POST /compile`
```json
{
  "code": "\\documentclass{article}...",
  "engine": "pdflatex"
}
```
Returns: `application/pdf` on success, `422` with error JSON on failure.

### `GET /health`
Returns available engines and server status.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "pdflatex not found" | Install texlive: `sudo apt install texlive-full` |
| Bengali text not rendering | Use XeLaTeX engine + install `fonts-noto-bengali` |
| Missing package error | The app should auto-detect it; if not, add `\usepackage{...}` manually |
| Compilation timeout | Complex TikZ/pgfplots may take long; simplify or wait |
| CORS error in browser | Make sure server.js is running on port 2345 |

---

## License
MIT — Use freely for personal and commercial projects.