import { Capacitor } from "@capacitor/core";

// Web requests remain same-origin. Native builds require the deployed API URL.
export const API_BASE = (() => {
  const envBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
  if (Capacitor.isNativePlatform()) {
    if (!envBase) {
      throw new Error("VITE_API_BASE is required for native builds");
    }
    return envBase;
  }
  return envBase || "";
})();

// simple wrapper that prepends the base URL when needed
export function apiFetch(input: RequestInfo, init?: RequestInit) {
  if (typeof input === "string") {
    const url = /^https?:\/\//.test(input) ? input : `${API_BASE}${input}`;
    return fetch(url, { credentials: "include", cache: "no-store", ...init });
  }
  return fetch(input, { credentials: "include", cache: "no-store", ...init });
}
