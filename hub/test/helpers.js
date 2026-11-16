// Shared by the tests: a stand-in for a fetch() answer (status, headers, body).
// body: an object (json() gives it back as it is, text() its JSON), a string or a Buffer (both
// read as the answer's bytes). text: the answer's text when it differs from body's JSON.
export function reply(status, body, headers = {}, text) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const isBytes = Buffer.isBuffer(body) || typeof body === 'string';
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(text != null ? text : typeof body === 'string' ? body : JSON.stringify(body));
  return {
    status, ok: status >= 200 && status < 300,
    headers: { get: (k) => (h.has(k.toLowerCase()) ? h.get(k.toLowerCase()) : null) },
    json: async () => (isBytes ? JSON.parse(buf.toString('utf8')) : body),
    text: async () => buf.toString('utf8'),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  };
}
