import { useState, useEffect, useRef, useCallback } from "react";
import { setBackendHealthStatus } from "./index.js";

export function useCompilerStatus(backend) {
  const [probeStatus, setProbeStatus] = useState("online");

  const delayRef = useRef(2000);
  const failureCountRef = useRef(0);
  const timeoutIdRef = useRef(null);
  const wakingTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const hasSucceededRef = useRef(false);
  const isMountedRef = useRef(true);
  const runProbeRef = useRef(null);

  const needsProbe = Boolean(
    backend &&
    (backend.id === "local" || backend.id === "remote") &&
    backend.isEnabled() &&
    backend.getBaseUrl()
  );

  const status = !needsProbe
    ? (backend && !backend.isEnabled() ? "offline" : "online")
    : probeStatus;

  useEffect(() => {
    if (backend?.id) {
      setBackendHealthStatus(backend.id, status);
    }
  }, [backend?.id, status]);

  const runProbe = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    if (!needsProbe) return;

    const baseUrl = backend.getBaseUrl();
    if (!baseUrl) {
      setProbeStatus("offline");
      return;
    }

    // Cancel existing controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Timeout: 120s for remote (Render spinup), 5s for local
    const timeoutMs = backend.id === "remote" ? 120000 : 5000;
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    // If remote and hasn't succeeded yet, show 'waking' after 5 seconds of pending
    if (backend.id === "remote" && !hasSucceededRef.current) {
      if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
      wakingTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setProbeStatus("waking");
        }
      }, 5000);
    }

    try {
      const res = await fetch(`${baseUrl}/health`, {
        mode: "cors",
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);
      if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);

      if (!isMountedRef.current) return;

      if (res.ok) {
        hasSucceededRef.current = true;
        failureCountRef.current = 0;
        setProbeStatus("online");
        delayRef.current = Math.min(delayRef.current * 2, 60000);
        scheduleNext(delayRef.current);
      } else {
        handleFailure();
      }
    } catch {
      clearTimeout(timeoutTimer);
      if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
      if (!isMountedRef.current) return;
      handleFailure();
    }

    function handleFailure() {
      failureCountRef.current += 1;
      if (failureCountRef.current >= 3) {
        setProbeStatus("offline");
      }
      delayRef.current = Math.min(delayRef.current * 2, 60000);
      scheduleNext(delayRef.current);
    }

    function scheduleNext(ms) {
      if (!isMountedRef.current) return;
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = setTimeout(() => {
        if (runProbeRef.current) {
          runProbeRef.current();
        }
      }, ms);
    }
  }, [backend, needsProbe]);

  useEffect(() => {
    runProbeRef.current = runProbe;
  }, [runProbe]);

  const probeNow = useCallback(() => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    delayRef.current = 2000;
    runProbe();
  }, [runProbe]);

  useEffect(() => {
    isMountedRef.current = true;
    delayRef.current = 2000;
    failureCountRef.current = 0;
    hasSucceededRef.current = false;

    if (!needsProbe) {
      return;
    }

    // Schedule initial probe asynchronously
    const initialTimer = setTimeout(() => {
      runProbeRef.current?.();
    }, 0);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
        if (abortControllerRef.current) abortControllerRef.current.abort();
        if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
      } else {
        delayRef.current = 2000;
        runProbeRef.current?.();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initialTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      if (wakingTimerRef.current) clearTimeout(wakingTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [needsProbe]);

  return {
    status,
    isOnline: status === "online",
    isWaking: status === "waking",
    isOffline: status === "offline",
    probeNow,
  };
}
