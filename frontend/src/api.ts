const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function apiUrl(path: string) {
  return `${base}${path}`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  const h = new Headers(headers);
  h.set("Accept", "application/json");
  if (init.body && !h.has("Content-Type")) {
    h.set("Content-Type", "application/json");
  }
  if (token) {
    h.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(path), { ...rest, headers: h });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    (err as Error & { body?: unknown }).body = data;
    throw err;
  }
  return data as T;
}
