const http = require("http");
const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const zlib = require("zlib");
const puppeteer = require("puppeteer"); // <-- new

function parseSyncTeX(synctexGzPath) {
  try {
    if (!fs.existsSync(synctexGzPath)) return null;
    const buffer = fs.readFileSync(synctexGzPath);
    const decompressed = zlib.gunzipSync(buffer).toString('utf-8');

    const lineToPdf = {};
    const pdfToLine = {};
    const lines = decompressed.split('\n');
    let currentPage = 1;

    for (let i = 0; i < lines.length; i++) {
      const row = lines[i];
      if (row.startsWith('Sheet:')) {
        currentPage = parseInt(row.substring(6).trim(), 10) || 1;
      }
      if (row.startsWith('g') || row.startsWith('x')) {
        const parts = row.substring(1).split(',');
        if (parts.length >= 4) {
          const lineNum = parseInt(parts[1], 10);
          const x = parseFloat(parts[2]);
          const y = parseFloat(parts[3]);

          if (lineNum > 0) {
            if (!lineToPdf[lineNum]) {
              lineToPdf[lineNum] = { page: currentPage, x, y };
            }
            if (!pdfToLine[currentPage]) {
              pdfToLine[currentPage] = [];
            }
            pdfToLine[currentPage].push({ line: lineNum, x, y });
          }
        }
      }
    }
    return { lineToPdf, pdfToLine };
  } catch (err) {
    console.error("Failed to parse SyncTeX:", err);
    return null;
  }
}

const isWindows = os.platform() === "win32";

// Auto-detect common MiKTeX / TeX Live paths on Windows in case the terminal PATH hasn't refreshed yet
if (isWindows) {
  const commonTexPaths = [
    path.join(os.homedir(), "AppData", "Local", "Programs", "MiKTeX", "miktex", "bin", "x64"),
    path.join(os.homedir(), "AppData", "Local", "Programs", "MiKTeX", "bin"),
    "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64",
    "C:\\Program Files\\MiKTeX 2.9\\miktex\\bin\\x64",
    "C:\\Program Files (x86)\\MiKTeX\\miktex\\bin",
    "C:\\Program Files (x86)\\MiKTeX 2.9\\miktex\\bin",
    "C:\\texlive\\2026\\bin\\windows",
    "C:\\texlive\\2025\\bin\\windows",
    "C:\\texlive\\2024\\bin\\windows"
  ];
  for (const p of commonTexPaths) {
    if (fs.existsSync(p) && !process.env.PATH.toLowerCase().includes(p.toLowerCase())) {
      process.env.PATH = `${p};${process.env.PATH}`;
    }
  }
}

const findCmd = isWindows ? "where" : "which";
const PORT = process.env.PORT || 2345;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range",
};

// Store the latest compiled PDF (from either mode)
let latestPdf = null;
let pdfVersion = 0;

// ---------- LaTeX stuff (unchanged) ----------
const PROJECT_FONTS_DIR = path.join(__dirname, "fonts");
let hasLocalFonts = false;
try {
  if (fs.existsSync(PROJECT_FONTS_DIR) && fs.statSync(PROJECT_FONTS_DIR).isDirectory()) {
    hasLocalFonts = true;
  }
} catch (e) {}

function createTempDir() {
  return path.join(os.tmpdir(), "latex-studio-" + crypto.randomBytes(6).toString("hex"));
}

function cleanUp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}

function isValidPdfFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stats = fs.statSync(filePath);
  if (stats.size < 1024) return false;
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(4);
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);
  return buffer.toString() === '%PDF';
}

