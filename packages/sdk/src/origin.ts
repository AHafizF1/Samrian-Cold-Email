const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function validateBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SAMRIAN_URL must be a valid URL");
  }

  const secure = url.protocol === "https:";
  const loopback = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  if (!secure && !loopback) {
    throw new Error("SAMRIAN_URL must use HTTPS except for loopback development");
  }
  if (url.username || url.password) {
    throw new Error("SAMRIAN_URL must not contain user information");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SAMRIAN_URL must contain only an origin");
  }

  return value.replace(/\/$/, "");
}
