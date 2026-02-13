import { useState, useRef, useEffect, useCallback } from "react";
// Important: You must run 'npm install react-pdf'
import { Document, Page, pdfjs } from 'react-pdf';

// Import CSS for PDF layers (standard with react-pdf)
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up the PDF.js worker from a CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:2345";

// ---------- LaTeX package detection (unchanged) ----------
const KNOWN_PACKAGES = {
  "\\frac": "amsmath", "\\dfrac": "amsmath", "\\tfrac": "amsmath",
  "\\binom": "amsmath", "\\align": "amsmath", "\\equation*": "amsmath",
  "\\gather": "amsmath", "\\multline": "amsmath",
  "\\mathbb": "amssymb", "\\mathfrak": "amssymb", "\\therefore": "amssymb",
  "\\because": "amssymb", "\\leqslant": "amssymb", "\\geqslant": "amssymb",
  "\\boldsymbol": "bm",
  "\\SI": "siunitx", "\\si": "siunitx", "\\num": "siunitx", "\\qty": "siunitx", "\\unit": "siunitx",
  "\\cancel": "cancel", "\\bcancel": "cancel", "\\xcancel": "cancel",
  "\\abs": "physics", "\\norm": "physics", "\\dv": "physics", "\\pdv": "physics",
  "\\bra": "physics", "\\ket": "physics", "\\braket": "physics",
  "\\ce": "mhchem", "\\bond": "mhchem",
  "\\chemfig": "chemfig", "\\charge": "chemfig", "\\lewis": "chemfig",
  "\\setatomsep": "chemfig", "\\chemname": "chemfig",
  "\\begin{circuitikz}": "circuitikz", "\\ctikzset": "circuitikz",
  "\\toprule": "booktabs", "\\midrule": "booktabs", "\\bottomrule": "booktabs",
  "\\multirow": "multirow", "\\begin{multicols}": "multicol",
  "\\rowcolor": "colortbl", "\\cellcolor": "colortbl",
  "\\begin{longtable}": "longtable", "\\begin{tabularx}": "tabularx",
  "\\includegraphics": "graphicx", "\\rotatebox": "graphicx",
  "\\scalebox": "graphicx", "\\resizebox": "graphicx",
  "\\begin{tikzpicture}": "tikz", "\\tikz": "tikz",
  "\\begin{axis}": "pgfplots",
  "\\begin{subfigure}": "subcaption", "\\begin{wrapfigure}": "wrapfig",
  "\\textcolor": "xcolor", "\\colorbox": "xcolor", "\\definecolor": "xcolor",
  "\\url": "hyperref", "\\href": "hyperref", "\\hyperref": "hyperref",
  "\\begin{lstlisting}": "listings", "\\lstset": "listings",
  "\\begin{minted}": "minted",
  "\\lipsum": "lipsum", "\\blindtext": "blindtext",
  "\\geometry": "geometry",
  "\\uline": "ulem", "\\sout": "ulem",
  "\\begin{enumerate}[": "enumitem", "\\begin{itemize}[": "enumitem",
  "\\begin{algorithm}": "algorithm2e", "\\begin{algorithmic}": "algorithmicx",
  "\\begin{forest}": "forest",
  "\\begin{proof}": "amsthm", "\\theoremstyle": "amsthm", "\\begin{theorem}": "amsthm",
  "\\epigraph": "epigraph", "\\marginnote": "marginnote",
  "\\todo": "todonotes", "\\missingfigure": "todonotes",
};

const UNICODE_PACKAGES = ["fontspec", "polyglossia"];

