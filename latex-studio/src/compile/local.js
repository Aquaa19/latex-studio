// Local (desktop / self-hosted) compiler backend

export function getLocalBaseUrl() {
  if (typeof window !== "undefined") {
    const isElectron = Boolean(window.electronAPI?.isElectron);
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    if (isElectron || isLocalHost) {
      return window.location.origin;
    }
  }
  return import.meta.env?.VITE_LOCAL_COMPILER_URL || (typeof globalThis !== "undefined" ? globalThis.process?.env?.VITE_LOCAL_COMPILER_URL : null) || null;
}

export const localBackend = {
  id: "local",
  label: "Local Server",

  getBaseUrl() {
    return getLocalBaseUrl();
  },

  isEnabled() {
    return Boolean(getLocalBaseUrl());
  },

  supports() {
    // Supports everything: LaTeX, HTML, binary assets
    return true;
  },

  async health(signal) {
    const base = getLocalBaseUrl();
    if (!base) return "offline";
    try {
      const res = await fetch(`${base}/health`, {
        mode: "cors",
        signal,
      });
      return res.ok ? "online" : "offline";
    } catch {
      return "offline";
    }
  },

  async compile({ mainName, mainCode, files, engine, mode }, signal) {
    const base = getLocalBaseUrl();
    if (!base) {
      return {
        ok: false,
        error: "Local compiler is not configured or reachable.",
        isNetworkOr5xx: true,
      };
    }

    const url = mode === "latex" ? `${base}/compile` : `${base}/compile-html`;
    const filesData = files && files.length
      ? files.map((f) => ({
          path: f.path || f.name,
          content: f.content,
          isBinary: Boolean(f.isBinary),
        }))
      : null;

    const body = mode === "latex"
      ? JSON.stringify({ code: mainCode, engine, files: filesData, mainName })
      : JSON.stringify({ html: mainCode });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Server returned status ${res.status}` }));
        return {
          ok: false,
          isLatexError: res.status === 422,
          isNetworkOr5xx: res.status >= 500,
          error: errData.error || "Compilation failed",
          log: errData.log || null,
        };
      }

      const data = await res.json();
      if (data.success) {
        const timestamp = Date.now();
        const pdfRes = await fetch(`${base}/pdf?v=${data.version}&t=${timestamp}`, { signal });
        if (!pdfRes.ok) {
          return {
            ok: false,
            isNetworkOr5xx: true,
            error: "Failed to download generated PDF from local compiler.",
          };
        }
        const pdfBlob = await pdfRes.blob();
        return {
          ok: true,
          pdfBlob,
          synctex: data.synctex || null,
        };
      } else {
        return {
          ok: false,
          isLatexError: true,
          error: data.error || "LaTeX compilation failed",
          log: data.log || null,
        };
      }
    } catch (err) {
      return {
        ok: false,
        isNetworkOr5xx: true,
        error: `Could not connect to local compiler at ${base}. ${err.message}`,
      };
    }
  },
};
