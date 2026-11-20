// WASM client-side compiler backend (optional, behind VITE_ENABLE_WASM=true)

export const wasmBackend = {
  id: "wasm",
  label: "WebAssembly (Client)",

  isEnabled() {
    return (import.meta.env?.VITE_ENABLE_WASM || (typeof globalThis !== "undefined" ? globalThis.process?.env?.VITE_ENABLE_WASM : null)) === "true";
  },

  supports({ mode, engine, hasBinaryFiles }) {
    if (!this.isEnabled()) return false;
    // WASM only supports pdfLaTeX and text-based documents
    if (mode !== "latex") return false;
    if (engine && engine !== "pdflatex") return false;
    if (hasBinaryFiles) return false;
    return true;
  },

  async health() {
    return this.isEnabled() ? "online" : "offline";
  },

  async compile() {
    return {
      ok: false,
      error: "WASM compiler is currently in preview. Use texlive or remote compiler.",
    };
  },
};
