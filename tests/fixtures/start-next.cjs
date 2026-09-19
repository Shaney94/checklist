const http = require("node:http"),
  crypto = require("node:crypto"),
  { spawn } = require("node:child_process"),
  path = require("node:path");
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "fixture",
  alg: "RS256",
  use: "sig",
};
function token(exp, testRole) {
  const header = Buffer.from(
      JSON.stringify({ alg: "RS256", kid: "fixture" }),
    ).toString("base64url"),
    body = Buffer.from(
      JSON.stringify({
        sub: "browser-fixture",
        testRole,
        iss: "turnli-browser-test",
        iat: Math.floor(Date.now() / 1000),
        exp,
      }),
    ).toString("base64url");
  return (
    header +
    "." +
    body +
    "." +
    crypto
      .sign("RSA-SHA256", Buffer.from(header + "." + body), privateKey)
      .toString("base64url")
  );
}
const now = () => Math.floor(Date.now() / 1000);
const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url.startsWith("/v2/keys/"))
    return res.end(JSON.stringify({ keys: [jwk] }));
  const url = new URL(req.url, "http://127.0.0.1:3101");
  const testRole = url.searchParams.get("role") || undefined;
  let providerRole;
  try {
    const jwt = String(req.headers.authorization).match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/)[0];
    providerRole = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url")).testRole;
  } catch {}
  if (url.pathname === "/tokens")
    return res.end(
      JSON.stringify({
        session: token(now() + 600, testRole),
        expired: token(now() - 100, testRole),
        refresh: token(now() + 3600, testRole),
      }),
    );
  if (req.url === "/v1/auth/me")
    return res.end(
      JSON.stringify({
        userId: "browser-fixture",
        email: "fixture@example.com",
        verifiedEmail: true,
        status: "enabled",
        roleNames: providerRole ? ["turnli-" + providerRole] : [],
      }),
    );
  if (req.url === "/v1/auth/refresh")
    return res.end(
      JSON.stringify({
        sessionJwt: token(now() + 600, providerRole),
        refreshJwt: token(now() + 3600, providerRole),
      }),
    );
  if (req.url === "/v1/auth/password/policy")
    return res.end(JSON.stringify({ minLength: 8 }));
  if (req.url === "/v1/auth/logout") return res.end("{}");
  res.statusCode = 404;
  res.end("{}");
});
server.listen(3101, "127.0.0.1", () => {
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DESCOPE_PROJECT_ID: "turnli-browser-test",
        DESCOPE_MANAGEMENT_KEY: "",
        DATABASE_URL: "",
        NODE_OPTIONS:
          "--require " + path.resolve("tests/fixtures/descope-transport.cjs"),
      },
    },
  );
  const stop = () => {
    child.kill("SIGTERM");
    server.close();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  child.on("exit", (code) => {
    server.close();
    process.exitCode = code || 0;
  });
});
