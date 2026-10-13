import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Cloudflare config supports public fetch to Cloudflare-hosted webhook endpoints',()=>{
  const toml=fs.readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
  assert.match(
    toml,
    /compatibility_flags\s*=\s*\[[^\]]*"global_fetch_strictly_public"[^\]]*\]/
  );
});
