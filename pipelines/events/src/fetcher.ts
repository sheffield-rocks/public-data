export async function fetchWithCache(input: {
  url: string;
  etag?: string;
  lastModified?: string;
  timeoutMs?: number;
}): Promise<{
  status: number;
  text: string | null;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: number;
}> {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "User-Agent": "sheffield.rocks-events/0.1",
    "Accept": "text/html,application/xml;q=0.9,*/*;q=0.8",
  };

  if (input.etag) headers["If-None-Match"] = input.etag;
  if (input.lastModified) headers["If-Modified-Since"] = input.lastModified;

  let response: Response;
  try {
    response = await fetch(input.url, { headers, signal: controller.signal });
  } catch (error) {
    clearTimeout(timeout);
    const err = error as { name?: string; message?: string };
    const name = err.name ?? "error";
    const message = err.message ?? err;
    console.warn("fetch failed", input.url, name, message);
    // Return a soft failure for timeouts/aborts so the worker keeps going.
    if (name === "AbortError") {
      return {
        status: 0,
        text: null,
        etag: null,
        lastModified: null,
        fetchedAt: Date.now(),
      };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const status = response.status;
  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");
  const fetchedAt = Date.now();

  if (status >= 400) {
    console.warn("fetch non-200", input.url, status);
  }

  if (status === 304) {
    return { status, text: null, etag, lastModified, fetchedAt };
  }

  const text = await response.text();
  return { status, text, etag, lastModified, fetchedAt };
}