// ---------- LaTeX Templates (unchanged) ----------
const LATEX_TEMPLATES = {
  blank: `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}

\\title{Your Title Here}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Write your content here.

\\end{document}`,

  math: `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb, amsthm}
\\usepackage{physics}
\\usepackage{siunitx}
\\usepackage{cancel}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}

\\newtheorem{theorem}{Theorem}[section]
\\newtheorem{lemma}[theorem]{Lemma}

\\title{Mathematics Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Equations}
The quadratic formula:
\\begin{equation}
  x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
\\end{equation}

Euler's identity:
\\[ e^{i\\pi} + 1 = 0 \\]

\\section{Calculus}
\\begin{align}
  \\int_0^\\infty e^{-x^2} \\, dx &= \\frac{\\sqrt{\\pi}}{2} \\\\
  \\sum_{n=1}^{\\infty} \\frac{1}{n^2} &= \\frac{\\pi^2}{6}
\\end{align}

\\begin{theorem}
For every real number $x$, $\\sin^2 x + \\cos^2 x = 1$.
\\end{theorem}

\\end{document}`,

  chemistry: `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage[version=4]{mhchem}
\\usepackage{chemfig}
\\usepackage{siunitx}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}

\\title{Chemistry Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Chemical Equations}
Combustion of methane:
\\[ \\ce{CH4 + 2O2 -> CO2 + 2H2O} \\]

Benzene:
\\begin{center}
\\chemfig{*6(-=-=-=)}
\\end{center}

\\end{document}`,

  physics: `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb}
\\usepackage{physics}
\\usepackage{siunitx}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
\\usepackage{circuitikz}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}

\\title{Physics Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Maxwell's Equations}
\\begin{align}
  \\div{\\vb{E}} &= \\frac{\\rho}{\\epsilon_0} \\\\
  \\curl{\\vb{B}} &= \\mu_0 \\vb{J} + \\mu_0 \\epsilon_0 \\pdv{\\vb{E}}{t}
\\end{align}

\\section{Quantum Mechanics}
\\begin{equation}
  i\\hbar \\pdv{\\Psi}{t} = \\hat{H}\\Psi
\\end{equation}

\\end{document}`,

  bengali: `\\documentclass[12pt,a4paper]{article}
\\usepackage{geometry}
\\geometry{margin=1in}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{xcolor}
\\usepackage{tcolorbox}
\\usepackage{enumitem}
\\usepackage{fontspec}
\\setmainfont{Noto Serif Bengali}

\\title{\\textbf{\\Huge বাংলা নথি}}
\\author{লেখকের নাম}
\\date{\\today}

\\begin{document}
\\maketitle

\\section*{ভূমিকা}
এটি একটি বাংলা \\LaTeX{} নথির উদাহরণ।

\\section*{গণিত}
দ্বিঘাত সূত্র:
\\begin{equation}
  x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
\\end{equation}

\\end{document}`,

  report: `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{fancyhdr}
\\usepackage[margin=1in]{geometry}
\\usepackage{lipsum}

\\pagestyle{fancy}
\\fancyhf{}
\\rhead{Report Title}
\\lhead{Author}
\\rfoot{Page \\thepage}

\\title{\\textbf{Project Report}}
\\author{Author Name \\\\ Department \\\\ Institution}
\\date{\\today}

\\begin{document}
\\maketitle
\\tableofcontents
\\newpage

\\section{Abstract}
\\lipsum[1]

\\section{Introduction}
\\lipsum[2]

\\section{Methodology}
\\begin{table}[h]
\\centering
\\begin{tabular}{@{}lcc@{}}
\\toprule
\\textbf{Parameter} & \\textbf{Value} & \\textbf{Unit} \\\\
\\midrule
Temperature & 25.3 & °C \\\\
Pressure & 101.3 & kPa \\\\
\\bottomrule
\\end{tabular}
\\caption{Experimental Data}
\\end{table}

\\section{Results}
\\lipsum[3]

\\end{document}`,
};