function compileLaTeX(code, engine, files, callback) {
  const tmpDir = createTempDir();
  fs.mkdirSync(tmpDir, { recursive: true });

  if (hasLocalFonts) {
    try {
      const filesList = fs.readdirSync(PROJECT_FONTS_DIR);
      for (const file of filesList) {
        const src = path.join(PROJECT_FONTS_DIR, file);
        const dest = path.join(tmpDir, file);
        fs.copyFileSync(src, dest);
      }
    } catch (e) {}
  }

  // Write nested project files (multi-file project support)
  if (files && Array.isArray(files)) {
    for (const f of files) {
      if (f.path && typeof f.content === "string") {
        const fullPath = path.join(tmpDir, f.path);
        try {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          if (f.content.startsWith("data:") && f.content.includes(";base64,")) {
            const base64Data = f.content.split(";base64,")[1];
            fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
          } else {
            fs.writeFileSync(fullPath, f.content, "utf-8");
          }
        } catch (err) {
          console.error(`Failed to write project file ${f.path}:`, err);
        }
      }
    }
  }

  const texFile = path.join(tmpDir, "document.tex");
  const pdfFile = path.join(tmpDir, "document.pdf");
  const logFile = path.join(tmpDir, "document.log");

  fs.writeFileSync(texFile, code, "utf-8");

  const engineCmd = { pdflatex: "pdflatex", xelatex: "xelatex", lualatex: "lualatex" }[engine] || "pdflatex";
  const env = { ...process.env };
  if (hasLocalFonts && (engine === "xelatex" || engine === "lualatex")) {
    const existing = env.OSFONTDIR || '';
    const sep = isWindows ? ';' : ':';
    env.OSFONTDIR = existing ? `${PROJECT_FONTS_DIR}${sep}${existing}` : PROJECT_FONTS_DIR;
  }

  const execOpts = { timeout: 120000, maxBuffer: 10 * 1024 * 1024, shell: true, env };
  const baseCmd = isWindows
    ? `cd /d "${tmpDir}" && ${engineCmd} -interaction=nonstopmode -halt-on-error -shell-escape -synctex=1 document.tex`
    : `cd "${tmpDir}" && ${engineCmd} -interaction=nonstopmode -halt-on-error -shell-escape -synctex=1 document.tex`;

  function runPass(cmd, cb) {
    exec(cmd, execOpts, (err, stdout, stderr) => {
      const validPdf = isValidPdfFile(pdfFile);
      cb({ success: !err && validPdf, err, stdout, stderr, validPdf });
    });
  }

  runPass(baseCmd, (result1) => {
    if (!result1.success) {
      let logContent = '';
      try { logContent = fs.readFileSync(logFile, 'utf-8'); } catch { logContent = result1.stderr || result1.stdout || 'Unknown error'; }
      const errorLines = extractErrors(logContent);
      cleanUp(tmpDir);
      return callback({ error: errorLines || 'Compilation failed', log: logContent });
    }
    runPass(baseCmd, (result2) => {
      if (!result2.success) {
        let logContent = '';
        try { logContent = fs.readFileSync(logFile, 'utf-8'); } catch { logContent = result2.stderr || result2.stdout || 'Second pass failed'; }
        const errorLines = extractErrors(logContent);
        cleanUp(tmpDir);
        return callback({ error: errorLines || 'Second pass failed', log: logContent });
      }
      const pdfData = fs.readFileSync(pdfFile);
      const synctexGzFile = path.join(tmpDir, "document.synctex.gz");
      const synctexData = parseSyncTeX(synctexGzFile);
      cleanUp(tmpDir);
      callback(null, pdfData, synctexData);
    });
  });
}

function extractErrors(log) {
  const lines = log.split("\n");
  const errors = [];
  let capture = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("!") || line.includes("Error:") || line.includes("Fatal error")) {
      capture = true;
      errors.push(line);
    } else if (capture) {
      if (line.trim() === "" || errors.length > 30) capture = false;
      else errors.push(line);
    }
    if (line.includes("File") && line.includes("not found")) errors.push(line);
    if (line.includes("Undefined control sequence")) {
      errors.push(line);
      if (i + 1 < lines.length) errors.push(lines[i + 1]);
    }
  }
  return errors.length > 0 ? errors.join("\n") : null;
}

// ---------- NEW: HTML → PDF using Puppeteer ----------
async function compileHTML(htmlCode) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // needed on some systems
  });
  try {
    const page = await browser.newPage();
    // Set content – includes basic CSS for print
    await page.setContent(htmlCode, { waitUntil: 'networkidle0' });
    // Generate PDF with nice defaults
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
    });
    return { success: true, data: pdfBuffer };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

