// Local diagnostics do not receive GitHub Actions run identity. Normalize only
// the diagnostic filename; the authenticated Release transfer remains strict.
if (!process.env.GITHUB_RUN_ID?.trim()) process.env.GITHUB_RUN_ID = 'local';
await import('./Package-GitHubCompletedRelease.mjs');
