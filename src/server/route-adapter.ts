/** Temporary transport adapter. Domain handlers remain the single source of truth. */
type RequestLike = {
  method: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
};
type HeaderValue = string | string[] | number;
type ResponseLike = {
  setHeader(name: string, value: HeaderValue): void;
  getHeader(name: string): HeaderValue | undefined;
  status(code: number): ResponseLike;
  json(value: unknown): ResponseLike;
  end(value?: string | Uint8Array): ResponseLike;
};
type Handler = (req: RequestLike, res: ResponseLike) => unknown;

export function adapt(handler: Handler, bodyLimit = 4096) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers();
    headers.set('Cache-Control', 'private, no-store, max-age=0');
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
    const saved = new Map<string, HeaderValue>();
    let code = 200;
    let payload: string | Uint8Array | undefined;
    const res: ResponseLike = {
      setHeader(name, value) {
        saved.set(name.toLowerCase(), value);
        headers.delete(name);
        for (const item of Array.isArray(value) ? value : [value]) headers.append(name, String(item));
      },
      getHeader(name) { return saved.get(name.toLowerCase()); },
      status(value) { code = value; return res; },
      json(value) { headers.set('Content-Type', 'application/json; charset=utf-8'); payload = JSON.stringify(value); return res; },
      end(value) { payload = value; return res; },
    };
    let body: unknown;
    if (request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > bodyLimit) {
          await reader.cancel();
          return Response.json({ error: 'Request too large' }, { status: 413, headers });
        }
        chunks.push(value);
      }
      if (size) {
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return Response.json({ error: 'Invalid request' }, { status: 400, headers }); }
      }
    }
    await handler({
      method: request.method,
      headers: Object.fromEntries(request.headers),
      query: Object.fromEntries(new URL(request.url).searchParams),
      body,
    }, res);
    return new Response(request.method === 'HEAD' ? null : payload as BodyInit | undefined, { status: code, headers });
  };
}
