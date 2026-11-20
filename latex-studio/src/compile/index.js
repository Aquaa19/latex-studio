// Compiler abstraction layer and selection dispatcher

import { localBackend, getLocalBaseUrl } from "./local.js";
import { texliveBackend } from "./texlive.js";
import { remoteBackend } from "./remote.js";
import { wasmBackend } from "./wasm.js";

export const backends = {
  local: localBackend,
  texlive: texliveBackend,
  remote: remoteBackend,
  wasm: wasmBackend,
};

export const backendHealthStatus = {
  local: "online",
  texlive: "online",
  remote: "online",
  wasm: "online",
};

export function setBackendHealthStatus(backendId, status) {
  if (backendId && status) {
    backendHealthStatus[backendId] = status;
  }
}

export function extractFirstError(log) {
  if (!log || typeof log !== "string") return null;
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
  return null;
}

export function isElectronOrLocalhost() {
  if (typeof window === "undefined") return false;

  // Dev-only override: ?backend=... or VITE_FORCE_WEB_BACKENDS=true honored only when import.meta.env.DEV
  if (import.meta.env?.DEV) {
    if (import.meta.env?.VITE_FORCE_WEB_BACKENDS === "true" || import.meta.env?.VITE_FORCE_WEB_BACKENDS === true) {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    const backendParam = params.get("backend");
    if (backendParam && backendParam !== "local") {
      return false;
    }
  }

  const isElectron = Boolean(window.electronAPI?.isElectron);
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1";
  return isElectron || isLocalHost;
}

export function getBackendCandidates(ctx = {}) {
  // If ?backend=<id> specified in DEV mode, honor it directly
  if (import.meta.env?.DEV && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const reqBackend = params.get("backend");
    if (reqBackend && backends[reqBackend]) {
      const b = backends[reqBackend];
      if (b.isEnabled() && b.supports(ctx)) {
        return [b];
      }
    }
  }

  // Desktop / self-hosted: Electron or localhost uses local only
  if (isElectronOrLocalhost()) {
    if (localBackend.supports(ctx)) {
      return [localBackend];
    }
    return [];
  }

  // Web environment: order from VITE_COMPILE_BACKENDS (default: wasm,texlive,remote)
  const envOrder = import.meta.env?.VITE_COMPILE_BACKENDS || (typeof globalThis !== "undefined" ? globalThis.process?.env?.VITE_COMPILE_BACKENDS : null) || "wasm,texlive,remote";
  const ids = envOrder
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const candidates = [];
  for (const id of ids) {
    const backend = backends[id];
    if (backend && backend.isEnabled() && backend.supports(ctx)) {
      candidates.push(backend);
    }
  }

  // Skip remote when it's known offline, unless it's the only candidate
  if (candidates.length > 1) {
    const filtered = candidates.filter((b) => {
      if (b.id === "remote" && backendHealthStatus.remote === "offline") {
        return false;
      }
      return true;
    });
    if (filtered.length > 0) {
      return filtered;
    }
  }

  return candidates;
}

export function pickBackend(ctx = {}) {
  const list = getBackendCandidates(ctx);
  if (list.length > 0) {
    return list[0];
  }
  // Fallback to local if configured
  if (localBackend.isEnabled() && localBackend.supports(ctx)) {
    return localBackend;
  }
  return null;
}

export async function compileDocument(ctx, signal) {
  const candidates = getBackendCandidates(ctx);

  if (!candidates || candidates.length === 0) {
    if (ctx.mode === "html") {
      return {
        ok: false,
        error: "HTML export needs the remote/desktop compiler",
      };
    }
    if (ctx.hasBinaryFiles) {
      return {
        ok: false,
        error: "Projects with binary assets require the remote or desktop compiler",
      };
    }
    return {
      ok: false,
      error: "No available compiler backend supports this configuration.",
    };
  }

  let lastError = null;
  for (const backend of candidates) {
    try {
      const result = await backend.compile(ctx, signal);

      if (result.ok) {
        return {
          ...result,
          backend,
        };
      }

      // DO NOT fall through on LaTeX syntax error (422)
      if (result.isLatexError) {
        if (!result.error || result.error === "Compilation failed" || result.error === "LaTeX compilation error") {
          const extracted = extractFirstError(result.log);
          if (extracted) {
            result.error = extracted;
          }
        }
        return {
          ...result,
          backend,
        };
      }

      // Fall through to next candidate on network or 5xx error
      lastError = {
        ...result,
        backend,
      };
    } catch (err) {
      lastError = {
        ok: false,
        isNetworkOr5xx: true,
        error: err.message || "Compilation failed",
        backend,
      };
    }
  }

  return lastError || { ok: false, error: "Compilation failed across all available backends." };
}

export { localBackend, texliveBackend, remoteBackend, wasmBackend, getLocalBaseUrl };
export { useCompilerStatus } from "./useCompilerStatus.js";
