// Test-process-only HTTP transport. No application code imports this file.
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (/\/(?:v[12]\/)(?:auth|keys)\//.test(url))
    return realFetch("http://127.0.0.1:3101" + new URL(url).pathname, init);
  return realFetch(input, init);
};
