// Remote (Render / self-hosted cloud) backend

export function getRemoteBaseUrl() {
  return import.meta.env?.VITE_API_BASE_URL || (typeof globalThis !== "undefined" ? globalThis.process?.env?.VITE_API_BASE_URL : null) || null;
}

export const remoteBackend = {
  id: "remote",
  label: "Remote Compiler",

  getBaseUrl() {
    return getRemoteBaseUrl();
  },

  isEnabled() {
    return Boolean(getRemoteBaseUrl());
  },

  supports() {
    // Supports everything (HTML-to-PDF with Puppeteer, binary assets, and all LaTeX engines)
    return true;
  },

  async health(signal) {
    const base = getRemoteBaseUrl();
    if (!base) return "offline";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const combinedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    try {
      const res = await fetch(`${base}/health`, {
        mode: "cors",
        signal: combinedSignal,
      });
      clearTimeout(timeout);
      return res.ok ? "online" : "offline";
    } catch {
      clearTimeout(timeout);
      return "offline";
    }
  },

  async compile({ mainName, mainCode, files, engine, mode }, signal) {
    const base = getRemoteBaseUrl();
    if (!base) {
      return {
        ok: false,
        isNetworkOr5xx: true,
        error: "Remote compiler URL (VITE_API_BASE_URL) is not configured.",
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const combinedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

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
        signal: combinedSignal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Remote returned status ${res.status}` }));
        return {
          ok: false,
          isLatexError: res.status === 422,
          isNetworkOr5xx: res.status >= 500,
          error: errData.error || "Compilation failed on remote compiler",
          log: errData.log || null,
        };
      }

      const data = await res.json();
      if (data.success) {
        const timestamp = Date.now();
        const pdfRes = await fetch(`${base}/pdf?v=${data.version}&t=${timestamp}`, { signal: combinedSignal });
        if (!pdfRes.ok) {
          return {
            ok: false,
            isNetworkOr5xx: true,
            error: "Failed to download generated PDF from remote server.",
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
          error: data.error || "Remote compilation failed",
          log: data.log || null,
        };
      }
    } catch (err) {
      clearTimeout(timeout);
      return {
        ok: false,
        isNetworkOr5xx: true,
        error: `Could not connect to remote compiler at ${base}. ${err.message}`,
      };
    }
  },
};
