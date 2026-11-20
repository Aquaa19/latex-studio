// TeX Live (texlive.net cloud) compiler backend via /api/texlive proxy

export const texliveBackend = {
  id: "texlive",
  label: "TeX Live (Cloud)",

  isEnabled() {
    return true;
  },

  supports({ mode, hasBinaryFiles }) {
    // TeX Live only supports standard LaTeX and text-based source files
    if (mode !== "latex") return false;
    if (hasBinaryFiles) return false;
    return true;
  },

  async health() {
    // Cloud function is serverless and on-demand
    return "online";
  },

  async compile({ mainName, mainCode, files, engine }, signal) {
    const filesData = files && files.length
      ? files.map((f) => ({
          path: f.path || f.name,
          content: f.content,
          isBinary: Boolean(f.isBinary),
        }))
      : null;

    try {
      const res = await fetch("/api/texlive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: mainCode,
          engine: engine || "pdflatex",
          files: filesData,
          mainName: mainName || "document.tex",
        }),
        signal,
      });

      if (res.status === 200) {
        const pdfBlob = await res.blob();
        const notice = res.headers.get("x-texlive-notice");
        return {
          ok: true,
          pdfBlob,
          synctex: null,
          notice: notice || null,
        };
      }

      if (res.status === 422) {
        const data = await res.json().catch(() => ({ error: "LaTeX syntax error" }));
        return {
          ok: false,
          isLatexError: true,
          error: data.error || "LaTeX compilation error",
          log: data.log || null,
        };
      }

      if (res.status === 400 || res.status === 413) {
        const data = await res.json().catch(() => ({ error: `Request rejected (${res.status})` }));
        return {
          ok: false,
          isLatexError: false,
          isNetworkOr5xx: false,
          error: data.error || `Request rejected (${res.status})`,
        };
      }

      const errData = await res.json().catch(() => ({ error: `texlive proxy failed with status ${res.status}` }));
      return {
        ok: false,
        isNetworkOr5xx: true,
        error: errData.error || `texlive proxy error (${res.status})`,
        log: errData.log || null,
      };
    } catch (err) {
      return {
        ok: false,
        isNetworkOr5xx: true,
        error: `Could not connect to /api/texlive: ${err.message}`,
      };
    }
  },
};
