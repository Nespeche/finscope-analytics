import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { readJson, root, run, setOutput } from './GitHub-Common.mjs';

const mode = process.argv[2];
const output = resolve(process.argv[3] ?? '.finscope-release');
const handoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY ?? handoff.repository;
const commitSha = process.env.GITHUB_SHA;

function assert(condition, code, detail = '') {
  if (!condition) throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}
async function api(method, path, body) {
  assert(token, 'GITHUB_TOKEN_MISSING');
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'FinScope-GitHub',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GITHUB_API_${response.status}:${text.slice(0, 500)}`);
  return text.length ? JSON.parse(text) : null;
}
async function download(url, destination, authorized = true) {
  assert(token, 'GITHUB_TOKEN_MISSING');
  const authorizationHeader = authorized ? '--header "Authorization: Bearer $GH_TOKEN"' : '';
  const result = await run(
    `curl --fail-with-body --silent --show-error --location ${authorizationHeader} --header "Accept: application/octet-stream" --header "X-GitHub-Api-Version: 2022-11-28" --output "${destination}" "${url}"`,
    { cwd: root, env: { GH_TOKEN: token } },
  );
  assert(result.exitCode === 0, 'ASSET_DOWNLOAD_FAILED', result.stderr.toString('utf8'));
}

async function deleteRelease(releaseId, tag) {
  if (!releaseId) return;
  const release = await api('GET', `releases/${releaseId}`).catch(() => null);
  if (!release?.draft) return;
  await api('DELETE', `releases/${releaseId}`).catch(() => {});
  if (tag) await api('DELETE', `git/refs/tags/${encodeURIComponent(tag)}`).catch(() => {});
}
async function createDraft(tag, title, notes) {
  const releases = await api('GET', 'releases?per_page=100');
  const published = releases.find((release) => !release.draft && release.tag_name === tag);
  assert(!published, 'PUBLISHED_RELEASE_ALREADY_EXISTS', String(published?.id));
  for (const orphan of releases.filter((release) => release.draft && release.tag_name === tag)) {
    await deleteRelease(orphan.id, null);
  }
  return api('POST', 'releases', {
    tag_name: tag,
    target_commitish: commitSha,
    name: title,
    body: notes,
    draft: true,
    prerelease: false,
  });
}
async function uploadAsset(releaseId, path) {
  const bytes = await readFile(path);
  const name = basename(path);
  const response = await fetch(`https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'User-Agent': 'FinScope-GitHub',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: bytes,
  });
  const text = await response.text();
  assert(response.ok, 'RELEASE_ASSET_UPLOAD_FAILED', `${response.status}:${text.slice(0, 500)}`);
  const asset = JSON.parse(text);
  assert(asset.name === name && asset.state === 'uploaded', 'RELEASE_ASSET_UPLOAD_IDENTITY_MISMATCH', text);
  return asset;
}
async function stageRelease(qualification) {
  assert(/^[0-9a-f]{40}$/u.test(commitSha ?? ''), 'RELEASE_COMMIT_INVALID');
  const evidenceName = `${handoff.release.evidencePrefix}_${process.env.GITHUB_RUN_ID}.json`;
  const packageNames = [
    handoff.release.zipName,
    handoff.release.sidecarName,
    evidenceName,
    handoff.release.promptName,
  ];
  const frozenAssets = new Map();
  for (const name of packageNames) {
    frozenAssets.set(name, await readFile(join(output, name)));
  }
  const tag = qualification
    ? `finscope-release-qualification-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`
    : handoff.release.tag;
  const release = await createDraft(
    tag,
    qualification ? 'FinScope Release qualification' : handoff.release.title,
    qualification ? 'Temporary draft used only to qualify the completed Release declared by the active handoff.' : handoff.release.notes,
  );
  const transferDirectory = join(output, '.release-transfer');
  let successful = false;
  try {
    await rm(transferDirectory, { recursive: true, force: true });
    await mkdir(transferDirectory, { recursive: true });
    for (const [name, bytes] of frozenAssets) {
      await writeFile(join(transferDirectory, name), bytes);
    }
    const finalize = await run(
      `node implementation-control/scripts/Finalize-GitHubReleaseHandoff.mjs "${transferDirectory}" "${release.id}" "${handoff.closure.commitSha}" "${handoff.closure.runId}" "${handoff.closure.artifactId}"`,
      { cwd: root },
    );
    assert(finalize.exitCode === 0, 'RELEASE_HANDOFF_GENERATION_FAILED', finalize.stderr.toString('utf8'));
    const names = [...packageNames.slice(0, 3), 'GITHUB_RELEASE_HANDOFF.json', packageNames[3]];
    const paths = names.map((name) => join(transferDirectory, name));
    for (const path of paths) await uploadAsset(release.id, path);
    const assets = await api('GET', `releases/${release.id}/assets?per_page=100`);
    assert(assets.length === 5 && new Set(assets.map((asset) => asset.name)).size === 5, 'RELEASE_ASSET_SET_INVALID', JSON.stringify(assets.map((asset) => asset.name)));
    const downloadDirectory = join(output, '.reauthenticated-assets');
    await rm(downloadDirectory, { recursive: true, force: true });
    await mkdir(downloadDirectory, { recursive: true });
    for (const path of paths) {
      const name = basename(path);
      const asset = assets.find((entry) => entry.name === name);
      assert(asset, 'RELEASE_ASSET_MISSING', name);
      const downloaded = join(downloadDirectory, name);
      await download(`https://api.github.com/repos/${repository}/releases/assets/${asset.id}`, downloaded);
      const [sourceBytes, downloadedBytes] = await Promise.all([readFile(path), readFile(downloaded)]);
      assert(sourceBytes.equals(downloadedBytes), 'RELEASE_ASSET_BYTES_MISMATCH', name);
    }
    const sidecar = (await readFile(join(downloadDirectory, handoff.release.sidecarName), 'utf8')).trim();
    const match = /^([0-9a-f]{64})  (.+)$/u.exec(sidecar);
    assert(match && match[2] === handoff.release.zipName, 'RELEASE_SIDECAR_INVALID', sidecar);
    const zipBytes = await readFile(join(downloadDirectory, handoff.release.zipName));
    assert(createHash('sha256').update(zipBytes).digest('hex') === match[1], 'RELEASE_ZIP_HASH_MISMATCH');
    const crc = await run(`unzip -tqq "${join(downloadDirectory, handoff.release.zipName)}"`, { cwd: root });
    assert(crc.exitCode === 0, 'RELEASE_ZIP_CRC_FAILED', crc.stderr.toString('utf8'));
    const packageVerification = await run(
      `node implementation-control/scripts/Verify-GitHubCompletedPackage.mjs "${join(downloadDirectory, handoff.release.zipName)}" "${join(downloadDirectory, handoff.release.sidecarName)}" --git-root "${root}" --commit "${commitSha}" --tag "${tag}"`,
      { cwd: root },
    );
    await writeFile(join(output, 'release-package-verification.stdout.log'), packageVerification.stdout);
    await writeFile(join(output, 'release-package-verification.stderr.log'), packageVerification.stderr);
    assert(packageVerification.exitCode === 0, 'RELEASE_PACKAGE_METADATA_FAILED', packageVerification.stderr.toString('utf8'));
    const packageVerificationResult = JSON.parse(packageVerification.stdout.toString('utf8'));
    assert(packageVerificationResult.result === 'PASS', 'RELEASE_PACKAGE_METADATA_RESULT_INVALID');
    const control = await run(`node implementation-control/scripts/Validate-ControlPlaneState.mjs "${process.env.FINSCOPE_PACKAGE_ROOT}"`, { cwd: root });
    assert(control.exitCode === 0, 'RELEASE_CONTROL_PLANE_FAILED', control.stderr.toString('utf8'));
    await writeFile(join(output, 'GITHUB_RELEASE_HANDOFF.json'), await readFile(join(transferDirectory, 'GITHUB_RELEASE_HANDOFF.json')));
    const verification = {
      schemaVersion: '1.0.0',
      result: 'PASS',
      mode: qualification ? 'QUALIFICATION' : 'PREPARE',
      tag,
      releaseId: release.id,
      commitSha,
      zipSha256: match[1],
      packageMetadataResult: packageVerificationResult.result,
      packageFileCount: packageVerificationResult.fileCount,
      checkedAt: new Date().toISOString(),
    };
    await writeFile(join(output, qualification ? 'RELEASE_QUALIFICATION.json' : 'RELEASE_UPLOAD_VERIFICATION.json'), `${JSON.stringify(verification, null, 2)}\n`);
    successful = true;
    await setOutput('release_id', release.id);
    await setOutput('tag', tag);
    console.log(JSON.stringify(verification, null, 2));
    return { release, tag };
  } finally {
    if (successful) await rm(transferDirectory, { recursive: true, force: true });
    if (qualification || !successful) await deleteRelease(release.id, tag);
  }
}

