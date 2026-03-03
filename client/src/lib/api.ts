import { Capacitor } from "@capacitor/core";

// determine base URL for API requests; on web we default to "" so
// relative paths work, on native builds use an environment variable or
// fall back to localhost emulator address.
export const API_BASE = (() => {
  const envBase = import.meta.env.VITE_API_BASE;
  if (Capacitor.isNativePlatform()) {
    // when running in the APK, the origin is file:// or capacitor://,
    // so we must provide a host explicitly.
    // development: use 10.0.2.2 to reach the host machine emulator
    return envBase || "http://10.0.2.2:3000";
  }
  return envBase || "";
})();

// simple wrapper that prepends the base URL when needed
export function apiFetch(input: RequestInfo, init?: RequestInit) {
  if (typeof input === "string") {
    return fetch(`${API_BASE}${input}`, init);
  }
  // Request object already contains a full URL
  return fetch(input, init);
}
