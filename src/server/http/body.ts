export class BodyError extends Error {
  constructor(
    readonly status: 413 | 415 | 422,
    message: string
  ) {
    super(message);
  }
}

export async function boundRequest(
  request: Request,
  maxBytes: number,
  mode: "json" | "text" = "json"
): Promise<Request> {
  if (request.method === "GET" || request.method === "HEAD" || !request.body) {
    return request;
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BodyError(413, "Request body too large");
  }
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") {
    throw new BodyError(415, "Encoded request bodies are not supported");
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType && !accepts(contentType, mode)) {
    throw new BodyError(415, "Unsupported request content type");
  }

  const body = await readBody(request.body, maxBytes, mode);
  const headers = new Headers(request.headers);
  headers.set("content-length", String(body.byteLength));
  return new Request(request, { body, headers });
}

export async function readJsonResponse<T>(response: Response, maxBytes: number): Promise<T> {
  if (!response.body) throw new BodyError(422, "Provider returned an empty response");
  const body = await readBody(response.body, maxBytes, "json");
  return JSON.parse(body.toString("utf8")) as T;
}

function accepts(contentType: string, mode: "json" | "text") {
  if (mode === "text") {
    return contentType === "text/plain" || contentType === "application/x-www-form-urlencoded";
  }
  return contentType === "application/json" || contentType.endsWith("+json");
}

async function readBody(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  mode: "json" | "text"
) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  const json = { depth: 0, inString: false, escaped: false, stringBytes: 0 };
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BodyError(413, "Body too large");
    }
    if (mode === "json") {
      try {
        scanJson(value, json);
      } catch (error) {
        await reader.cancel();
        throw error;
      }
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function scanJson(
  bytes: Uint8Array,
  state: { depth: number; inString: boolean; escaped: boolean; stringBytes: number }
) {
  for (const byte of bytes) {
    if (state.inString) {
      if (state.escaped) {
        state.escaped = false;
      } else if (byte === 0x5c) {
        state.escaped = true;
      } else if (byte === 0x22) {
        state.inString = false;
      } else if (++state.stringBytes > 256 * 1024) {
        throw new BodyError(422, "JSON string is too long");
      }
      continue;
    }
    if (byte === 0x22) {
      state.inString = true;
      state.stringBytes = 0;
    } else if (byte === 0x7b || byte === 0x5b) {
      if (++state.depth > 32) throw new BodyError(422, "JSON nesting is too deep");
    } else if (byte === 0x7d || byte === 0x5d) {
      state.depth--;
    }
  }
}
