[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^B(?:0[1-9]|1[0-9]|2[0-5])$')]
    [string]$BatchId,

    [switch]$SkipNpmCi,
    [switch]$SkipBrowserInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Get-Sha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativeFileRecords([string]$Directory) {
    $root = (Resolve-Path -LiteralPath $Directory).Path
    $separator = [System.IO.Path]::DirectorySeparatorChar.ToString()
    $rootPrefix = $root.TrimEnd([char[]]@('\', '/')) + $separator
    return Get-ChildItem -LiteralPath $root -File -Recurse |
        ForEach-Object {
            if (-not $_.FullName.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "El archivo no pertenece al árbol esperado: $($_.FullName)"
            }
            [pscustomobject]@{
                File = $_
                RelativePath = $_.FullName.Substring($rootPrefix.Length).Replace('\', '/')
            }
        } |
        Sort-Object RelativePath
}

function Get-TreeSha256([string]$Directory) {
    $records = Get-RelativeFileRecords $Directory
    $stream = [System.IO.MemoryStream]::new()
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        foreach ($record in $records) {
            $pathBytes = $Utf8NoBom.GetBytes([string]$record.RelativePath)
            $stream.Write($pathBytes, 0, $pathBytes.Length)
            $stream.WriteByte(0)

            $hex = Get-Sha256 $record.File.FullName
            [byte[]]$hashBytes = for ($index = 0; $index -lt $hex.Length; $index += 2) {
                [System.Convert]::ToByte($hex.Substring($index, 2), 16)
            }
            $stream.Write($hashBytes, 0, $hashBytes.Length)
            $stream.WriteByte(10)
        }

        $treeHash = [System.BitConverter]::ToString($sha256.ComputeHash($stream.ToArray()))
        return $treeHash.Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function Get-TargetHashes([string]$ProjectRoot, [object]$Batch) {
    $hashes = [ordered]@{}
    foreach ($relativePath in $Batch.targetFiles) {
        $absolutePath = Join-Path $ProjectRoot ([string]$relativePath).Replace('/', '\')
        if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
            throw "Falta el archivo objetivo declarado por $BatchId`: $relativePath"
        }
        $hashes[[string]$relativePath] = Get-Sha256 $absolutePath
    }
    return $hashes
}

function Test-OrderedHashesEqual([object]$Left, [object]$Right) {
    $leftKeys = @($Left.Keys)
    $rightKeys = @($Right.Keys)
    if ($leftKeys.Count -ne $rightKeys.Count) { return $false }
    foreach ($key in $leftKeys) {
        if (-not $Right.Contains($key) -or [string]$Left[$key] -ne [string]$Right[$key]) {
            return $false
        }
    }
    return $true
}

function Assert-FileManifest([string]$ProjectRoot) {
    $manifestPath = Join-Path $ProjectRoot 'FILE_MANIFEST.sha256'
    $expected = @{}
    foreach ($line in Get-Content -LiteralPath $manifestPath -Encoding UTF8) {
        if ($line -notmatch '^(?<hash>[0-9a-fA-F]{64})  (?<path>.+)$') {
            throw "Línea inválida en FILE_MANIFEST.sha256: $line"
        }
        $path = [string]$Matches.path
        if ($expected.ContainsKey($path)) {
            throw "Ruta duplicada en FILE_MANIFEST.sha256: $path"
        }
        $expected[$path] = ([string]$Matches.hash).ToLowerInvariant()
    }

    $actualRecords = @(Get-RelativeFileRecords $ProjectRoot | Where-Object RelativePath -ne 'FILE_MANIFEST.sha256')
    if ($actualRecords.Count -ne $expected.Count) {
        throw "FILE_MANIFEST.sha256 no cubre exactamente el árbol. Esperados: $($expected.Count). Reales: $($actualRecords.Count)."
    }
    foreach ($record in $actualRecords) {
        if (-not $expected.ContainsKey([string]$record.RelativePath)) {
            throw "Archivo no registrado en FILE_MANIFEST.sha256: $($record.RelativePath)"
        }
        $actualHash = Get-Sha256 $record.File.FullName
        if ($actualHash -ne [string]$expected[[string]$record.RelativePath]) {
            throw "Hash de manifiesto inconsistente para $($record.RelativePath)."
        }
    }
    return $true
}

function Assert-PackageInventory([string]$ProjectRoot) {
    $inventoryPath = Join-Path $ProjectRoot 'PACKAGE_INVENTORY.json'
    $inventory = Get-Content -LiteralPath $inventoryPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $items = @($inventory.files)
    if ([int]$inventory.itemCount -ne $items.Count) {
        throw "PACKAGE_INVENTORY.json tiene itemCount inconsistente."
    }

    $expectedPaths = @{}
    foreach ($item in $items) {
        $path = [string]$item.path
        if ($expectedPaths.ContainsKey($path)) {
            throw "Ruta duplicada en PACKAGE_INVENTORY.json: $path"
        }
        $expectedPaths[$path] = $item
    }

    $actualRecords = @(Get-RelativeFileRecords $ProjectRoot |
        Where-Object { $_.RelativePath -notin @('FILE_MANIFEST.sha256', 'PACKAGE_INVENTORY.json') })
    if ($actualRecords.Count -ne $items.Count) {
        throw "PACKAGE_INVENTORY.json no cubre exactamente el árbol autorizado."
    }
    foreach ($record in $actualRecords) {
        $relativePath = [string]$record.RelativePath
        if (-not $expectedPaths.ContainsKey($relativePath)) {
            throw "Archivo no registrado en PACKAGE_INVENTORY.json: $relativePath"
        }
        $item = $expectedPaths[$relativePath]
        if ([int64]$item.sizeBytes -ne [int64]$record.File.Length) {
            throw "Tamaño inconsistente en PACKAGE_INVENTORY.json para $relativePath."
        }
        if ([string]$item.sha256 -ne (Get-Sha256 $record.File.FullName)) {
            throw "Hash inconsistente en PACKAGE_INVENTORY.json para $relativePath."
        }
    }
    return $true
}

function Get-ArchiveInspection(
    [string]$ZipPath,
    [string]$ProjectRoot,
    [string]$ExpectedRootDirectory
) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $actualFiles = @{}
    foreach ($record in Get-RelativeFileRecords $ProjectRoot) {
        $actualFiles[[string]$record.RelativePath] = $record.File.FullName
    }

    $roots = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $caseFoldPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $archiveFiles = @{}
    $symlinkCount = 0
    $caseFoldCollisionCount = 0
    $nestedArchiveCount = 0
    $safePaths = $true
    $crcRead = $true

    $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        foreach ($entry in $archive.Entries) {
            $normalized = ([string]$entry.FullName).Replace('\', '/')
            if ([string]::IsNullOrWhiteSpace($normalized)) { continue }

            if (
                $normalized.StartsWith('/') -or
                $normalized.StartsWith('\\') -or
                $normalized -match '^[A-Za-z]:'
            ) {
                $safePaths = $false
            }
            $segments = @($normalized.Split('/') | Where-Object { $_ -ne '' })
            if ($segments.Count -eq 0) { continue }
            [void]$roots.Add([string]$segments[0])
            if ($segments -contains '..' -or $segments -contains '.' -or $normalized.Length -gt 240) {
                $safePaths = $false
            }
            foreach ($segment in $segments) {
                $baseName = [System.IO.Path]::GetFileNameWithoutExtension([string]$segment)
                if (
                    $segment -match '[<>:"|?*\x00-\x1F]' -or
                    $segment.EndsWith('.') -or
                    $segment.EndsWith(' ') -or
                    $baseName -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$'
                ) {
                    $safePaths = $false
                }
            }

            if (-not $caseFoldPaths.Add($normalized)) {
                $caseFoldCollisionCount++
            }

            $unixFileType = (($entry.ExternalAttributes -shr 16) -band 0xF000)
            if ($unixFileType -eq 0xA000) {
                $symlinkCount++
            }

            if ($normalized.EndsWith('/')) { continue }
            if ($normalized -match '(?i)\.(zip|7z|rar|tar|tgz|gz|bz2|xz)$') {
                $nestedArchiveCount++
            }
            if ($segments.Count -lt 2) {
                $safePaths = $false
                continue
            }

            $innerPath = [string]::Join('/', $segments[1..($segments.Count - 1)])
            if ($archiveFiles.ContainsKey($innerPath)) {
                $safePaths = $false
                continue
            }

            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            $stream = $null
            try {
                $stream = $entry.Open()
                $hashBytes = $sha256.ComputeHash($stream)
                $entryHash = ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
                $archiveFiles[$innerPath] = $entryHash
            }
            catch {
                $crcRead = $false
                throw
            }
            finally {
                if ($null -ne $stream) { $stream.Dispose() }
                $sha256.Dispose()
            }
        }
    }
    finally {
        $archive.Dispose()
    }

    $matchesExtraction = (
        $archiveFiles.Count -eq $actualFiles.Count -and
        $roots.Count -eq 1 -and
        $roots.Contains($ExpectedRootDirectory)
    )
    if ($matchesExtraction) {
        foreach ($relativePath in $archiveFiles.Keys) {
            if (-not $actualFiles.ContainsKey($relativePath)) {
                $matchesExtraction = $false
                break
            }
            if ((Get-Sha256 $actualFiles[$relativePath]) -ne [string]$archiveFiles[$relativePath]) {
                $matchesExtraction = $false
                break
            }
        }
    }

    return [ordered]@{
        archiveFileCount = [int]$archiveFiles.Count
        archiveRootCount = [int]$roots.Count
        archiveCrcRead = [bool]$crcRead
        archiveSafePaths = [bool]$safePaths
        archiveMatchesExtraction = [bool]$matchesExtraction
        archiveSymlinksDetected = [int]$symlinkCount
        archiveCaseFoldCollisionsDetected = [int]$caseFoldCollisionCount
        archiveNestedArchivesDetected = [int]$nestedArchiveCount
    }
}

function Get-VersionOutput([string]$Executable, [string[]]$Arguments) {
    $output = & $Executable @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo obtener la versión de $Executable."
    }
    return (($output | Select-Object -First 1).ToString()).Trim()
}

function Get-TestLogPolicyViolation([object]$Entry, [string]$StdoutPath, [string]$StderrPath) {
    $id = [string]$Entry.id
    if ($id -notmatch '^(?:test-|regression-)') { return $null }

    $stdout = Get-Content -LiteralPath $StdoutPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    $stderr = Get-Content -LiteralPath $StderrPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    $combined = ([string]$stdout) + [Environment]::NewLine + ([string]$stderr)

    if ($combined -match '(?im)\b(?:no tests found|no test files found|did not find any tests)\b') {
        return 'NO_TESTS_DISCOVERED'
    }
    if ($combined -match '(?im)\b[1-9][0-9]*\s+(?:skipped|pending|todo)\b') {
        return 'SKIPPED_OR_PENDING_TESTS_REPORTED'
    }
    return $null
}

function New-NotRunResult([object]$Entry, [string]$Reason) {
    return [ordered]@{
        id = [string]$Entry.id
        category = [string]$Entry.category
        command = [string]$Entry.command
        required = [bool]$Entry.required
        startedAt = $null
        finishedAt = $null
        durationMilliseconds = 0
        exitCode = $null
        status = 'NOT_RUN'
        stdoutLog = $null
        stderrLog = $null
        stdoutSha256 = $null
        stderrSha256 = $null
        stdoutBytes = 0
        stderrBytes = 0
        reason = $Reason
    }
}

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
Set-Location -LiteralPath $projectRoot
$parent = Split-Path -Parent $projectRoot
$stamp = [DateTimeOffset]::Now.ToString('yyyyMMdd-HHmmss')
$evidenceRoot = Join-Path $parent "FinScope_local_evidence_${BatchId}_$stamp"
$logRoot = Join-Path $evidenceRoot 'logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$batchPath = Join-Path $projectRoot "implementation-control\batches\$BatchId.json"
if (-not (Test-Path -LiteralPath $batchPath -PathType Leaf)) {
    throw "No existe el lote $BatchId en $batchPath"
}
$batch = Get-Content -LiteralPath $batchPath -Raw -Encoding UTF8 | ConvertFrom-Json
$statePath = Join-Path $projectRoot 'implementation-control\IMPLEMENTATION_STATE.json'
$state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($BatchId -ne [string]$state.activeBatchId) {
    throw "El lote solicitado $BatchId no coincide con activeBatchId=$($state.activeBatchId)."
}

$metadataPath = Join-Path $projectRoot 'PACKAGE_METADATA.json'
$inventoryPath = Join-Path $projectRoot 'PACKAGE_INVENTORY.json'
$manifestPath = Join-Path $projectRoot 'FILE_MANIFEST.sha256'
$metadata = Get-Content -LiteralPath $metadataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$candidateZipPath = Join-Path $parent ([string]$metadata.logicalZipName)
$candidateSidecarPath = Join-Path $parent ([string]$metadata.finalSha256Sidecar)
if (-not (Test-Path -LiteralPath $candidateZipPath -PathType Leaf)) {
    throw "No se encontró el ZIP candidato esperado junto a la extracción: $candidateZipPath"
}
if (-not (Test-Path -LiteralPath $candidateSidecarPath -PathType Leaf)) {
    throw "No se encontró el sidecar esperado junto al ZIP candidato: $candidateSidecarPath"
}

$sidecarLines = @(Get-Content -LiteralPath $candidateSidecarPath -Encoding UTF8 | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
if ($sidecarLines.Count -ne 1 -or $sidecarLines[0] -notmatch '^(?<hash>[0-9a-fA-F]{64})\s{2}(?<name>[^\\/]+\.zip)$') {
    throw "El sidecar debe contener exactamente: <SHA-256><dos espacios><nombre lógico .zip>."
}
$sidecarExpectedSha256 = ([string]$Matches.hash).ToLowerInvariant()
$sidecarLogicalZipName = [string]$Matches.name
if ($sidecarLogicalZipName -ne [string]$metadata.logicalZipName) {
    throw "El nombre lógico del sidecar no coincide con PACKAGE_METADATA.logicalZipName."
}
$candidateZipSha256 = Get-Sha256 $candidateZipPath
$sidecarMatches = $candidateZipSha256 -eq $sidecarExpectedSha256
if (-not $sidecarMatches) {
    throw "El SHA-256 del ZIP candidato no coincide con su sidecar."
}

$manifestValid = Assert-FileManifest $projectRoot
$inventoryValid = Assert-PackageInventory $projectRoot
$metadataValid = (
    [string]$metadata.rootDirectory -eq (Split-Path -Leaf $projectRoot) -and
    [string]$metadata.logicalZipName -eq (Split-Path -Leaf $candidateZipPath) -and
    [string]$metadata.finalSha256Sidecar -eq (Split-Path -Leaf $candidateSidecarPath)
)
if (-not $metadataValid) {
    throw "PACKAGE_METADATA.json no coincide con la raíz, el ZIP o el sidecar validados."
}

$archiveInspection = Get-ArchiveInspection $candidateZipPath $projectRoot ([string]$metadata.rootDirectory)
if (
    -not $archiveInspection.archiveCrcRead -or
    -not $archiveInspection.archiveSafePaths -or
    -not $archiveInspection.archiveMatchesExtraction -or
    $archiveInspection.archiveRootCount -ne 1 -or
    $archiveInspection.archiveSymlinksDetected -ne 0 -or
    $archiveInspection.archiveCaseFoldCollisionsDetected -ne 0 -or
    $archiveInspection.archiveNestedArchivesDetected -ne 0
) {
    throw "El ZIP candidato no supera la inspección integral o no coincide byte a byte con la extracción."
}

$specifyTreeSha256Before = Get-TreeSha256 (Join-Path $projectRoot '.specify')
if ($specifyTreeSha256Before -ne [string]$state.specifyTreeSha256) {
    throw "El hash canónico de .specify no coincide. Esperado: $($state.specifyTreeSha256). Real: $specifyTreeSha256Before"
}
$sourceTasksPath = Join-Path $projectRoot 'specs\001-fundamental-analysis-platform\tasks.md'
$sourceTasksSha256Before = Get-Sha256 $sourceTasksPath
if ($sourceTasksSha256Before -ne [string]$state.sourceTasksSha256) {
    throw "El hash de tasks.md no coincide con IMPLEMENTATION_STATE.json."
}
$controlPlaneValidatorPath = Join-Path $projectRoot 'implementation-control\scripts\Validate-ControlPlaneState.mjs'
$controlPlaneOutput = & node $controlPlaneValidatorPath $projectRoot 2>&1
if ($LASTEXITCODE -ne 0) {
    $controlPlaneText = ($controlPlaneOutput | Out-String).Trim()
    throw "TASK_MIRROR_MISMATCH: el plano de control no está sincronizado. $controlPlaneText"
}
$targetFileHashesBefore = Get-TargetHashes $projectRoot $batch
$extractedTreeSha256 = Get-TreeSha256 $projectRoot

$osDescription = [System.Environment]::OSVersion.VersionString
$osArchitecture = [System.Environment]::GetEnvironmentVariable('PROCESSOR_ARCHITECTURE')
$processArchitecture = $osArchitecture
try {
    $osDescription = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription.Trim()
    $osArchitecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    $processArchitecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
}
catch {
    if ([string]::IsNullOrWhiteSpace($osArchitecture)) { $osArchitecture = 'unknown' }
    if ([string]::IsNullOrWhiteSpace($processArchitecture)) { $processArchitecture = 'unknown' }
}
$powerShellEdition = if ($PSVersionTable.PSObject.Properties.Name -contains 'PSEdition') {
    [string]$PSVersionTable.PSEdition
} else {
    'Desktop'
}
$environment = [ordered]@{
    operatingSystem = $osDescription
    osVersion = [System.Environment]::OSVersion.Version.ToString()
    osArchitecture = $osArchitecture
    processArchitecture = $processArchitecture
    powerShellVersion = $PSVersionTable.PSVersion.ToString()
    powerShellEdition = $powerShellEdition
    nodeVersion = Get-VersionOutput 'node' @('--version')
    npmVersion = Get-VersionOutput 'npm' @('--version')
}

$startedAt = [DateTimeOffset]::Now.ToString('o')
$commandResults = [System.Collections.Generic.List[object]]::new()
$failedRequiredCommandId = $null

foreach ($entry in $batch.localValidation.commands) {
    $skipReason = $null
    if ($SkipNpmCi -and $entry.id -eq 'npm-ci') {
        $skipReason = 'SKIPPED_BY_SWITCH:SkipNpmCi'
    }
    elseif ($SkipBrowserInstall -and $entry.id -eq 'playwright-chromium') {
        $skipReason = 'SKIPPED_BY_SWITCH:SkipBrowserInstall'
    }
    elseif ($null -ne $failedRequiredCommandId) {
        $skipReason = "FAIL_FAST_AFTER:$failedRequiredCommandId"
    }

    if ($null -ne $skipReason) {
        $commandResults.Add((New-NotRunResult $entry $skipReason))
        if ([bool]$entry.required -and $null -eq $failedRequiredCommandId) {
            $failedRequiredCommandId = [string]$entry.id
        }
        continue
    }

    $safeId = ([string]$entry.id -replace '[^A-Za-z0-9_.-]', '_')
    $stdoutPath = Join-Path $logRoot "$safeId.stdout.log"
    $stderrPath = Join-Path $logRoot "$safeId.stderr.log"
    [System.IO.File]::WriteAllText($stdoutPath, '', $Utf8NoBom)
    [System.IO.File]::WriteAllText($stderrPath, '', $Utf8NoBom)

    Write-Host "[$BatchId] Ejecutando: $($entry.command)" -ForegroundColor Cyan
    $commandStarted = [DateTimeOffset]::Now
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $exitCode = 1
    try {
        $process = Start-Process -FilePath 'cmd.exe' `
            -ArgumentList @('/d', '/s', '/c', [string]$entry.command) `
            -WorkingDirectory $projectRoot `
            -Wait -PassThru -NoNewWindow `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath
        $exitCode = [int]$process.ExitCode
    }
    catch {
        $exitCode = 9009
        [System.IO.File]::AppendAllText($stderrPath, ($_.Exception.ToString() + [Environment]::NewLine), $Utf8NoBom)
    }
    finally {
        $stopwatch.Stop()
    }
    $commandFinished = [DateTimeOffset]::Now
    $stdoutItem = Get-Item -LiteralPath $stdoutPath
    $stderrItem = Get-Item -LiteralPath $stderrPath
    $policyViolation = if ($exitCode -eq 0) {
        Get-TestLogPolicyViolation $entry $stdoutPath $stderrPath
    } else {
        $null
    }
    $status = if ($exitCode -eq 0 -and $null -eq $policyViolation) { 'PASS' } else { 'FAIL' }
    $failureReason = if ($null -ne $policyViolation) { [string]$policyViolation } else { $null }

    $commandResults.Add([ordered]@{
        id = [string]$entry.id
        category = [string]$entry.category
        command = [string]$entry.command
        required = [bool]$entry.required
        startedAt = $commandStarted.ToString('o')
        finishedAt = $commandFinished.ToString('o')
        durationMilliseconds = [int64]$stopwatch.ElapsedMilliseconds
        exitCode = $exitCode
        status = $status
        stdoutLog = "logs/$safeId.stdout.log"
        stderrLog = "logs/$safeId.stderr.log"
        stdoutSha256 = Get-Sha256 $stdoutPath
        stderrSha256 = Get-Sha256 $stderrPath
        stdoutBytes = [int64]$stdoutItem.Length
        stderrBytes = [int64]$stderrItem.Length
        reason = $failureReason
    })

    if ([bool]$entry.required -and $status -eq 'FAIL') {
        $failedRequiredCommandId = [string]$entry.id
        Write-Host "Fallo requerido en $($entry.id). Los pasos restantes quedarán registrados como NOT_RUN." -ForegroundColor Red
        if ($null -ne $policyViolation) {
            Write-Host "Violación de política de tests: $policyViolation" -ForegroundColor Red
        }
        if ($stdoutItem.Length -gt 0) {
            Write-Host '--- stdout ---' -ForegroundColor DarkYellow
            Get-Content -LiteralPath $stdoutPath -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
        }
        if ($stderrItem.Length -gt 0) {
            Write-Host '--- stderr ---' -ForegroundColor DarkYellow
            Get-Content -LiteralPath $stderrPath -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
        }
    }
}

$specifyTreeSha256After = Get-TreeSha256 (Join-Path $projectRoot '.specify')
$sourceTasksSha256After = Get-Sha256 $sourceTasksPath
$targetFileHashesAfter = Get-TargetHashes $projectRoot $batch
$targetFilesUnchanged = Test-OrderedHashesEqual $targetFileHashesBefore $targetFileHashesAfter

$requiredResults = @($commandResults | Where-Object required)
$requiredPassCount = @($requiredResults | Where-Object status -eq 'PASS').Count
$requiredFailCount = @($requiredResults | Where-Object status -eq 'FAIL').Count
$requiredNotRunCount = @($requiredResults | Where-Object status -eq 'NOT_RUN').Count
$overallPass = (
    $commandResults.Count -eq @($batch.localValidation.commands).Count -and
    $requiredPassCount -eq $requiredResults.Count -and
    $requiredFailCount -eq 0 -and
    $requiredNotRunCount -eq 0 -and
    $specifyTreeSha256After -eq $specifyTreeSha256Before -and
    $sourceTasksSha256After -eq $sourceTasksSha256Before -and
    $targetFilesUnchanged
)

$regenerablePaths = @('node_modules', 'dist', 'playwright-report', 'test-results', '.wrangler', 'coverage')
$regenerableArtifacts = @(
    foreach ($relativePath in $regenerablePaths) {
        [ordered]@{
            path = $relativePath
            presentAfterValidation = Test-Path -LiteralPath (Join-Path $projectRoot $relativePath)
            packageDisposition = 'EXCLUDED_FROM_CANDIDATE_PACKAGE'
        }
    }
)

$evidence = [ordered]@{
    '$schema' = 'implementation-control/schemas/local-validation-evidence.schema.json'
    schemaVersion = '1.1.0'
    batchId = $BatchId
    candidateRoot = $projectRoot
    candidate = [ordered]@{
        logicalZipName = [string]$metadata.logicalZipName
        zipSha256 = $candidateZipSha256
        sidecarFileName = [string]$metadata.finalSha256Sidecar
        sidecarExpectedSha256 = $sidecarExpectedSha256
        sidecarMatch = $sidecarMatches
        rootDirectory = [string]$metadata.rootDirectory
        archiveFileCount = $archiveInspection.archiveFileCount
        archiveRootCount = $archiveInspection.archiveRootCount
        archiveCrcRead = $archiveInspection.archiveCrcRead
        archiveSafePaths = $archiveInspection.archiveSafePaths
        archiveMatchesExtraction = $archiveInspection.archiveMatchesExtraction
        archiveSymlinksDetected = $archiveInspection.archiveSymlinksDetected
        archiveCaseFoldCollisionsDetected = $archiveInspection.archiveCaseFoldCollisionsDetected
        archiveNestedArchivesDetected = $archiveInspection.archiveNestedArchivesDetected
        fileManifestSha256 = Get-Sha256 $manifestPath
        fileManifestValid = [bool]$manifestValid
        inventorySha256 = Get-Sha256 $inventoryPath
        inventoryValid = [bool]$inventoryValid
        metadataSha256 = Get-Sha256 $metadataPath
        metadataValid = [bool]$metadataValid
        extractedTreeSha256 = $extractedTreeSha256
    }
    environment = $environment
    startedAt = $startedAt
    finishedAt = [DateTimeOffset]::Now.ToString('o')
    status = if ($overallPass) { 'PASS' } else { 'FAIL' }
    commandSummary = [ordered]@{
        expectedCommandCount = @($batch.localValidation.commands).Count
        recordedCommandCount = $commandResults.Count
        requiredPassCount = $requiredPassCount
        requiredFailCount = $requiredFailCount
        requiredNotRunCount = $requiredNotRunCount
    }
    commands = $commandResults
    specifyTreeSha256Before = $specifyTreeSha256Before
    specifyTreeSha256After = $specifyTreeSha256After
    sourceTasksSha256Before = $sourceTasksSha256Before
    sourceTasksSha256After = $sourceTasksSha256After
    targetFileHashesBefore = $targetFileHashesBefore
    targetFileHashesAfter = $targetFileHashesAfter
    targetFilesUnchanged = $targetFilesUnchanged
    regenerableArtifacts = $regenerableArtifacts
}

$evidencePath = Join-Path $evidenceRoot "$BatchId-local-validation.json"
$json = $evidence | ConvertTo-Json -Depth 30
[System.IO.File]::WriteAllText($evidencePath, ($json + [Environment]::NewLine), $Utf8NoBom)
$zipPath = "$evidenceRoot.zip"
Compress-Archive -Path (Join-Path $evidenceRoot '*') -DestinationPath $zipPath -Force

if (-not $overallPass) {
    Write-Host "Validación FAIL. Evidencia externa: $zipPath" -ForegroundColor Red
    exit 1
}

Write-Host "Validación PASS. Evidencia externa: $zipPath" -ForegroundColor Green
exit 0
