import { useState, useRef, useEffect, useCallback } from "react";
// Important: You must run 'npm install react-pdf'
import { Document, Page, pdfjs } from 'react-pdf';
import Editor from "@monaco-editor/react";

// Import CSS for PDF layers (standard with react-pdf)
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up the PDF.js worker from a CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  blank: ``,

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
\\setmainfont{Vrinda}[Script=Bengali]
% Or use: \\setmainfont{Nirmala UI}[Script=Bengali]
% Or custom fonts: \\setmainfont{Kalpurush}[Script=Bengali]

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
  basic: ``,

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

// Lightweight page renderer component for continuous vertical scroll
function PDFPage({ pdf, pageNum, scale, synctexData, onPageDoubleClick, onRegisterCanvas, observePage }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!pdf) return;
    let active = true;
    let renderTask = null;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (!active) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * dpr });
        const context = canvas.getContext("2d");
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.height = `${viewport.height / dpr}px`;
        canvas.style.width = `${viewport.width / dpr}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err && err.name !== "RenderingCancelledException") {
          console.error(`Page ${pageNum} render error:`, err);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, pageNum, scale]);

  const onDoubleClick = (e) => {
    if (!pdf || !synctexData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert pixels to standard LaTeX page points (A4 ratio approximation)
    const pdfX = (clickX / rect.width) * 595;
    const pdfY = (clickY / rect.height) * 842;

    onPageDoubleClick(pageNum, pdfX, pdfY);
  };

  return (
    <div 
      ref={observePage}
      data-page={pageNum}
      style={{ 
        position: "relative", 
        marginBottom: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}
    >
      <div style={{
        alignSelf: "flex-start",
        fontSize: "11px",
        color: "#64748b",
        fontWeight: "600",
        marginBottom: "6px",
        userSelect: "none"
      }}>
        Page {pageNum}
      </div>
      <div style={{ position: "relative" }} onDoubleClick={onDoubleClick}>
        <canvas
          ref={el => {
            canvasRef.current = el;
            if (onRegisterCanvas) {
              onRegisterCanvas(el);
            }
          }}
          style={{
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            borderRadius: "4px",
            background: "#fff",
            display: "block",
            cursor: "crosshair",
          }}
        />
      </div>
    </div>
  );
}

// ---------- Custom PDF Viewer (Vertical continuous scroll version) ----------
function CustomPDFViewer({ url, synctexData, onPageDoubleClick, viewerRef }) {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const canvasRefs = useRef({});
  const visiblePagesRef = useRef({});
  const observerRef = useRef(null);

  // Setup observer to update visible page number during scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute("data-page"), 10);
          if (entry.isIntersecting) {
            visiblePagesRef.current[pageNum] = entry.intersectionRatio;
          } else {
            delete visiblePagesRef.current[pageNum];
          }
        });

        const visible = Object.entries(visiblePagesRef.current);
        if (visible.length > 0) {
          visible.sort((a, b) => b[1] - a[1]);
          setPageNumber(parseInt(visible[0][0], 10));
        }
      },
      {
        root: containerRef.current,
        threshold: [0.0, 0.2, 0.5, 0.8],
      }
    );

    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const observePage = useCallback((el) => {
    if (el && observerRef.current) {
      observerRef.current.observe(el);
    }
  }, []);

  // Synchronously handle coordinate scrolling (forward sync)
  useEffect(() => {
    if (viewerRef) {
      viewerRef.current = {
        scrollToPageCoordinate: (pageNum, yPt) => {
          const canvas = canvasRefs.current[pageNum];
          if (canvas && containerRef.current) {
            const rect = canvas.getBoundingClientRect();
            const container = containerRef.current;
            const containerRect = container.getBoundingClientRect();
            
            // Calculate scale ratio relative to standard 842 A4 height points
            const ratio = rect.height / 842;
            const scrollY = container.scrollTop + (rect.top - containerRect.top) + (yPt * ratio) - (container.clientHeight / 2);
            
            container.scrollTo({ top: Math.max(0, scrollY), behavior: "smooth" });

            // Highlight outline flash
            const highlight = document.createElement("div");
            highlight.style.position = "absolute";
            highlight.style.left = `0px`;
            highlight.style.top = `${yPt * ratio}px`;
            highlight.style.width = "100%";
            highlight.style.height = "18px";
            highlight.style.background = "rgba(59, 130, 246, 0.18)";
            highlight.style.borderLeft = "4px solid var(--primary-solid)";
            highlight.style.pointerEvents = "none";
            highlight.style.zIndex = "10";
            highlight.style.transition = "opacity 0.8s ease";
            canvas.parentNode.appendChild(highlight);
            setTimeout(() => {
              highlight.style.opacity = "0";
              setTimeout(() => highlight.remove(), 800);
            }, 1200);
          }
        }
      };
    }
  }, [pdf, viewerRef]);

  // Load document
  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    visiblePagesRef.current = {};

    const loadDoc = async () => {
      try {
        let pdfjs = window.pdfjsLib;
        if (!pdfjs) {
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            if (window.pdfjsLib) {
              pdfjs = window.pdfjsLib;
              break;
            }
          }
        }
        if (!pdfjs) {
          throw new Error("PDF.js failed to load from CDN.");
        }

        const loadingTask = pdfjs.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setPageNumber(1);
        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError(err.message || String(err));
        setLoading(false);
      }
    };
    loadDoc();
  }, [url]);

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
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#a0a0b0", fontWeight: "500" }}>
            Page {pageNumber} / {numPages || '-'}
          </span>
        </div>

        <span style={{ fontSize: 9, color: "var(--primary-solid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Double Click Preview to Sync Editor
        </span>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} style={controlBtnStyle}>−</button>
          <span style={{ fontSize: "12px", color: "#a0a0b0", minWidth: "40px", textAlign: "center" }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} style={controlBtnStyle}>+</button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ flex: 1, overflow: "auto", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
      >
        {loading ? (
          <div style={{ color: "var(--primary-solid)", marginTop: 40, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "var(--primary-solid)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
            Rendering PDF...
          </div>
        ) : error ? (
          <div style={{ color: "#f87171", textAlign: "center", marginTop: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
            <p>Failed to render PDF: {error}</p>
          </div>
        ) : (
          pdf && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              {Array.from({ length: numPages || 0 }, (_, i) => i + 1).map(pageNum => (
                <PDFPage
                  key={pageNum}
                  pdf={pdf}
                  pageNum={pageNum}
                  scale={scale}
                  synctexData={synctexData}
                  onPageDoubleClick={onPageDoubleClick}
                  onRegisterCanvas={(el) => {
                    if (el) {
                      canvasRefs.current[pageNum] = el;
                    } else {
                      delete canvasRefs.current[pageNum];
                    }
                  }}
                  observePage={observePage}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ---------- Helper Functions ----------
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
  // Default project files setup
  const DEFAULT_PROJECT_FILES = [
    { id: "1", name: "main.tex", content: LATEX_TEMPLATES.blank }
  ];

  // Load initial workspace state from LocalStorage
  const loadWorkspaceState = () => {
    try {
      const saved = localStorage.getItem("latex-studio-workspace");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load workspace state:", e);
    }
    return null;
  };

  const initialState = loadWorkspaceState() || {};

  // Core persistent states
  const [projectMode, setProjectMode] = useState(initialState.projectMode ?? false);
  const [mode, setMode] = useState(initialState.mode ?? 'latex');
  const [projectFiles, setProjectFiles] = useState(initialState.projectFiles ?? DEFAULT_PROJECT_FILES);
  const [activeFileId, setActiveFileId] = useState(initialState.activeFileId ?? "1");
  const [rootFileId, setRootFileId] = useState(initialState.rootFileId ?? "1");
  const [basicCode, setBasicCode] = useState(initialState.basicCode ?? LATEX_TEMPLATES.blank);

  // Transient states
  const [pdfUrl, setPdfUrl] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState(null);
  const [compileLog, setCompileLog] = useState(null);
  const [showFullLog, setShowFullLog] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [activeTab, setActiveTab] = useState("editor");
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [compileEngine, setCompileEngine] = useState("pdflatex");
  const [compiledWith, setCompiledWith] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileNameInput, setNewFileNameInput] = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTargetFile, setRenameTargetFile] = useState(null);
  const [renameFileInput, setRenameFileInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetFile, setDeleteTargetFile] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [synctexData, setSynctexData] = useState(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [apiUrlState, setApiUrlState] = useState(() => {
    if (typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http")) {
      return window.location.origin;
    }
    return import.meta.env.VITE_API_BASE_URL || "http://localhost:2345";
  });

  useEffect(() => {
    const currentOrigin = (typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http"))
      ? window.location.origin
      : "http://localhost:2345";

    const verifyServerHealth = () => {
      fetch(`${currentOrigin}/health`, { mode: "cors" })
        .then(res => {
          if (res.ok) {
            setApiUrlState(currentOrigin);
            setServerOnline(true);
          } else {
            setServerOnline(false);
          }
        })
        .catch(() => {
          setServerOnline(false);
        });
    };

    verifyServerHealth();
    const timer = setInterval(verifyServerHealth, 8000);
    return () => clearInterval(timer);
  }, []);

  const mainContainerRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const pdfViewerRef = useRef(null);

  // Load PDF.js dynamically from CDN
  useEffect(() => {
    if (window.pdfjsLib) return;
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    };
    document.head.appendChild(script);
  }, []);

  // Derived code block values
  const activeFile = projectFiles.find(f => f.id === activeFileId) || projectFiles[0] || DEFAULT_PROJECT_FILES[0];
  const code = projectMode ? activeFile.content : basicCode;

  const setCode = (newVal) => {
    if (projectMode) {
      setProjectFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content: newVal } : f));
    } else {
      setBasicCode(newVal);
    }
  };

  const codeRef = useRef(code);
  const modeRef = useRef(mode);
  const engineRef = useRef(compileEngine);
  const projectModeRef = useRef(projectMode);
  const projectFilesRef = useRef(projectFiles);
  const activeFileIdRef = useRef(activeFileId);
  const rootFileIdRef = useRef(rootFileId);

  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { engineRef.current = compileEngine; }, [compileEngine]);
  useEffect(() => { projectModeRef.current = projectMode; }, [projectMode]);
  useEffect(() => { projectFilesRef.current = projectFiles; }, [projectFiles]);
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);
  useEffect(() => { rootFileIdRef.current = rootFileId; }, [rootFileId]);

  // Persistence Auto-save Effect
  useEffect(() => {
    const stateToSave = {
      projectMode,
      mode,
      projectFiles,
      activeFileId,
      rootFileId,
      basicCode,
    };
    try {
      localStorage.setItem("latex-studio-workspace", JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Failed to auto-save workspace state:", e);
    }
  }, [projectMode, mode, projectFiles, activeFileId, rootFileId, basicCode]);

  const lineCount = code.split("\n").length;

  // Toast notification
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Drag and Drop File Processor
  const processDroppedFiles = useCallback((fileList) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const isImageOrBinary = (file) => {
      const name = (file.name || "").toLowerCase();
      return (
        (file.type && file.type.startsWith("image/")) ||
        name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".gif") ||
        name.endsWith(".svg") ||
        name.endsWith(".bmp") ||
        name.endsWith(".webp") ||
        name.endsWith(".pdf") ||
        name.endsWith(".eps") ||
        name.endsWith(".ico")
      );
    };

    // If in single-file mode and only 1 text file was dropped:
    if (!projectModeRef.current && filesArray.length === 1 && !isImageOrBinary(filesArray[0])) {
      const file = filesArray[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setBasicCode(text);
        codeRef.current = text;
        showToast(`Loaded "${file.name}" into editor`);
      };
      reader.readAsText(file, "UTF-8");
      return;
    }

    // Read all files asynchronously
    const readPromises = filesArray.map((file) => {
      return new Promise((resolve) => {
        const binary = isImageOrBinary(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            name: file.name,
            content: e.target.result,
            isBinary: binary,
          });
        };
        if (binary) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file, "UTF-8");
        }
      });
    });

    Promise.all(readPromises).then((loadedFiles) => {
      if (!projectModeRef.current) {
        setProjectMode(true);
        projectModeRef.current = true;
      }

      setProjectFiles((prev) => {
        let updated = [...prev];
        let firstNewId = null;

        for (const f of loadedFiles) {
          const existingIdx = updated.findIndex(
            (p) => p.name.toLowerCase() === f.name.toLowerCase()
          );
          if (existingIdx >= 0) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              content: f.content,
              isBinary: f.isBinary,
            };
            if (!firstNewId && !f.isBinary) {
              firstNewId = updated[existingIdx].id;
            }
          } else {
            const newId = (Date.now() + Math.floor(Math.random() * 10000)).toString();
            updated.push({
              id: newId,
              name: f.name,
              content: f.content,
              isBinary: f.isBinary,
            });
            if (!firstNewId && !f.isBinary) {
              firstNewId = newId;
            }
          }
        }

        if (firstNewId) {
          setActiveFileId(firstNewId);
        }
        return updated;
      });

      showToast(`Imported ${loadedFiles.length} file${loadedFiles.length > 1 ? "s" : ""} via Drag & Drop!`);
    });
  }, []);

  // Global Drag and Drop event listeners
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
        setIsDraggingOver(true);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processDroppedFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [processDroppedFiles]);

  // Clear editor
  const clearEditor = () => {
    setCode("");
    codeRef.current = "";
    setShowClearConfirm(false);
    showToast("Editor cleared");
  };

  // Close template menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showTemplateMenu) setShowTemplateMenu(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showTemplateMenu]);

  const parseLaTeXErrors = (logText) => {
    if (!logText) return [];
    const markers = [];
    const lines = logText.split("\n");
    let currentError = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("! ")) {
        currentError = {
          message: line.substring(2).trim(),
          lineNumber: 1,
        };
      } else if (currentError && line.trim().startsWith("l.")) {
        const match = line.match(/l\.(\d+)/);
        if (match) {
          currentError.lineNumber = parseInt(match[1], 10);
        }
        markers.push(currentError);
        currentError = null;
      } else if (currentError && line.includes("on input line")) {
        const match = line.match(/on input line\s+(\d+)/i);
        if (match) {
          currentError.lineNumber = parseInt(match[1], 10);
        }
        markers.push(currentError);
        currentError = null;
      }
    }
    return markers;
  };

  // ---------- Compile handler ----------
  const doCompile = useCallback(() => {
    const currentMode = modeRef.current;
    const currentEngine = engineRef.current;
    const isProj = projectModeRef.current;
    const files = projectFilesRef.current;
    const actId = activeFileIdRef.current;

    setCompiling(true);
    setError(null);
    setCompileLog(null);
    setShowFullLog(false);
    setPdfUrl(null);
    setCompiledWith(currentMode === 'latex' ? currentEngine : 'html');

    const activeF = files.find(f => f.id === actId) || files.find(f => !f.isBinary) || files[0];
    const compileCode = isProj ? activeF.content : codeRef.current;
    const filesData = isProj
      ? files.filter(f => f.id !== activeF.id).map(f => ({ path: f.name, content: f.content }))
      : null;

    const url = currentMode === 'latex'
      ? `${apiUrlState}/compile`
      : `${apiUrlState}/compile-html`;
    const body = currentMode === 'latex'
      ? JSON.stringify({ code: compileCode, engine: currentEngine, files: filesData })
      : JSON.stringify({ html: compileCode });

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
      .then((res) => {
        setServerOnline(true);
        if (!res.ok) {
          return res.json().then((err) => { throw err; });
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          const timestamp = Date.now();
          const freshUrl = `${apiUrlState}/pdf?v=${data.version}&t=${timestamp}`;
          setPdfUrl(freshUrl);
          setSynctexData(data.synctex || null);
          setActiveTab("preview");
          showToast("Compiled successfully!");

          // Clear any Monaco error markers
          if (editorRef.current && monacoRef.current) {
            const model = editorRef.current.getModel();
            monacoRef.current.editor.setModelMarkers(model, "latex-diagnostics", []);
          }
        } else {
          setError(data.error || "Compilation failed");
          setCompileLog(data.log || null);

          // Display markers in editor if compilation log exists
          if (editorRef.current && monacoRef.current && data.log) {
            const model = editorRef.current.getModel();
            const errors = parseLaTeXErrors(data.log);
            const monacoMarkers = errors.map(err => ({
              startLineNumber: err.lineNumber,
              endLineNumber: err.lineNumber,
              startColumn: 1,
              endColumn: 100,
              message: err.message,
              severity: monacoRef.current.MarkerSeverity.Error,
            }));
            monacoRef.current.editor.setModelMarkers(model, "latex-diagnostics", monacoMarkers);
          }
        }
        setCompiling(false);
      })
      .catch((err) => {
        const msg = err.error || err.log || String(err);
        setError(msg.includes("Failed to fetch")
          ? `Could not connect to server. Ensure the backend is running at ${apiUrlState}.`
          : (err.error || "Compilation failed"));
        setCompileLog(err.log || null);

        // Display markers on catch if log is available
        if (editorRef.current && monacoRef.current && err.log) {
          const model = editorRef.current.getModel();
          const errors = parseLaTeXErrors(err.log);
          const monacoMarkers = errors.map(e => ({
            startLineNumber: e.lineNumber,
            endLineNumber: e.lineNumber,
            startColumn: 1,
            endColumn: 100,
            message: e.message,
            severity: monacoRef.current.MarkerSeverity.Error,
          }));
          monacoRef.current.editor.setModelMarkers(model, "latex-diagnostics", monacoMarkers);
        }
        setCompiling(false);
      });
  }, [apiUrlState]);

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

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme("latex-studio-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6e7681", fontStyle: "italic" },
        { token: "keyword", foreground: "3b82f6", fontWeight: "bold" },
        { token: "number", foreground: "60a5fa" },
        { token: "string", foreground: "a5b4fc" },
      ],
      colors: {
        "editor.background": "#121216",
        "editor.foreground": "#e4e4e7",
        "editor.lineHighlightBackground": "#18181b",
        "editorGutter.background": "#121216",
        "editorLineNumber.foreground": "#52525b",
        "editorLineNumber.activeForeground": "#a1a1aa",
      },
    });
    monaco.editor.setTheme("latex-studio-dark");

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleCompile();
    });

    editor.onDidChangeCursorPosition((e) => {
      const line = e.position.lineNumber;
      // Trigger forward sync
      if (synctexDataRef.current && synctexDataRef.current.lineToPdf) {
        const match = synctexDataRef.current.lineToPdf[line];
        if (match && pdfViewerRef.current) {
          pdfViewerRef.current.scrollToPageCoordinate(match.page, match.y);
        }
      }
    });
  };

  const synctexDataRef = useRef(synctexData);
  useEffect(() => { synctexDataRef.current = synctexData; }, [synctexData]);

  const handlePageDoubleClick = (pageNum, pdfX, pdfY) => {
    if (synctexData && synctexData.pdfToLine && synctexData.pdfToLine[pageNum]) {
      const candidates = synctexData.pdfToLine[pageNum];
      let closest = null;
      let minDist = Infinity;
      for (const cand of candidates) {
        const dx = pdfX - cand.x;
        const dy = pdfY - cand.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          closest = cand;
        }
      }
      if (closest) {
        if (editorRef.current) {
          editorRef.current.revealLineInCenter(closest.line);
          editorRef.current.setPosition({ lineNumber: closest.line, column: 1 });
          editorRef.current.focus();
          showToast(`Jumped to line ${closest.line}`);
        }
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (projectFiles.some(f => f.name.toLowerCase() === file.name.toLowerCase())) {
      showToast("File already exists in project!");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const newId = Date.now().toString();
      setProjectFiles(prev => [...prev, {
        id: newId,
        name: file.name,
        content: event.target.result,
        isBinary: true,
      }]);
      setActiveFileId(newId);
      showToast(`Uploaded image: ${file.name}`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (projectMode) {
        if (projectFiles.some(f => f.name.toLowerCase() === file.name.toLowerCase())) {
          showToast("File already exists in project!");
          return;
        }
        const newId = Date.now().toString();
        setProjectFiles(prev => [...prev, {
          id: newId,
          name: file.name,
          content: content,
          isBinary: false,
        }]);
        setActiveFileId(newId);
        showToast(`Imported project file: ${file.name}`);
      } else {
        setCode(content);
        codeRef.current = content;
        showToast(`Loaded: ${file.name}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCreateNewFile = () => {
    if (!newFileNameInput || !newFileNameInput.trim()) return;
    const name = newFileNameInput.trim();
    if (projectFiles.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      showToast("File with this name already exists in project!");
      return;
    }
    const newId = Date.now().toString();
    const defaultContent = name.endsWith(".bib")
      ? "% Bibliography database\n"
      : name.endsWith(".sty") || name.endsWith(".cls")
      ? "% LaTeX package / class\n"
      : `% ${name}\n`;
    setProjectFiles(prev => [...prev, { id: newId, name, content: defaultContent, isBinary: false }]);
    setActiveFileId(newId);
    setShowNewFileModal(false);
    setNewFileNameInput("");
    showToast(`Created file: ${name}`);
  };

  const handleRenameFile = () => {
    if (!renameTargetFile || !renameFileInput || !renameFileInput.trim()) return;
    const newName = renameFileInput.trim();
    if (projectFiles.some(f => f.id !== renameTargetFile.id && f.name.toLowerCase() === newName.toLowerCase())) {
      showToast("File with this name already exists in project!");
      return;
    }
    setProjectFiles(prev => prev.map(f => f.id === renameTargetFile.id ? { ...f, name: newName } : f));
    setShowRenameModal(false);
    setRenameTargetFile(null);
    setRenameFileInput("");
    showToast(`Renamed file to: ${newName}`);
  };

  const handleDeleteFile = () => {
    if (!deleteTargetFile) return;
    const file = deleteTargetFile;
    const newFiles = projectFiles.filter(f => f.id !== file.id);
    setProjectFiles(newFiles);
    if (rootFileId === file.id) {
      const fallbackRoot = newFiles.find(f => !f.isBinary) || newFiles[0];
      if (fallbackRoot) setRootFileId(fallbackRoot.id);
    }
    if (activeFileId === file.id) {
      const fallbackActive = newFiles[0];
      if (fallbackActive) setActiveFileId(fallbackActive.id);
    }
    setShowDeleteConfirm(false);
    setDeleteTargetFile(null);
    showToast(`Deleted: ${file.name}`);
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

  return (
    <div
      ref={mainContainerRef}
      style={{
        height: "100vh",
        minHeight: "100vh",
        background: "var(--bg-dark)",
        color: "#f1f1f6",
        fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ========== DRAG & DROP FULLSCREEN OVERLAY ========== */}
      {isDraggingOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(10, 11, 20, 0.88)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "3px dashed rgba(59, 130, 246, 0.75)",
            margin: "12px",
            borderRadius: "16px",
            boxShadow: "0 0 60px rgba(59, 130, 246, 0.35), inset 0 0 40px rgba(59, 130, 246, 0.15)",
            pointerEvents: "none",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              textAlign: "center",
              maxWidth: 480,
              padding: 32,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(139, 92, 246, 0.25))",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 38,
                boxShadow: "0 10px 30px rgba(59, 130, 246, 0.3)",
              }}
            >
              📥
            </div>

            <div>
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Drop Files Here
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "#94a3b8",
                  lineHeight: 1.6,
                }}
              >
                Drop <strong style={{ color: "#60a5fa" }}>.tex, .bib, .sty, .cls</strong>, images, or assets from File Explorer to import into your project.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 4,
              }}
            >
              {["📄 LaTeX Documents", "📚 Bibliographies (.bib)", "🖼️ Images (.png, .jpg, .svg)", "⚙️ Packages (.sty)"].map(
                (tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "#cbd5e1",
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontWeight: 500,
                    }}
                  >
                    {tag}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== REDESIGNED PREMIUM TOP NAVBAR ========== */}
      <header
        className="glass-card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          borderRadius: 0,
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          background: "rgba(10, 10, 18, 0.45)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          flexShrink: 0,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        }}
      >
        {/* Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img
            src="/TeXForge.png"
            alt="TeXForge Logo"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              objectFit: "cover",
              boxShadow: "0 0 10px rgba(59,130,246,0.2)"
            }}
          />
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fff", letterSpacing: -0.3, fontFamily: "'Outfit', sans-serif" }}>
              TeXForge
            </h1>
            <span style={{ fontSize: 10, color: "var(--primary-solid)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Enterprise Workspace
            </span>
          </div>
        </div>

        {serverOnline && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "5px 12px", borderRadius: 20 }}>
            <span className="status-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>Backend Server Active</span>
          </div>
        )}

        {/* Global actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Clear editor */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="glass-btn"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 500,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            Clear Editor
          </button>

          {/* Import File */}
          <label
            className="glass-btn"
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import File
            <input
              type="file"
              accept=".tex,.bib,.cls,.sty,.html,.css,.js,.txt"
              onChange={handleImportFile}
              style={{ display: "none" }}
            />
          </label>

          {/* Action links */}
          {pdfUrl && (
            <>
              <a
                href={`${apiUrlState}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-btn"
                style={{
                  textDecoration: "none",
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--primary-solid)",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>↗ Open</span>
              </a>
              <a
                href={`${apiUrlState}/download?name=${encodeURIComponent(
                  projectMode
                    ? ((projectFiles.find(f => f.id === activeFileId) || projectFiles[0])?.name?.replace(/\.[^/.]+$/, "") || "document") + ".pdf"
                    : "document.pdf"
                )}`}
                download={
                  projectMode
                    ? ((projectFiles.find(f => f.id === activeFileId) || projectFiles[0])?.name?.replace(/\.[^/.]+$/, "") || "document") + ".pdf"
                    : "document.pdf"
                }
                style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#10b981",
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                title={
                  projectMode
                    ? `Download ${((projectFiles.find(f => f.id === activeFileId) || projectFiles[0])?.name?.replace(/\.[^/.]+$/, "") || "document")}.pdf`
                    : "Download document.pdf"
                }
              >
                <span>⬇ Download</span>
              </a>
            </>
          )}

          {/* Compile button */}
          <button
            onClick={handleCompile}
            disabled={compiling}
            style={{
              background: compiling
                ? "rgba(40, 40, 55, 0.4)"
                : "var(--primary-solid)",
              border: "none",
              color: "#fff",
              padding: "8px 20px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: compiling ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            {compiling ? (
              <>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: "2px solid rgba(255,255,255,0.2)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                    display: "inline-block",
                  }}
                />
                Compiling...
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>▶ Compile</span>
                <span style={{ fontSize: 9, opacity: 0.9, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: 500 }}>Ctrl+Enter</span>
              </div>
            )}
          </button>
        </div>
      </header>

      {/* ========== CLEAR CONFIRMATION MODAL ========== */}
      {showClearConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div className="glass-card" style={{
            padding: "32px",
            maxWidth: 380,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#fff" }}>
              Clear Editor?
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              This will remove all content from the editor. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="glass-btn"
                style={{
                  padding: "8px 24px",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={clearEditor}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  padding: "8px 24px",
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: "pointer",
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

      {/* ========== NEW FILE MODAL ========== */}
      {showNewFileModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div className="glass-card" style={{
            padding: "28px",
            width: "90%",
            maxWidth: 420,
            textAlign: "left",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>📄</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                  Create New File
                </h3>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Add a new document, bibliography, or style sheet
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: "#cbd5e1", fontWeight: 500, marginBottom: 6 }}>
                File Name:
              </label>
              <input
                type="text"
                autoFocus
                value={newFileNameInput}
                onChange={(e) => setNewFileNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateNewFile();
                  if (e.key === "Escape") setShowNewFileModal(false);
                }}
                placeholder="e.g. chapter1.tex, references.bib, custom.sty"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowNewFileModal(false);
                  setNewFileNameInput("");
                }}
                className="glass-btn"
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewFile}
                disabled={!newFileNameInput.trim()}
                style={{
                  background: newFileNameInput.trim() ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  padding: "8px 20px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: newFileNameInput.trim() ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== RENAME FILE MODAL ========== */}
      {showRenameModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div className="glass-card" style={{
            padding: "28px",
            width: "90%",
            maxWidth: 420,
            textAlign: "left",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>✏️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                  Rename File
                </h3>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Current name: {renameTargetFile?.name}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: "#cbd5e1", fontWeight: 500, marginBottom: 6 }}>
                New File Name:
              </label>
              <input
                type="text"
                autoFocus
                value={renameFileInput}
                onChange={(e) => setRenameFileInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameFile();
                  if (e.key === "Escape") setShowRenameModal(false);
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameTargetFile(null);
                  setRenameFileInput("");
                }}
                className="glass-btn"
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameFile}
                disabled={!renameFileInput.trim() || renameFileInput.trim() === renameTargetFile?.name}
                style={{
                  background: renameFileInput.trim() && renameFileInput.trim() !== renameTargetFile?.name
                    ? "linear-gradient(135deg, #3b82f6, #8b5cf6)"
                    : "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  padding: "8px 20px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: renameFileInput.trim() && renameFileInput.trim() !== renameTargetFile?.name ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== DELETE FILE CONFIRM MODAL ========== */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div className="glass-card" style={{
            padding: "28px",
            maxWidth: 380,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#fff" }}>
              Delete File?
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              Are you sure you want to delete <strong style={{ color: "#f87171" }}>{deleteTargetFile?.name}</strong> from this project?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTargetFile(null);
                }}
                className="glass-btn"
                style={{
                  padding: "8px 22px",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFile}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  padding: "8px 22px",
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="glass-card" style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          color: "#d946ef",
          padding: "12px 28px",
          borderRadius: 16,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 300,
          boxShadow: "0 8px 32px rgba(139, 92, 246, 0.15)",
          animation: "toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        }}>
          {toastMessage}
        </div>
      )}

      {/* Suggestions banner */}
      {mode === 'latex' && suggestions && suggestions.length > 0 && (
        <div
          className="glass-card"
          style={{
            margin: "12px 24px 0",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            border: "1px solid rgba(245, 158, 11, 0.2)",
            boxShadow: "0 8px 32px rgba(245, 158, 11, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                background: "rgba(245, 158, 11, 0.12)",
                color: "#f59e0b",
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}>
                ⚠ ISSUES DETECTED
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                {suggestions.length} compilation issues parsed
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={applyAllFixes}
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#10b981",
                  padding: "5px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ✓ Fix All Issues
              </button>
              <button
                onClick={() => { setSuggestions(null); doCompile(); }}
                className="glass-btn"
                style={{
                  padding: "5px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Ignore & Compile
              </button>
              <button
                onClick={() => setSuggestions(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#475569",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 150, overflowY: "auto" }}>
            {suggestions.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(10,10,18,0.25)",
                  border: "1px solid rgba(255,255,255,0.02)",
                  borderRadius: 8,
                  padding: "8px 14px",
                }}
              >
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: s.type === "engine" ? "#ef4444" : "#f59e0b", fontSize: 14 }}>●</span>
                  <span style={{ fontSize: 12, color: "#cbd5e1" }}>{s.message}</span>
                </div>
                <button
                  onClick={() => applyFix(s)}
                  style={{
                    background: s.type === "engine" ? "rgba(239, 68, 68, 0.12)" : "rgba(139, 92, 246, 0.12)",
                    border: "1px solid " + (s.type === "engine" ? "rgba(239, 68, 68, 0.25)" : "rgba(139, 92, 246, 0.25)"),
                    color: s.type === "engine" ? "#f87171" : "#c084fc",
                    padding: "4px 12px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {s.fix}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar (glass) - Mobile only */}
      <div
        className="studio-tabbar"
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
              padding: "12px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab
                ? "2px solid var(--primary-solid)"
                : "2px solid transparent",
              color: activeTab === tab ? "#cbd5e1" : "#475569",
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

      {/* Main content body containing left sidebar and workspace */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0, width: "100%" }}>
        
        {/* ========== SLICK LEFT SIDEBAR PANEL ========== */}
        <aside
          className="glass-card"
          style={{
            width: 280,
            flexShrink: 0,
            borderRadius: 0,
            borderTop: "none",
            borderLeft: "none",
            borderBottom: "none",
            borderRight: "1px solid rgba(255, 255, 255, 0.04)",
            background: "rgba(10, 10, 18, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            padding: "24px 18px",
            overflowY: "auto",
          }}
        >
          {/* Project Mode Toggle */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 10, color: "var(--primary-solid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                Project Mode
              </label>
              <span style={{ fontSize: 9, color: projectMode ? "#10b981" : "#52525b", fontWeight: 700 }}>
                {projectMode ? "PROJECT" : "BASIC"}
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.04)", padding: "10px 14px", borderRadius: 10, transition: "all 0.2s" }}>
              <input
                type="checkbox"
                checked={projectMode}
                onChange={(e) => {
                  setProjectMode(e.target.checked);
                  showToast(e.target.checked ? "Project Mode Enabled" : "Basic Mode Enabled");
                }}
                style={{
                  cursor: "pointer",
                  accentColor: "var(--primary-solid)",
                  width: 14,
                  height: 14,
                }}
              />
              <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 500 }}>Enable Multi-File</span>
            </label>
          </div>

          {/* File Explorer (Project Mode Only) */}
          {projectMode && (
            <div className="glass-card" style={{ padding: 12, background: "rgba(255,255,255,0.01)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: "var(--primary-solid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  Project Files
                </span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {/* Select and Import File from Disk */}
                  <label
                    className="glass-btn"
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                    title="Select and import an existing file from your computer (.tex, .bib, .sty, .cls, .txt, etc.)"
                  >
                    + File
                    <input
                      type="file"
                      accept=".tex,.bib,.sty,.cls,.txt,.csv,.md,.json,.dtx,.ins,text/*"
                      onChange={handleImportFile}
                      style={{ display: "none" }}
                    />
                  </label>

                  {/* Create New Blank File */}
                  <button
                    onClick={() => {
                      setNewFileNameInput("");
                      setShowNewFileModal(true);
                    }}
                    className="glass-btn"
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                    title="Create a new blank file in the project"
                  >
                    + New
                  </button>

                  {/* Upload Image */}
                  <label
                    className="glass-btn"
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                    title="Upload an image file (.png, .jpg, .svg, .pdf)"
                  >
                    + Image
                    <input
                      type="file"
                      accept="image/*,.png,.jpg,.jpeg,.svg,.pdf,.eps"
                      onChange={handleImageUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                {projectFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => {
                      setActiveFileId(file.id);
                      if (editorRef.current && monacoRef.current) {
                        const model = editorRef.current.getModel();
                        monacoRef.current.editor.setModelMarkers(model, "latex-diagnostics", []);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: activeFileId === file.id ? "rgba(59, 130, 246, 0.12)" : "rgba(255, 255, 255, 0.02)",
                      borderRadius: 6,
                      padding: "5px 8px",
                      border: "1px solid " + (activeFileId === file.id ? "rgba(59, 130, 246, 0.4)" : "rgba(255, 255, 255, 0.04)"),
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, overflow: "hidden" }}>
                      <span style={{ fontSize: 13, display: "flex", alignItems: "center", opacity: activeFileId === file.id ? 1 : 0.6 }}>
                        {file.isBinary ? "🖼️" : "📄"}
                      </span>

                      <span
                        style={{
                          color: activeFileId === file.id ? "#ffffff" : "#94a3b8",
                          fontSize: 12,
                          fontWeight: activeFileId === file.id ? 600 : 400,
                          textAlign: "left",
                          flex: 1,
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {file.name}
                      </span>

                      {activeFileId === file.id && (
                        <span style={{
                          fontSize: 9,
                          background: "rgba(59, 130, 246, 0.25)",
                          color: "#60a5fa",
                          padding: "1px 5px",
                          borderRadius: 4,
                          fontWeight: 600,
                          letterSpacing: 0.3,
                          textTransform: "uppercase"
                        }}>
                          Target
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTargetFile(file);
                          setRenameFileInput(file.name);
                          setShowRenameModal(true);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#71717a",
                          cursor: "pointer",
                          fontSize: 10,
                          padding: "2px 4px",
                        }}
                        title="Rename file"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetFile(file);
                          setShowDeleteConfirm(true);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: 11,
                          padding: "2px 4px",
                        }}
                        title="Delete file"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workspace mode (LaTeX vs HTML) */}
          <div>
            <label style={{ fontSize: 10, color: "var(--primary-solid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
              Workspace Mode
            </label>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, padding: 3 }}>
              <button
                onClick={() => handleModeChange('latex')}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: "none",
                  background: mode === 'latex' ? "rgba(59, 130, 246, 0.12)" : "transparent",
                  color: mode === 'latex' ? "var(--primary-solid)" : "#64748b",
                  fontSize: 11,
                  fontWeight: mode === 'latex' ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                📄 LaTeX
              </button>
              <button
                onClick={() => handleModeChange('html')}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 8,
                  border: "none",
                  background: mode === 'html' ? "rgba(59, 130, 246, 0.12)" : "transparent",
                  color: mode === 'html' ? "var(--primary-solid)" : "#64748b",
                  fontSize: 11,
                  fontWeight: mode === 'html' ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                🌐 HTML
              </button>
            </div>
          </div>

          {/* Engine selector – LaTeX only */}
          {mode === 'latex' && (
            <div>
              <label style={{ fontSize: 10, color: "var(--primary-solid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
                Compiler Engine
              </label>
              <select
                value={compileEngine}
                onChange={(e) => {
                  setCompileEngine(e.target.value);
                  engineRef.current = e.target.value;
                }}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  color: "#cbd5e1",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="pdflatex" style={{ background: "#121216", color: "#fafafa" }}>pdfLaTeX (Standard)</option>
                <option value="xelatex" style={{ background: "#121216", color: "#fafafa" }}>XeLaTeX (Unicode/Bengali)</option>
                <option value="lualatex" style={{ background: "#121216", color: "#fafafa" }}>LuaLaTeX (Unicode/Fonts)</option>
              </select>
            </div>
          )}

          {/* Quick template loader */}
          <div>
            <label style={{ fontSize: 10, color: "var(--primary-solid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
              Quick Templates
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {mode === 'latex' ? (
                Object.keys(LATEX_TEMPLATES).map((key) => (
                  <button
                    key={key}
                    onClick={() => loadTemplate(key)}
                    className="glass-btn"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid " + (selectedTemplate === key ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.03)"),
                      background: selectedTemplate === key ? "rgba(59, 130, 246, 0.08)" : "rgba(255, 255, 255, 0.01)",
                      color: selectedTemplate === key ? "var(--primary-solid)" : "#94a3b8",
                      fontSize: 12,
                      fontWeight: selectedTemplate === key ? 600 : 500,
                    }}
                  >
                    <span>{latexTemplateIcons[key]}</span>
                    <span>{latexTemplateLabels[key]}</span>
                  </button>
                ))
              ) : (
                Object.keys(HTML_TEMPLATES).map((key) => (
                  <button
                    key={key}
                    onClick={() => loadTemplate(key)}
                    className="glass-btn"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid " + (selectedTemplate === key ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.03)"),
                      background: selectedTemplate === key ? "rgba(59, 130, 246, 0.08)" : "rgba(255, 255, 255, 0.01)",
                      color: selectedTemplate === key ? "var(--primary-solid)" : "#94a3b8",
                      fontSize: 12,
                      fontWeight: selectedTemplate === key ? 600 : 500,
                    }}
                  >
                    <span>{htmlTemplateIcons[key]}</span>
                    <span>{htmlTemplateLabels[key]}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Stats footer block */}
          <div style={{ marginTop: "auto", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
            <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
              Document Stats
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
              <span>Lines:</span>
              <span style={{ fontWeight: 600, color: "#fff" }}>{lineCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
              <span>Characters:</span>
              <span style={{ fontWeight: 600, color: "#fff" }}>{code.length}</span>
            </div>
          </div>
        </aside>

        {/* Workspace split view */}
        <div className="studio-workspace" style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          
          {/* Editor pane */}
          <div
            className="studio-editor-pane"
            style={{
              width: "100%",
              flex: "1 1 100%",
              display: activeTab === "editor" ? "flex" : "none",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
              {projectMode && activeFile.isBinary ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b0b0f", gap: 16, padding: 20 }}>
                  <img
                    src={activeFile.content}
                    alt={activeFile.name}
                    style={{ maxHeight: "60%", maxWidth: "85%", objectFit: "contain", borderRadius: 8, border: "1px solid var(--border-glass)", boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}
                  />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>{activeFile.name}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 4 }}>Binary Image Asset</div>
                    <div style={{ display: "inline-block", background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 6, padding: "8px 12px", color: "var(--primary-solid)", fontSize: 12, marginTop: 16, fontFamily: "monospace" }}>
                      \includegraphics{"{"}{activeFile.name}{"}"}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, position: "relative", height: "100%" }}>
                  {!code && (
                    <div
                      style={{
                        position: "absolute",
                        left: 60,
                        top: 8,
                        color: "rgba(255, 255, 255, 0.18)",
                        fontFamily: "Fira Code, JetBrains Mono, source-code-pro, Menlo, Monaco, Consolas, monospace",
                        fontSize: 13,
                        lineHeight: "20px",
                        pointerEvents: "none",
                        whiteSpace: "pre",
                        zIndex: 5,
                      }}
                    >
                      {mode === 'latex' ? (
                        `\\documentclass{article}\n\\begin{document}\n  % Start typing your LaTeX code here...\n\\end{document}`
                      ) : (
                        `<!DOCTYPE html>\n<html>\n<body>\n  <!-- Start typing your HTML code here... -->\n</body>\n</html>`
                      )}
                    </div>
                  )}
                  <Editor
                    height="100%"
                    language={mode === 'latex' ? 'latex' : 'html'}
                    theme="vs-dark"
                    value={code}
                    onChange={(val) => {
                      setCode(val || "");
                      codeRef.current = val || "";
                    }}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineHeight: 20,
                      fontFamily: "Fira Code, JetBrains Mono, source-code-pro, Menlo, Monaco, Consolas, monospace",
                      automaticLayout: true,
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible',
                        useShadows: false,
                        verticalScrollbarSize: 5,
                        horizontalScrollbarSize: 5,
                      },
                      suggestOnTriggerCharacters: true,
                      wordWrap: "on",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Preview pane */}
          <div
            className="studio-preview-pane"
            style={{
              width: "100%",
              flex: "1 1 100%",
              display: activeTab === "preview" ? "flex" : "none",
              flexDirection: "column",
              background: "#030307",
            }}
          >
            {error && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.06)",
                  borderBottom: "1px solid rgba(239, 68, 68, 0.15)",
                  padding: 16,
                  maxHeight: showFullLog ? 450 : 250,
                  overflow: "auto",
                  display: "flex",
                  flexDirection: "column",
                  transition: "max-height 0.25s ease-in-out",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "#ef4444",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                    }}>
                      ✕ COMPILATION ERROR
                    </span>
                    {compiledWith && (
                      <span style={{ fontSize: 11, color: "#64748b" }}>engine: {compiledWith}</span>
                    )}
                  </div>
                  {compileLog && (
                    <button
                      onClick={() => setShowFullLog(!showFullLog)}
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#a0a0b0",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        cursor: "pointer",
                        fontWeight: "500",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = "rgba(255, 255, 255, 0.08)";
                        e.target.style.color = "#cbd5e1";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = "rgba(255, 255, 255, 0.04)";
                        e.target.style.color = "#a0a0b0";
                      }}
                    >
                      {showFullLog ? "Hide Full Log" : "Show Full Log"}
                    </button>
                  )}
                </div>

                {!showFullLog ? (
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
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Full Build Output (document.log)</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(compileLog);
                          showToast("Logs copied to clipboard!");
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--primary-solid)",
                          fontSize: 11,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Copy Log
                      </button>
                    </div>
                    <pre style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      background: "#09090b",
                      border: "1px solid rgba(255,255,255,0.03)",
                      borderRadius: 6,
                      padding: 12,
                      maxHeight: 300,
                      overflow: "auto",
                      whiteSpace: "pre",
                      wordBreak: "normal",
                      margin: 0,
                      fontFamily: "Fira Code, JetBrains Mono, monospace",
                      lineHeight: 1.5,
                    }}>
                      {compileLog}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* SKELETON PRELOADING FOR PDF VIEW */}
            {compiling ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "30px", overflow: "hidden" }}>
                {/* Visual Skeleton Shimmer page representation */}
                <div className="glass-card shimmer-bg" style={{ flex: 1, padding: 40, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ height: 28, width: "60%", background: "rgba(255,255,255,0.06)", borderRadius: 6 }} />
                  <div style={{ height: 14, width: "30%", background: "rgba(255,255,255,0.04)", borderRadius: 6, marginBottom: 20 }} />
                  <div style={{ height: 12, width: "90%", background: "rgba(255,255,255,0.03)", borderRadius: 4 }} />
                  <div style={{ height: 12, width: "95%", background: "rgba(255,255,255,0.03)", borderRadius: 4 }} />
                  <div style={{ height: 12, width: "88%", background: "rgba(255,255,255,0.03)", borderRadius: 4 }} />
                  <div style={{ height: 12, width: "92%", background: "rgba(255,255,255,0.03)", borderRadius: 4, marginBottom: 20 }} />
                  <div style={{ height: 150, width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8 }} />
                </div>
                {/* Floating spinner centered overlay */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(3,3,7,0.45)",
                  backdropFilter: "blur(4px)",
                }}>
                  <div className="neon-spinner" />
                  <span style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginTop: 16, letterSpacing: 0.5 }}>
                    Compiling Source...
                  </span>
                </div>
              </div>
            ) : pdfUrl ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    background: "rgba(10,10,18,0.2)",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#10b981", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px rgba(16,185,129,0.3)" }} />
                    Active: {compiledWith} build
                  </span>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <CustomPDFViewer
                    url={pdfUrl}
                    synctexData={synctexData}
                    onPageDoubleClick={handlePageDoubleClick}
                    viewerRef={pdfViewerRef}
                  />
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
                    gap: 16,
                    color: "#475569",
                  }}
                >
                  <div style={{
                    fontSize: 64,
                    filter: "grayscale(1) brightness(0.6)",
                  }}>
                    {mode === 'latex' ? '📄' : '🌐'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, textAlign: "center", color: "#64748b" }}>
                    Workspace is ready. Press <strong style={{ color: "var(--primary-solid)" }}>Compile</strong> to generate preview.
                  </div>
                  <div style={{ fontSize: 10, color: "#334155" }}>
                    Server Node: {apiUrlState}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ========== GLOBAL STYLES ========== */}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        ::selection { background: rgba(59, 130, 246, 0.2); }

        @media (min-width: 1024px) {
          .studio-tabbar {
            display: none !important;
          }
          .studio-editor-pane {
            display: flex !important;
            width: 50% !important;
            flex: 1 1 50% !important;
            border-right: 1px solid rgba(255,255,255,0.04) !important;
          }
          .studio-preview-pane {
            display: flex !important;
            width: 50% !important;
            flex: 1 1 50% !important;
          }
        }
      `}</style>
    </div>
  );
}