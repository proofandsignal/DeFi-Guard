// Owner-only DeFi Guard risk simulation preview. No wallet, alert delivery or funds.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "index.html");
const html = readFileSync(source);
const text = html.toString("utf8");
const scripts = [...text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (!scripts.length || /<script[^>]+\bsrc\s*=/i.test(text)) {
  throw new Error("Unexpected script dependencies: preview fails closed");
}
const hashes = scripts.map(script => "'sha256-" +
  createHash("sha256").update(script[1], "utf8").digest("base64") + "'");
const csp = [
  "default-src 'none'", "script-src " + hashes.join(" "),
  "style-src 'unsafe-inline'", "img-src data:", "font-src 'none'",
  "connect-src 'none'", "form-action 'none'", "base-uri 'none'",
  "object-src 'none'", "frame-ancestors 'none'"
].join("; ");

function secure(res) {
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Strict-Transport-Security", "max-age=31536000");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
}
function equals(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function makePrivateServer({ user, password }) {
  if (!user || user.includes(":") || !password || password.length < 24)
    throw new Error("Strong QA_USER and QA_PASSWORD (24+ characters) required");
  const expected = "Basic " + Buffer.from(user + ":" + password).toString("base64");
  return createServer((req, res) => {
    secure(res);
    const head = req.method === "HEAD";
    if (req.method !== "GET" && !head) {
      res.writeHead(405, { Allow: "GET, HEAD" }); return res.end();
    }
    let path;
    try { path = new URL(req.url || "/", "https://preview.invalid").pathname; }
    catch { res.writeHead(400); return res.end(); }
    if (path === "/__health") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(head ? undefined : "OK");
    }
    if (!equals(req.headers.authorization || "", expected)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="DeFi Guard private QA", charset="UTF-8"' });
      return res.end(head ? undefined : "Authentication required");
    }
    if (path !== "/" && path !== "/index.html") {
      res.writeHead(404); return res.end();
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": html.length
    });
    return res.end(head ? undefined : html);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = makePrivateServer({
    user: process.env.QA_USER, password: process.env.QA_PASSWORD
  });
  server.listen(Number(process.env.PORT || 10000), "0.0.0.0", () =>
    console.log("DeFi Guard owner-only synthetic QA preview listening"));
}