// ---------- HTTP Server ----------
const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // ---------- POST /compile (LaTeX) ----------
  if (req.method === "POST" && req.url === "/compile") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { code, engine, files } = JSON.parse(body);
        if (!code || typeof code !== "string") {
          res.writeHead(400, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No LaTeX code provided" }));
          return;
        }
        console.log(`[${new Date().toISOString()}] Compiling LaTeX with ${engine || "pdflatex"}...`);
        compileLaTeX(code, engine || "pdflatex", files || null, (err, pdfData, synctexData) => {
          if (err) {
            console.error(`\x1b[31m[${new Date().toISOString()}] LaTeX compilation failed using ${engine || "pdflatex"}:\x1b[0m`);
            console.error(`\x1b[33mError Summary:\x1b[0m\n${err.error || "No explicit errors extracted."}`);
            if (err.log) {
              const logLines = err.log.split("\n");
              const tail = logLines.slice(-15).join("\n");
              console.error(`\x1b[90mLog Tail:\x1b[0m\n${tail}\n`);
            }
            res.writeHead(422, { ...corsHeaders, "Content-Type": "application/json" });
            res.end(JSON.stringify(err));
          } else {
            latestPdf = pdfData;
            pdfVersion++;
            console.log(`[${new Date().toISOString()}] LaTeX OK (${pdfData.length} bytes, v${pdfVersion})`);
            res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, version: pdfVersion, size: pdfData.length, synctex: synctexData }));
          }
        });
      } catch (e) {
        console.error(`\x1b[31m[${new Date().toISOString()}] Request error: ${e.message}\x1b[0m`);
        res.writeHead(400, { ...corsHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request: " + e.message }));
      }
    });
  }

  // ---------- NEW: POST /compile-html (HTML → PDF) ----------
  else if (req.method === "POST" && req.url === "/compile-html") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { html } = JSON.parse(body);
        if (!html || typeof html !== "string") {
          res.writeHead(400, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No HTML code provided" }));
          return;
        }

        console.log(`[${new Date().toISOString()}] Compiling HTML to PDF...`);
        const result = await compileHTML(html);

        if (!result.success) {
          console.error(`\x1b[31m[${new Date().toISOString()}] HTML compilation failed: ${result.error}\x1b[0m`);
          res.writeHead(422, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: result.error }));
        } else {
          latestPdf = result.data;
          pdfVersion++;
          console.log(`[${new Date().toISOString()}] HTML OK (${result.data.length} bytes, v${pdfVersion})`);
          res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, version: pdfVersion, size: result.data.length }));
        }

      } catch (e) {
        res.writeHead(400, { ...corsHeaders, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request: " + e.message }));
      }
    });
  }

  // ---------- GET /pdf, /download, /health (unchanged) ----------
  else if (req.method === "GET" && req.url === "/TeXForge.png") {
    const logoPath = path.join(__dirname, "latex-studio", "public", "TeXForge.png");
    if (fs.existsSync(logoPath)) {
      res.writeHead(200, { ...corsHeaders, "Content-Type": "image/png" });
      res.end(fs.readFileSync(logoPath));
    } else {
      res.writeHead(404, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Logo not found" }));
    }
  }
  else if (req.method === "GET" && req.url.startsWith("/pdf")) {
    if (!latestPdf) {
      res.writeHead(404, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No PDF compiled yet" }));
      return;
    }
    res.writeHead(200, {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Length": latestPdf.length,
      "Content-Disposition": "inline; filename=document.pdf",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    res.end(latestPdf);
  }
  else if (req.method === "GET" && req.url === "/download") {
    if (!latestPdf) {
      res.writeHead(404, { ...corsHeaders, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No PDF compiled yet" }));
      return;
    }
    res.writeHead(200, {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Length": latestPdf.length,
      "Content-Disposition": "attachment; filename=document.pdf",
    });
    res.end(latestPdf);
  }
  else if (req.method === "GET" && req.url === "/health") {
    let engines = {};
    for (const eng of ["pdflatex", "xelatex", "lualatex"]) {
      try { execSync(`${findCmd} ${eng}`, { stdio: "pipe" }); engines[eng] = true; }
      catch { engines[eng] = false; }
    }
    res.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", engines, pdfVersion, timestamp: new Date().toISOString() }));
  }
  else {
    res.writeHead(404, { ...corsHeaders, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ LaTeX + HTML → PDF server running on http://0.0.0.0:${PORT}`);
  console.log("Checking LaTeX engines...");
  for (const eng of ["pdflatex", "xelatex", "lualatex"]) {
    try { execSync(`${findCmd} ${eng}`, { stdio: "pipe" }); console.log(`  ✓ ${eng}`); }
    catch { console.log(`  ✗ ${eng}`); }
  }
  if (hasLocalFonts) console.log(`📁 Local fonts: ${PROJECT_FONTS_DIR} (copied for LaTeX)`);
  console.log(`🖨️  HTML→PDF: Puppeteer ready`);
});