import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const expectedCsp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

describe('Cloudflare Pages static security policy', () => {
  it('defines the authoritative deny-by-default security headers', async () => {
    const headers = await readFile('public/_headers', 'utf8');
    expect(headers).toContain('/*');
    expect(headers).toContain(`Content-Security-Policy: ${expectedCsp}`);
    expect(headers).toContain('Referrer-Policy: no-referrer');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    expect(headers).not.toMatch(/unsafe-inline|unsafe-eval/u);
  });

  it('uses a static SPA fallback without Pages Functions', async () => {
    const [redirects, packageDocument] = await Promise.all([
      readFile('public/_redirects', 'utf8'),
      readFile('package.json', 'utf8'),
    ]);
    expect(redirects.trim()).toBe('/* /index.html 200');
    expect(packageDocument).not.toContain('@cloudflare/pages-plugin');
    expect(packageDocument).not.toContain('pages-functions');
  });
});
