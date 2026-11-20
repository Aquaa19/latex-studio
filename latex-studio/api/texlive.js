// Vercel Serverless Function: POST /api/texlive
// Proxies LaTeX compilation to texlive.net (Node runtime, zero external dependencies)

function sendJson(res, statusCode, data, extraHeaders = {}) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.setHeader(k, v);
    }
    return res.status(statusCode).json(data);
  }
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendBuffer(res, statusCode, buffer, contentType, extraHeaders = {}) {
  if (typeof res.status === "function" && typeof res.send === "function") {
    res.setHeader("Content-Type", contentType);
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.setHeader(k, v);
    }
    return res.status(statusCode).send(buffer);
  }
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": String(buffer.length),
    ...extraHeaders,
  });
  res.end(buffer);
}

const BENGALI_FONT_REGEX = /(?:Vrinda|Kalpurush|Nirmala\s+UI|Noto\s+(?:Serif\s+|Sans\s+)?Bengali)/i;

function rewriteBengaliFonts(source) {
  let rewritten = false;
  const targetPattern = /\\(setmainfont|setsansfont|setmonofont|(?:new|set)fontfamily\s*\\[a-zA-Z]+)(?:\[([^\]]*)\])?\{([^}]*)\}(?:\[([^\]]*)\])?/gi;

  let newSource = source.replace(targetPattern, (match, cmd, opt1, fontName, opt2) => {
    if (BENGALI_FONT_REGEX.test(fontName)) {
      rewritten = true;
      let opts = [opt1, opt2].filter(Boolean).join(",");
      if (!/Script\s*=\s*Bengali/i.test(opts)) {
        opts = opts ? `${opts},Script=Bengali` : "Script=Bengali";
      }
      if (!/BoldFont/i.test(opts)) {
        opts = `${opts},BoldFont=FreeSerif`;
      }
      if (!/BoldFeatures/i.test(opts)) {
        opts = `${opts},BoldFeatures={FakeBold=2.5}`;
      }
      return `\\${cmd}{FreeSerif}[${opts}]`;
    }
    return match;
  });

  return { code: newSource, rewritten };
}

function extractFirstError(log) {
  if (!log || typeof log !== "string") return "LaTeX compilation error";
  const lines = log.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("!")) {
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const next = lines[j].trim();
        if (/^l\.\d+/.test(next)) {
          return `${line}\n${next}`;
        }
      }
      return line;
    }
  }
  return "LaTeX compilation error";
}

export default async function handler(req, res) {
  // CORS support
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "X-Texlive-Notice");

  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { success: false, error: "Method not allowed. Use POST." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { success: false, error: "Invalid JSON body." });
    }
  } else if (!body) {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (raw.length > 4.5 * 1024 * 1024) {
        return sendJson(res, 413, { success: false, error: "Payload exceeds 4 MB size limit." });
      }
      body = JSON.parse(raw);
    } catch (err) {
      return sendJson(res, 400, { success: false, error: "Failed to read request body: " + err.message });
    }
  }

  const { code, engine = "pdflatex", files, mainName = "document.tex" } = body || {};

  if (!code || typeof code !== "string") {
    return sendJson(res, 400, { success: false, error: "Missing required 'code' string in request body." });
  }

  // Reject binary files
  if (files && Array.isArray(files)) {
    for (const f of files) {
      if (f) {
        if (f.isBinary) {
          return sendJson(res, 400, {
            success: false,
            error: `Binary file "${f.path || f.name}" is not supported by texlive.net. Use remote or desktop compiler.`,
          });
        }
        if (typeof f.content === "string" && f.content.startsWith("data:") && f.content.includes(";base64,")) {
          return sendJson(res, 400, {
            success: false,
            error: `Binary data asset "${f.path || f.name}" is not supported by texlive.net. Use remote or desktop compiler.`,
          });
        }
      }
    }
  }

  // Check 4MB size limit
  let totalBytes = Buffer.byteLength(code, "utf-8");
  if (files && Array.isArray(files)) {
    for (const f of files) {
      if (f && typeof f.content === "string") {
        totalBytes += Buffer.byteLength(f.content, "utf-8");
      }
    }
  }
  if (totalBytes > 4 * 1024 * 1024) {
    return sendJson(res, 413, { success: false, error: "Project payload exceeds 4 MB size limit." });
  }

  let codeToCompile = code;
  let fontNotice = null;

  if (engine === "xelatex" || engine === "lualatex") {
    const rewriteResult = rewriteBengaliFonts(codeToCompile);
    if (rewriteResult.rewritten) {
      codeToCompile = rewriteResult.code;
      fontNotice = "Bengali font substituted with FreeSerif [Script=Bengali,BoldFont=FreeSerif,BoldFeatures={FakeBold=2.5}] for texlive.net cloud compatibility.";
    }
  }

  try {
    const form = new FormData();
    form.append("filecontents[]", codeToCompile);
    form.append("filename[]", mainName);

    if (files && Array.isArray(files)) {
      for (const f of files) {
        if (f && f.path && typeof f.content === "string") {
          let fileContent = f.content;
          if (engine === "xelatex" || engine === "lualatex") {
            const resSub = rewriteBengaliFonts(fileContent);
            if (resSub.rewritten) {
              fileContent = resSub.code;
              fontNotice = fontNotice || "Bengali font substituted with FreeSerif [Script=Bengali,BoldFont=FreeSerif,BoldFeatures={FakeBold=2.5}] for texlive.net cloud compatibility.";
            }
          }
          form.append("filecontents[]", fileContent);
          form.append("filename[]", f.path);
        }
      }
    }

    form.append("engine", engine);
    form.append("return", "pdf");

    const response = await fetch("https://texlive.net/cgi-bin/latexcgi", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    let targetUrl = null;
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get("location");
      if (!loc) {
        return sendJson(res, 502, { success: false, error: "texlive.net redirect missing location header." });
      }
      targetUrl = new URL(loc, "https://texlive.net").href;
    } else if (response.ok) {
      targetUrl = response.url;
    } else {
      return sendJson(res, 502, { success: false, error: `Upstream compiler error (${response.status}).` });
    }

    const resultRes = await fetch(targetUrl);
    const contentType = resultRes.headers.get("content-type") || "";

    if (contentType.includes("application/pdf")) {
      const arrayBuf = await resultRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const extraHeaders = {};
      if (fontNotice) {
        extraHeaders["X-Texlive-Notice"] = fontNotice;
      }
      return sendBuffer(res, 200, buffer, "application/pdf", extraHeaders);
    }

    // Text error log
    const log = await resultRes.text();
    const firstError = extractFirstError(log);
    return sendJson(res, 422, {
      success: false,
      error: firstError,
      log,
    });
  } catch (err) {
    return sendJson(res, 502, {
      success: false,
      error: "Upstream compilation request failed: " + err.message,
    });
  }
}
