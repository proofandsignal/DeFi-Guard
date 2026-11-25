import test from "node:test";
import assert from "node:assert/strict";
import { makePrivateServer } from "./qa-server.mjs";

const creds = { user: "owner", password: "test-only-dev-credential-with-24-plus" };

test("owner-only demo denies all anonymous assets and unexpected routes", async t => {
  const server = makePrivateServer(creds);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const origin = "http://127.0.0.1:" + server.address().port;
  const headers = { Authorization: "Basic " + Buffer.from(creds.user + ":" + creds.password).toString("base64") };
  for (const path of ["/", "/index.html", "/.env", "/qa-server.mjs"]) {
    const res = await fetch(origin + path);
    assert.equal(res.status, 401, path);
    assert.match(res.headers.get("www-authenticate") || "", /Basic realm=/);
    assert.match(res.headers.get("cache-control") || "", /no-store/);
  }
  const health = await fetch(origin + "/__health");
  assert.equal(health.status, 200);
  assert.equal(await health.text(), "OK");
  const authorized = await fetch(origin + "/", { headers });
  assert.equal(authorized.status, 200);
  assert.match(await authorized.text(), /DeFi Guard/);
  assert.match(authorized.headers.get("content-security-policy") || "", /script-src 'sha256-/);
  assert.match(authorized.headers.get("content-security-policy") || "", /connect-src 'none'/);
  const head = await fetch(origin + "/index.html", { method: "HEAD", headers });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const path of ["/.env", "/qa-server.mjs", "/../../README.md", "/unknown"]) {
    assert.equal((await fetch(origin + path, { headers })).status, 404);
  }
  assert.equal((await fetch(origin + "/", { method: "POST", headers })).status, 405);
  assert.equal((await fetch(origin + "/", { headers: { Authorization: "Basic nope" } })).status, 401);
});
test("server refuses absent or weak credentials", () => {
  assert.throws(() => makePrivateServer({ user: "", password: creds.password }), /Strong QA_USER/);
  assert.throws(() => makePrivateServer({ user: "x", password: "short" }), /24/);
  assert.throws(() => makePrivateServer({ user: "x:y", password: creds.password }), /Strong QA_USER/);
});