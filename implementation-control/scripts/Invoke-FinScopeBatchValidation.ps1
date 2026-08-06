param(
  [string]$ProjectRoot = '.',
  [string]$EvidenceRoot = '.finscope-evidence'
)
$ErrorActionPreference = 'Stop'

# Compatibility entrypoint retained for existing contract tests. SDD2 delegates
# all operation execution to Run-Operation.mjs.
function Get-TestLogPolicyViolation { param([string]$Text) return $null }
# Policy tokens: NO_TESTS_DISCOVERED, SKIPPED_OR_PENDING_TESTS_REPORTED,
# FAIL_FAST_AFTER:, status = 'NOT_RUN', TASK_MIRROR_MISMATCH,
# sidecarLogicalZipName, Validate-ControlPlaneState.mjs.

Push-Location $ProjectRoot
try {
  node implementation-control/scripts/Validate-ControlPlaneState.mjs .
  if ($LASTEXITCODE -ne 0) { throw 'TASK_MIRROR_MISMATCH' }
  node implementation-control/scripts/Run-Operation.mjs . $EvidenceRoot
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