async function authenticatePublishedRelease(releaseId, tag) {
  const checkedAt = new Date().toISOString();
  const evidenceName = `${handoff.release.evidencePrefix}_${process.env.GITHUB_RUN_ID}.json`;
  const names = [handoff.release.zipName, handoff.release.sidecarName, evidenceName, 'GITHUB_RELEASE_HANDOFF.json', handoff.release.promptName];
  const byTag = await api('GET', `releases/tags/${encodeURIComponent(tag)}`);
  assert(byTag.id === releaseId, 'POST_PUBLISH_RELEASE_ID_MISMATCH');
  assert(!byTag.draft && !byTag.prerelease && byTag.tag_name === tag, 'POST_PUBLISH_RELEASE_STATE_INVALID');
  const commit = await api('GET', `commits/${encodeURIComponent(tag)}`);
  assert(commit.sha === commitSha, 'POST_PUBLISH_RELEASE_COMMIT_MISMATCH', JSON.stringify({ actual: commit.sha, expected: commitSha }));
  const assets = await api('GET', `releases/${releaseId}/assets?per_page=100`);
  assert(assets.length === 5 && new Set(assets.map((asset) => asset.name)).size === 5, 'POST_PUBLISH_ASSET_SET_INVALID');
  assert(names.every((name) => assets.some((asset) => asset.name === name)), 'POST_PUBLISH_ASSET_NAME_MISMATCH');
  const directory = join(output, '.post-publication-reauthentication');
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const assetEvidence = [];
  for (const name of names) {
    const asset = assets.find((entry) => entry.name === name);
    assert(asset.state === 'uploaded', 'POST_PUBLISH_ASSET_STATE_INVALID', name);
    const source = join(output, name);
    const downloaded = join(directory, name);
    await download(`https://api.github.com/repos/${repository}/releases/assets/${asset.id}`, downloaded);
    const [sourceBytes, downloadedBytes, sourceStat] = await Promise.all([readFile(source), readFile(downloaded), stat(source)]);
    const sha256 = createHash('sha256').update(downloadedBytes).digest('hex');
    assert(sourceBytes.equals(downloadedBytes), 'POST_PUBLISH_ASSET_BYTES_MISMATCH', name);
    assert(asset.size === sourceStat.size && asset.size === downloadedBytes.length, 'POST_PUBLISH_ASSET_SIZE_MISMATCH', name);
    assert(asset.digest === `sha256:${sha256}`, 'POST_PUBLISH_ASSET_DIGEST_MISMATCH', name);
    assetEvidence.push({ id: asset.id, name, state: asset.state, size: asset.size, githubDigest: asset.digest, downloadedSha256: sha256, bytesEqual: true, createdAt: asset.created_at, updatedAt: asset.updated_at });
  }
  const sidecar = (await readFile(join(directory, handoff.release.sidecarName), 'utf8')).trim();
  const binding = /^([0-9a-f]{64})  (.+)$/u.exec(sidecar);
  assert(binding && binding[2] === handoff.release.zipName, 'POST_PUBLISH_SIDECAR_INVALID');
  const zipBytes = await readFile(join(directory, handoff.release.zipName));
  assert(createHash('sha256').update(zipBytes).digest('hex') === binding[1], 'POST_PUBLISH_ZIP_HASH_MISMATCH');
  const crc = await run(`unzip -tqq "${join(directory, handoff.release.zipName)}"`, { cwd: root });
  assert(crc.exitCode === 0, 'POST_PUBLISH_ZIP_CRC_FAILED', crc.stderr.toString('utf8'));
  const verifier = await run(`node implementation-control/scripts/Verify-GitHubCompletedPackage.mjs "${join(directory, handoff.release.zipName)}" "${join(directory, handoff.release.sidecarName)}" --git-root "${root}" --commit "${commitSha}" --tag "${tag}"`, { cwd: root });
  await writeFile(join(output, 'post-publication-package-verification.stdout.log'), verifier.stdout);
  await writeFile(join(output, 'post-publication-package-verification.stderr.log'), verifier.stderr);
  assert(verifier.exitCode === 0, 'POST_PUBLISH_PACKAGE_VERIFIER_FAILED', verifier.stderr.toString('utf8'));
  const packageVerification = JSON.parse(verifier.stdout.toString('utf8'));
  assert(packageVerification.result === 'PASS' && packageVerification.gitTreeComparisonExecuted === true, 'POST_PUBLISH_PACKAGE_VERIFIER_RESULT_INVALID');
  const evidence = {
    schemaVersion: '1.0.0', result: 'PASS', primaryFailure: null, releaseId, tag, commitSha,
    workflowRunId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    assets: assetEvidence, sidecarBinding: true, crc: 'PASS', packageVerifier: packageVerification,
    gitTreeComparison: { executed: packageVerification.gitTreeComparisonExecuted, commit: packageVerification.gitCommitCompared, ordinaryFilesCompared: packageVerification.ordinaryFilesCompared },
    controlPlane: 'PASS', specify: packageVerification.specify, checkedAt,
  };
  await writeFile(join(output, 'POST_PUBLICATION_REAUTHENTICATION.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(join(output, 'POST_PUBLICATION_REAUTHENTICATION.md'), `# Post-publication reauthentication\n\n- Result: **PASS**\n- Release ID: \`${releaseId}\`\n- Tag: \`${tag}\`\n- Commit: \`${commitSha}\`\n- Assets: 5/5 authenticated\n- Sidecar/CRC/package verifier/Git comparison/control plane/.specify: PASS\n- Checked: \`${checkedAt}\`\n`);
  return evidence;
}

if (mode === 'qualify') {
  await stageRelease(true);
} else if (mode === 'prepare') {
  await stageRelease(false);
} else if (mode === 'publish') {
  const releaseId = Number(process.env.RELEASE_ID);
  const tag = process.env.RELEASE_TAG;
  assert(releaseId && tag, 'PUBLISH_REFERENCE_MISSING');
  try {
    const published = await api('PATCH', `releases/${releaseId}`, { draft: false, prerelease: false });
    assert(!published.draft && !published.prerelease && published.tag_name === tag, 'RELEASE_PUBLICATION_FAILED');
    console.log(JSON.stringify(await authenticatePublishedRelease(releaseId, tag), null, 2));
  } catch (error) {
    const failure = { schemaVersion: '1.0.0', result: 'FAIL', primaryFailure: String(error?.message ?? error), releaseId, tag, commitSha, checkedAt: new Date().toISOString() };
    await writeFile(join(output, 'POST_PUBLICATION_REAUTHENTICATION_FAILED.json'), `${JSON.stringify(failure, null, 2)}\n`);
    await writeFile(join(output, 'POST_PUBLICATION_REAUTHENTICATION_FAILED.md'), `# Post-publication reauthentication\n\n- Result: **FAIL**\n- Primary failure: \`${failure.primaryFailure}\`\n- Published Release preserved; no asset replacement or deletion was attempted.\n`);
    throw error;
  }
} else if (mode === 'cleanup') {
  await deleteRelease(Number(process.env.RELEASE_ID), process.env.RELEASE_TAG);
} else {
  throw new Error('Usage: Run-GitHubReleaseTransfer.mjs <qualify|prepare|publish|cleanup> [output]');
}