// ---------- NEW: HTML Templates ----------
const HTML_TEMPLATES = {
  basic: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>HTML to PDF</title>
  <style>
    body { font-family: sans-serif; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 2em; }
    h1 { color: #7c3aed; }
  </style>
</head>
<body>
  <h1>Hello from HTML!</h1>
  <p>This PDF was generated from HTML using Puppeteer.</p>
  <ul>
    <li>You can use any CSS</li>
    <li>Images, tables, flexbox…</li>
  </ul>
</body>
</html>`,

  resume: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Resume</title>
  <style>
    body { font-family: 'Georgia', serif; max-width: 700px; margin: 2cm auto; }
    h1 { border-bottom: 2px solid #333; }
  </style>
</head>
<body>
  <h1>John Doe</h1>
  <p>Email: john@example.com</p>
  <h2>Experience</h2>
  <p><strong>Company</strong> – Role (2020–present)</p>
  <p>Details about work.</p>
</body>
</html>`,

  invoice: `<!DOCTYPE html>
<html>
<head>
  <style>
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #ccc; padding: 8px; }
  </style>
</head>
<body>
  <h2>Invoice #001</h2>
  <table>
    <tr><th>Item</th><th>Price</th></tr>
    <tr><td>Product A</td><td>$25.00</td></tr>
    <tr><td>Product B</td><td>$15.00</td></tr>
  </table>
</body>
</html>`,
};

// ---------- Custom PDF Viewer (unchanged) ----------
function CustomPDFViewer({ url }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState(null);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setPageNumber(1);
    setError(null);
  }

  function onDocumentLoadError(err) {
    setError(err.message);
  }

  const controlBtnStyle = {
    background: "rgba(22,22,31,0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "#a0a0b0",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0c0c14" }}>
      <div style={{
        padding: "8px 16px",
        background: "rgba(13,13,21,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            style={{...controlBtnStyle, opacity: pageNumber <= 1 ? 0.4 : 1}}
          >◀</button>
          <span style={{ fontSize: "12px", color: "#a0a0b0", minWidth: "80px", textAlign: "center" }}>
            {pageNumber} / {numPages || '-'}
          </span>
          <button
            onClick={() => setPageNumber(p => Math.min(numPages || p, p + 1))}
            disabled={pageNumber >= (numPages || 1)}
            style={{...controlBtnStyle, opacity: pageNumber >= (numPages || 1) ? 0.4 : 1}}
          >▶</button>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} style={controlBtnStyle}>−</button>
          <span style={{ fontSize: "12px", color: "#a0a0b0", minWidth: "40px", textAlign: "center" }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} style={controlBtnStyle}>+</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {error ? (
          <div style={{ color: "#f87171", textAlign: "center", marginTop: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
            <p>Failed to render PDF: {error}</p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>Try refreshing or checking if the fonts are installed locally.</p>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div style={{ color: "#7c3aed", marginTop: 40 }}>Initializing PDF View...</div>}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderAnnotationLayer={false}
              renderTextLayer={true}
              className="pdf-page-shadow"
            />
          </Document>
        )}
      </div>
      <style>{`
        .pdf-page-shadow canvas {
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

// ---------- Helper Functions ----------
function highlightCode(code, mode) {
  if (!code) return "";
  let html = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (mode === 'latex') {
    html = html.replace(/(%.*)$/gm, '<span style="color:#6b7280;font-style:italic">$1</span>');
    html = html.replace(/(\\[a-zA-Z@]+)/g, '<span style="color:#c084fc">$1</span>');
    html = html.replace(/([{}])/g, '<span style="color:#f59e0b">$1</span>');
    html = html.replace(/(\$\$?)/g, '<span style="color:#34d399">$1</span>');
    html = html.replace(/(\[|\])/g, '<span style="color:#60a5fa">$1</span>');
  } else {
    html = html.replace(/(&lt;!--.*?--&gt;)/g, '<span style="color:#6b7280;font-style:italic">$1</span>');
    html = html.replace(/&lt;(\/?[a-zA-Z0-9-]+)/g, '<span style="color:#f59e0b">&lt;$1</span>');
    html = html.replace(/&gt;/g, '<span style="color:#f59e0b">&gt;</span>');
    html = html.replace(/([a-zA-Z-]+)=/g, '<span style="color:#60a5fa">$1</span>=');
    html = html.replace(/&quot;(.*?)&quot;/g, '<span style="color:#34d399">&quot;$1&quot;</span>');
  }
  return html;
}

function detectMissingPackages(code) {
  const declaredPackages = new Set();
  const pkgRegex = /\\usepackage(?:\[.*?\])?\{([^}]+)\}/g;
  let m;
  while ((m = pkgRegex.exec(code)) !== null) {
    m[1].split(",").forEach((p) => declaredPackages.add(p.trim()));
  }
  const missing = new Set();
  for (const [cmd, pkg] of Object.entries(KNOWN_PACKAGES)) {
    if (pkg && code.includes(cmd) && !declaredPackages.has(pkg)) {
      missing.add(pkg);
    }
  }
  return Array.from(missing);
}

function detectRequiresUnicodeEngine(code) {
  const UNICODE_PACKAGES = ["fontspec", "polyglossia"];
  for (const pkg of UNICODE_PACKAGES) {
    if (code.includes("{" + pkg + "}")) return true;
  }
  if (code.includes("\\setmainfont") || code.includes("\\newfontfamily") || code.includes("\\setdefaultlanguage")) {
    return true;
  }
  return false;
}

function autoAddPackages(code, packages) {
  const insertPoint = code.indexOf("\\begin{document}");
  if (insertPoint === -1) return code;
  const pkgLines = packages.map((p) => "\\usepackage{" + p + "}").join("\n");
  return code.slice(0, insertPoint) + pkgLines + "\n" + code.slice(insertPoint);
}

// ---------- Tooltip Component ----------
function Tooltip({ children, text }) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(20,20,30,0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#c0c0d0",
          padding: "5px 10px",
          borderRadius: 6,
          fontSize: 11,
          whiteSpace: "nowrap",
          zIndex: 999,
          pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {text}
          <div style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid rgba(20,20,30,0.95)",
          }} />
        </div>
      )}
    </div>
  );
}

// ---------- Main App Component ----------
export default function LaTeXApp() {
  const [mode, setMode] = useState('latex');
  const [code, setCode] = useState(LATEX_TEMPLATES.blank);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [activeTab, setActiveTab] = useState("editor");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [compileEngine, setCompileEngine] = useState("pdflatex");
  const [compiledWith, setCompiledWith] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const lineRef = useRef(null);
  const mainContainerRef = useRef(null);

  const codeRef = useRef(code);
  const modeRef = useRef(mode);
  const engineRef = useRef(compileEngine);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { engineRef.current = compileEngine; }, [compileEngine]);

  const lineCount = code.split("\n").length;

  // Scroll-to-top detection
  useEffect(() => {
    const handleScroll = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        setShowScrollTop(textarea.scrollTop > 400);
      }
    };
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("scroll", handleScroll);
      return () => textarea.removeEventListener("scroll", handleScroll);
    }
  }, [activeTab]);

  const scrollToTop = () => {
    if (textareaRef.current) {
      textareaRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Toast notification
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Clear editor
  const clearEditor = () => {
    setCode("");
    codeRef.current = "";
    setShowClearConfirm(false);
    showToast("Editor cleared");
  };

  // Close template menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showTemplateMenu) setShowTemplateMenu(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showTemplateMenu]);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current && lineRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      lineRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // ---------- Compile handler ----------
  const doCompile = useCallback(() => {
    const currentCode = codeRef.current;
    const currentMode = modeRef.current;

    setCompiling(true);
    setError(null);
    setPdfUrl(null);
    setCompiledWith(currentMode === 'latex' ? compileEngine : 'html');

    const url = currentMode === 'latex'
      ? `${API_BASE_URL}/compile`
      : `${API_BASE_URL}/compile-html`;
    const body = currentMode === 'latex'
      ? JSON.stringify({ code: currentCode, engine: compileEngine })
      : JSON.stringify({ html: currentCode });

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => { throw err; });
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          const timestamp = Date.now();
          const freshUrl = `${API_BASE_URL}/pdf?v=${data.version}&t=${timestamp}`;
          setPdfUrl(freshUrl);
          setActiveTab("preview");
          showToast("Compiled successfully!");
        } else {
          setError(data.error || data.log || "Compilation failed");
        }
        setCompiling(false);
      })
      .catch((err) => {
        const msg = err.error || err.log || String(err);
        setError(msg.includes("Failed to fetch")
          ? `Could not connect to server. Ensure the backend is running at ${API_BASE_URL}.`
          : msg);
        setCompiling(false);
      });
  }, [compileEngine]);

  // ---------- LaTeX pre-compilation checks ----------
  const handleCompile = useCallback(() => {
    const currentMode = modeRef.current;
    if (currentMode === 'html') {
      doCompile();
      return;
    }

    const currentCode = codeRef.current;
    const currentEngine = engineRef.current;
    const issues = [];

    const needsUnicode = detectRequiresUnicodeEngine(currentCode);
    if (needsUnicode && currentEngine === "pdflatex") {
      issues.push({
        type: "engine",
        message: "Your document uses fontspec/\\setmainfont which REQUIRE XeLaTeX or LuaLaTeX.",
        fix: "Switch to XeLaTeX",
        action: () => { setCompileEngine("xelatex"); engineRef.current = "xelatex"; },
      });
    }

    if (!currentCode.match(/\\documentclass/)) {
      issues.push({ type: "documentclass", message: "Missing \\documentclass declaration", fix: "Add \\documentclass" });
    }
    if (!currentCode.match(/\\begin\{document\}/)) {
      issues.push({ type: "begindoc", message: "Missing \\begin{document}", fix: "Add it" });
    }
    if (!currentCode.match(/\\end\{document\}/)) {
      issues.push({ type: "enddoc", message: "Missing \\end{document}", fix: "Add it" });
    }

    const missingPkgs = detectMissingPackages(currentCode);
    if (missingPkgs.length > 0) {
      issues.push({
        type: "packages", items: missingPkgs,
        message: "Missing packages: " + missingPkgs.join(", "),
        fix: "Add all missing packages",
      });
    }

    if (issues.length > 0) {
      setSuggestions(issues);
    } else {
      setSuggestions(null);
      doCompile();
    }
  }, [doCompile]);

  // ---------- Apply fixes ----------
  const applyFix = (issue) => {
    if (issue.type === "engine") {
      issue.action();
      setSuggestions((prev) => prev ? prev.filter((s) => s !== issue) : null);
      return;
    }
    let newCode = codeRef.current;
    if (issue.type === "documentclass") {
      newCode = "\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n" + newCode;
    }
    if (issue.type === "begindoc") {
      const lastPkg = newCode.lastIndexOf("\\usepackage");
      const insertAt = lastPkg !== -1 ? newCode.indexOf("\n", lastPkg) + 1 : newCode.length;
      newCode = newCode.slice(0, insertAt) + "\n\\begin{document}\n" + newCode.slice(insertAt);
    }
    if (issue.type === "enddoc") { newCode += "\n\\end{document}"; }
    if (issue.type === "packages") { newCode = autoAddPackages(newCode, issue.items); }
    setCode(newCode);
    codeRef.current = newCode;
    setSuggestions((prev) => prev ? prev.filter((s) => s !== issue) : null);
  };

  const applyAllFixes = () => {
    if (!suggestions) return;
    let newCode = codeRef.current;
    for (const issue of suggestions) {
      if (issue.type === "engine") { issue.action(); continue; }
      if (issue.type === "documentclass") {
        newCode = "\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n" + newCode;
      }
      if (issue.type === "begindoc") {
        const lastPkg = newCode.lastIndexOf("\\usepackage");
        const insertAt = lastPkg !== -1 ? newCode.indexOf("\n", lastPkg) + 1 : newCode.length;
        newCode = newCode.slice(0, insertAt) + "\n\\begin{document}\n" + newCode.slice(insertAt);
      }
      if (issue.type === "enddoc") { newCode += "\n\\end{document}"; }
      if (issue.type === "packages") { newCode = autoAddPackages(newCode, issue.items); }
    }
    setCode(newCode);
    codeRef.current = newCode;
    setSuggestions(null);
  };

  // ---------- Key handler ----------
  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      setCode(newCode);
      codeRef.current = newCode;
      setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 2; }, 0);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleCompile();
    }
  };

  // ---------- Mode switch ----------
  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'latex') {
      setCode(LATEX_TEMPLATES.blank);
      codeRef.current = LATEX_TEMPLATES.blank;
      setSelectedTemplate('blank');
    } else {
      setCode(HTML_TEMPLATES.basic);
      codeRef.current = HTML_TEMPLATES.basic;
      setSelectedTemplate('basic');
    }
    setSuggestions(null);
    setError(null);
    setPdfUrl(null);
  };

  // ---------- Template loader ----------
  const loadTemplate = (key) => {
    if (mode === 'latex') {
      setCode(LATEX_TEMPLATES[key]);
      codeRef.current = LATEX_TEMPLATES[key];
      setSelectedTemplate(key);
      if (key === "bengali") {
        setCompileEngine("xelatex");
        engineRef.current = "xelatex";
      }
    } else {
      setCode(HTML_TEMPLATES[key]);
      codeRef.current = HTML_TEMPLATES[key];
      setSelectedTemplate(key);
    }
    setShowTemplateMenu(false);
    setSuggestions(null);
    setError(null);
    setPdfUrl(null);
  };

  // ---------- UI labels & icons ----------
  const latexTemplateLabels = {
    blank: "Blank Article", math: "Mathematics", chemistry: "Chemistry",
    physics: "Physics", bengali: "Bengali (বাংলা)", report: "Formal Report",
  };
  const latexTemplateIcons = {
    blank: "📄", math: "∑", chemistry: "⚗️", physics: "⚛️", bengali: "বা", report: "📊",
  };
  const htmlTemplateLabels = {
    basic: "Basic HTML", resume: "Resume", invoice: "Invoice",
  };
  const htmlTemplateIcons = {
    basic: "🌐", resume: "📝", invoice: "🧾",
  };

  // Shared glass button style
  const glassBtn = (active = false) => ({
    background: active ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: active ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.06)",
    color: active ? "#c084fc" : "#a0a0b0",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.25s ease",
    display: "flex",
    alignItems: "center",
    gap: 6,
  });

  // ---------- Render ----------
  return (
    <div
      ref={mainContainerRef}
      style={{
        height: "100vh",
        minHeight: "100vh",
        background: "#08080e",
        color: "#e2e2e8",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Source Code Pro', monospace",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ========== FIXED GLASS HEADER ========== */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "rgba(10,10,18,0.65)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          flexShrink: 0,
          boxShadow: "0 4px 30px rgba(0,0,0,0.3)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: -1,
              boxShadow: "0 0 20px rgba(124,58,237,0.3)",
            }}
          >
            Lx
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#f0f0f5", letterSpacing: -0.3 }}>
              LaTeX Studio
            </h1>
            <span style={{ fontSize: 10, color: "#5a5a70", fontWeight: 400 }}>
              Local • Offline • Full-featured
            </span>
          </div>
        </div>

        {/* Controls cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Mode Toggle (glass pill) */}
          <div style={{
            display: "flex",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 10,
            padding: 3,
            border: "1px solid rgba(255,255,255,0.05)",
          }}>
            <button
              onClick={() => handleModeChange('latex')}
              style={{
                padding: "5px 14px",
                borderRadius: 8,
                border: "none",
                background: mode === 'latex' ? "rgba(124,58,237,0.2)" : "transparent",
                color: mode === 'latex' ? "#c084fc" : "#6b6b80",
                fontSize: 11,
                fontWeight: mode === 'latex' ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "inherit",
              }}
            >
              📄 LaTeX
            </button>
            <button
              onClick={() => handleModeChange('html')}
              style={{
                padding: "5px 14px",
                borderRadius: 8,
                border: "none",
                background: mode === 'html' ? "rgba(52,211,153,0.15)" : "transparent",
                color: mode === 'html' ? "#34d399" : "#6b6b80",
                fontSize: 11,
                fontWeight: mode === 'html' ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "inherit",
              }}
            >
              🌐 HTML
            </button>
          </div>

          {/* Engine dropdown – only for LaTeX mode */}
          {mode === 'latex' && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background:
                    compileEngine === "pdflatex" ? "#60a5fa"
                    : compileEngine === "xelatex" ? "#34d399"
                    : "#f59e0b",
                  boxShadow: `0 0 8px ${
                    compileEngine === "pdflatex" ? "rgba(96,165,250,0.4)"
                    : compileEngine === "xelatex" ? "rgba(52,211,153,0.4)"
                    : "rgba(245,158,11,0.4)"
                  }`,
                }}
              />
              <select
                value={compileEngine}
                onChange={(e) => {
                  setCompileEngine(e.target.value);
                  engineRef.current = e.target.value;
                }}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#a0a0b0",
                  padding: "5px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  cursor: "pointer",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              >
                <option value="pdflatex">pdfLaTeX</option>
                <option value="xelatex">XeLaTeX (Unicode/Bengali)</option>
                <option value="lualatex">LuaLaTeX (Unicode)</option>
              </select>
            </div>
          )}

          {/* Templates dropdown */}
          <div style={{ position: "relative" }}>
            <Tooltip text="Choose a template">
              <button
                onClick={(e) => { e.stopPropagation(); setShowTemplateMenu(!showTemplateMenu); }}
                style={glassBtn()}
              >
                <span>Templates</span>
                <span style={{ fontSize: 9, opacity: 0.5 }}>▼</span>
              </button>
            </Tooltip>
            {showTemplateMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "rgba(18,18,28,0.85)",
                  backdropFilter: "blur(24px) saturate(1.3)",
                  WebkitBackdropFilter: "blur(24px) saturate(1.3)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12,
                  overflow: "hidden",
                  zIndex: 100,
                  minWidth: 220,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset",
                }}
              >
                <div style={{ padding: "8px 14px 4px", fontSize: 10, color: "#5a5a70", textTransform: "uppercase", letterSpacing: 1 }}>
                  {mode === 'latex' ? 'LaTeX Templates' : 'HTML Templates'}
                </div>
                {mode === 'latex' ? (
                  Object.keys(LATEX_TEMPLATES).map((key) => (
                    <button
                      key={key}
                      onClick={() => loadTemplate(key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "9px 14px",
                        border: "none",
                        background: selectedTemplate === key ? "rgba(124,58,237,0.12)" : "transparent",
                        color: selectedTemplate === key ? "#c084fc" : "#a0a0b0",
                        fontSize: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 15, width: 22, textAlign: "center" }}>
                        {latexTemplateIcons[key]}
                      </span>
                      {latexTemplateLabels[key]}
                      {key === "bengali" && (
                        <span style={{ fontSize: 9, color: "#34d399", marginLeft: "auto", opacity: 0.8 }}>
                          XeLaTeX
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  Object.keys(HTML_TEMPLATES).map((key) => (
                    <button
                      key={key}
                      onClick={() => loadTemplate(key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "9px 14px",
                        border: "none",
                        background: selectedTemplate === key ? "rgba(52,211,153,0.1)" : "transparent",
                        color: selectedTemplate === key ? "#34d399" : "#a0a0b0",
                        fontSize: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 15, width: 22, textAlign: "center" }}>
                        {htmlTemplateIcons[key]}
                      </span>
                      {htmlTemplateLabels[key]}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Clear button */}
          <Tooltip text="Clear editor (Ctrl+Shift+X)">
            <button
              onClick={() => setShowClearConfirm(true)}
              style={glassBtn()}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
              Clear
            </button>
          </Tooltip>

          {/* Compile button */}
          <button
            onClick={handleCompile}
            disabled={compiling}
            style={{
              background: compiling
                ? "rgba(60,60,80,0.4)"
                : "linear-gradient(135deg, #7c3aed, #9333ea)",
              border: compiling ? "1px solid rgba(255,255,255,0.05)" : "none",
              color: "#fff",
              padding: "7px 18px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              cursor: compiling ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "inherit",
              boxShadow: compiling
                ? "none"
                : "0 2px 16px rgba(124,58,237,0.35), 0 0 0 1px rgba(124,58,237,0.2) inset",
              transition: "all 0.25s ease",
            }}
          >
            {compiling ? (
              <>
                <span
                  style={{
                    width: 13,
                    height: 13,
                    border: "2px solid #fff3",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                    display: "inline-block",
                  }}
                />
                Compiling…
              </>
            ) : (
              <>
                ▶ Compile{" "}
                <span style={{ fontSize: 9, opacity: 0.5 }}>Ctrl+↵</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ========== CLEAR CONFIRMATION MODAL ========== */}
      {showClearConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            background: "rgba(16,16,26,0.9)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "28px 32px",
            maxWidth: 380,
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "#f0f0f5" }}>
              Clear Editor?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#7a7a90", lineHeight: 1.5 }}>
              This will remove all content from the editor. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  ...glassBtn(),
                  padding: "8px 20px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={clearEditor}
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171",
                  padding: "8px 20px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                Clear Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== TOAST NOTIFICATION ========== */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(16,16,28,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(124,58,237,0.2)",
          color: "#c084fc",
          padding: "10px 24px",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 500,
          zIndex: 300,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "toastIn 0.3s ease-out",
        }}>
          {toastMessage}
        </div>
      )}

      {/* Suggestions banner – only for LaTeX mode */}
      {mode === 'latex' && suggestions && suggestions.length > 0 && (
        <div
          style={{
            background: "rgba(26,21,32,0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(245,158,11,0.1)",
            padding: "12px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                background: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 600,
              }}>
                ⚠ ISSUES DETECTED
              </span>
              <span style={{ fontSize: 11, color: "#7a7a90" }}>
                {suggestions.length} issue{suggestions.length > 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={applyAllFixes}
                style={{
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  color: "#22c55e",
                  padding: "4px 12px",
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                ✓ Fix All & Continue
              </button>
              <button
                onClick={() => { setSuggestions(null); doCompile(); }}
                style={{
                  ...glassBtn(),
                  padding: "4px 12px",
                  fontSize: 11,
                }}
              >
                Compile Anyway
              </button>
              <button
                onClick={() => setSuggestions(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#5a5a70",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>
          </div>
          {suggestions.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(10,10,18,0.5)",
                border: "1px solid " + (s.type === "engine" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)"),
                borderRadius: 10,
                padding: "8px 14px",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ color: s.type === "engine" ? "#ef4444" : "#f59e0b", marginRight: 8, fontSize: 12 }}>●</span>
                <span style={{ fontSize: 12, color: "#c0c0d0" }}>{s.message}</span>
              </div>
              <button
                onClick={() => applyFix(s)}
                style={{
                  background: s.type === "engine" ? "rgba(239,68,68,0.1)" : "rgba(124,58,237,0.1)",
                  border: "1px solid " + (s.type === "engine" ? "rgba(239,68,68,0.2)" : "rgba(124,58,237,0.2)"),
                  color: s.type === "engine" ? "#f87171" : "#c084fc",
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  marginLeft: 10,
                  transition: "all 0.2s",
                }}
              >
                {s.fix}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar (glass) */}
      <div
        style={{
          display: "flex",
          background: "rgba(13,13,21,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
          flexShrink: 0,
        }}
      >
        {["editor", "preview"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "9px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab
                ? "2px solid #7c3aed"
                : "2px solid transparent",
              color: activeTab === tab ? "#c084fc" : "#5a5a70",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: 0.3,
            }}
          >
            {tab === "editor" ? "📝 Editor" : "📄 Preview"}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0, width: "100%" }}>
        {/* Editor */}
        <div
          style={{
            width: "100%",
            flex: "1 1 100%",
            display: activeTab === "editor" ? "flex" : "none",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
            {/* Line numbers */}
            <div
              ref={lineRef}
              style={{
                width: 48,
                background: "rgba(10,10,18,0.8)",
                borderRight: "1px solid rgba(255,255,255,0.03)",
                padding: "16px 0",
                overflowY: "hidden",
                flexShrink: 0,
                userSelect: "none",
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div
                  key={i}
                  style={{
                    height: 20,
                    lineHeight: "20px",
                    fontSize: 11,
                    textAlign: "right",
                    paddingRight: 10,
                    color: "#2e2e42",
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Syntax highlighting overlay */}
            <pre
              ref={highlightRef}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: 48,
                right: 0,
                bottom: 0,
                margin: 0,
                padding: 16,
                fontSize: 13,
                lineHeight: "20px",
                fontFamily: "inherit",
                overflow: "auto",
                pointerEvents: "none",
                whiteSpace: "pre",
                wordWrap: "normal",
                color: "#e2e2e8",
              }}
              dangerouslySetInnerHTML={{
                __html: highlightCode(code, mode) + "\n",
              }}
            />

            {/* Actual editable textarea */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                codeRef.current = e.target.value;
              }}
              onScroll={syncScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              style={{
                flex: 1,
                padding: 16,
                fontSize: 13,
                lineHeight: "20px",
                fontFamily: "inherit",
                background: "transparent",
                color: "transparent",
                caretColor: mode === 'latex' ? "#c084fc" : "#34d399",
                border: "none",
                outline: "none",
                resize: "none",
                overflow: "auto",
                whiteSpace: "pre",
                wordWrap: "normal",
                position: "relative",
                zIndex: 1,
              }}
            />
          </div>

          {/* Editor footer (glass) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 16px",
              borderTop: "1px solid rgba(255,255,255,0.03)",
              background: "rgba(10,10,18,0.7)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              fontSize: 10,
              color: "#3e3e55",
              flexShrink: 0,
            }}
          >
            <span>
              {lineCount} lines • {code.length} chars • {mode === 'latex' ? 'LaTeX' : 'HTML'}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {mode === 'latex' && detectRequiresUnicodeEngine(code) && compileEngine === "pdflatex" && (
                <span style={{ color: "#f59e0b", fontSize: 9 }}>⚠ Needs XeLaTeX/LuaLaTeX</span>
              )}
              {mode === 'latex' && (
                <span
                  style={{
                    color:
                      compileEngine === "pdflatex" ? "#60a5fa"
                      : compileEngine === "xelatex" ? "#34d399"
                      : "#f59e0b",
                    fontSize: 10,
                  }}
                >
                  {compileEngine}
                </span>
              )}
            </div>
          </div>

          {/* ========== SCROLL TO TOP BUTTON ========== */}
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              style={{
                position: "absolute",
                bottom: 48,
                right: 20,
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "rgba(124,58,237,0.15)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(124,58,237,0.25)",
                color: "#c084fc",
                fontSize: 16,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                boxShadow: "0 4px 20px rgba(124,58,237,0.2)",
                transition: "all 0.25s ease",
                animation: "fadeInUp 0.3s ease-out",
              }}
              title="Scroll to top"
            >
              ↑
            </button>
          )}
        </div>

        {/* Preview pane */}
        <div
          style={{
            width: "100%",
            flex: "1 1 100%",
            display: activeTab === "preview" ? "flex" : "none",
            flexDirection: "column",
            background: "#0a0a12",
          }}
        >
          {error && (
            <div
              style={{
                background: "rgba(26,15,15,0.8)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                borderBottom: "1px solid rgba(239,68,68,0.1)",
                padding: 14,
                maxHeight: 300,
                overflow: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "#ef4444",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 600,
                }}>
                  ✕ COMPILATION ERROR
                </span>
                {compiledWith && (
                  <span style={{ fontSize: 10, color: "#5a5a70" }}>engine: {compiledWith}</span>
                )}
              </div>
              <pre style={{
                fontSize: 11,
                color: "#f87171",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                fontFamily: "inherit",
                lineHeight: 1.6,
              }}>
                {error}
              </pre>
            </div>
          )}

          {pdfUrl ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: "rgba(10,10,18,0.7)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <span style={{ fontSize: 11, color: "#22c55e", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.4)" }} />
                  Compiled with {compiledWith}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <a
                    href={`${API_BASE_URL}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...glassBtn(),
                      textDecoration: "none",
                      padding: "4px 12px",
                      fontSize: 11,
                      color: "#c084fc",
                    }}
                  >
                    ↗ Open
                  </a>
                  <a
                    href={`${API_BASE_URL}/download`}
                    download="document.pdf"
                    style={{
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      color: "#22c55e",
                      padding: "4px 12px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.2s",
                    }}
                  >
                    ⬇ Download
                  </a>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <CustomPDFViewer url={pdfUrl} />
              </div>
            </div>
          ) : (
            !error && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 14,
                  color: "#2e2e42",
                }}
              >
                <div style={{
                  fontSize: 48,
                  opacity: 0.2,
                  filter: "grayscale(0.5)",
                }}>
                  {mode === 'latex' ? '📄' : '🌐'}
                </div>
                <div style={{ fontSize: 13, textAlign: "center", lineHeight: 1.8 }}>
                  Press{" "}
                  <strong style={{ color: "#7c3aed" }}>Compile</strong> or{" "}
                  <strong style={{ color: "#7c3aed" }}>Ctrl+Enter</strong>
                </div>
                <div style={{ fontSize: 10, color: "#1e1e30", marginTop: 6 }}>
                  Server: {API_BASE_URL}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ========== GLOBAL STYLES ========== */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        ::selection { background: rgba(124,58,237,0.25); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }

        button:hover { filter: brightness(1.15); }
        a:hover { filter: brightness(1.15); }
        select option { background: #12121a; color: #a0a0b0; }
      `}</style>
    </div>
  );
}