[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ZipPath,

    [string]$SidecarPath,
    [string]$WorkingDirectory,
    [switch]$SkipNpmCi,
    [switch]$SkipBrowserInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$RegenerableRoots = @('node_modules', 'dist', 'playwright-report', 'test-results', '.wrangler', 'coverage')

function Get-Sha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Get-VersionOutput([string]$Executable, [string[]]$Arguments) {
    $output = & $Executable @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo obtener la versión de $Executable."
    }
    return (($output | Select-Object -First 1).ToString()).Trim()
}

function Get-RelativeFileRecords([string]$Directory, [switch]$ExcludeRegenerable) {
    $root = (Resolve-Path -LiteralPath $Directory).Path
    $separator = [System.IO.Path]::DirectorySeparatorChar.ToString()
    $rootPrefix = $root.TrimEnd([char[]]@('\', '/')) + $separator
    return Get-ChildItem -LiteralPath $root -File -Recurse |
        ForEach-Object {
            if (-not $_.FullName.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "El archivo no pertenece al árbol esperado: $($_.FullName)"
            }
            $relativePath = $_.FullName.Substring($rootPrefix.Length).Replace('\', '/')
            $topLevel = ($relativePath -split '/')[0]
            if (-not $ExcludeRegenerable -or $topLevel -notin $RegenerableRoots) {
                [pscustomobject]@{
                    File = $_
                    RelativePath = $relativePath
                }
            }
        } |
        Sort-Object RelativePath
}

function Get-TreeSha256([string]$Directory, [switch]$ExcludeRegenerable) {
    $records = @(Get-RelativeFileRecords $Directory -ExcludeRegenerable:$ExcludeRegenerable)
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

function Get-ControlFileHashes([string]$ProjectRoot) {
    $paths = @(
        'implementation-control/TASK_SOURCE_LOCK.json',
        'implementation-control/IMPLEMENTATION_BATCH_MAP.json',
        'implementation-control/IMPLEMENTATION_STATE.json',
        'implementation-control/AUTHORITY_MATRIX.json',
        'PACKAGE_METADATA.json',
        'PACKAGE_INVENTORY.json',
        'FILE_MANIFEST.sha256',
        'implementation-control/PROJECT_CONFIGURATION_INSTRUCTIONS.txt'
    )
    $hashes = [ordered]@{}
    foreach ($relativePath in $paths) {
        $absolutePath = Join-Path $ProjectRoot $relativePath.Replace('/', '\')
        if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
            throw "Falta el archivo de control: $relativePath"
        }
        $hashes[$relativePath] = Get-Sha256 $absolutePath
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

function Add-Check(
    [System.Collections.Generic.List[object]]$Checks,
    [string]$Id,
    [bool]$Passed,
    [string]$Details
) {
    $Checks.Add([ordered]@{
        id = $Id
        status = if ($Passed) { 'PASS' } else { 'FAIL' }
        details = $Details
    })
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
        $relativePath = [string]$record.RelativePath
        if (-not $expected.ContainsKey($relativePath)) {
            throw "Archivo no registrado en FILE_MANIFEST.sha256: $relativePath"
        }
        if ((Get-Sha256 $record.File.FullName) -ne [string]$expected[$relativePath]) {
            throw "Hash de manifiesto inconsistente para $relativePath."
        }
    }
    return $true
}

function Assert-PackageInventory([string]$ProjectRoot) {
    $inventoryPath = Join-Path $ProjectRoot 'PACKAGE_INVENTORY.json'
    $inventory = Get-Content -LiteralPath $inventoryPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $items = @($inventory.files)
    if ([int]$inventory.itemCount -ne $items.Count) {
        throw 'PACKAGE_INVENTORY.json tiene itemCount inconsistente.'
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
        throw 'PACKAGE_INVENTORY.json no cubre exactamente el árbol autorizado.'
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

function Resolve-Sidecar([string]$ResolvedZipPath, [string]$RequestedSidecarPath) {
    if (-not [string]::IsNullOrWhiteSpace($RequestedSidecarPath)) {
        return (Resolve-Path -LiteralPath $RequestedSidecarPath).Path
    }
    $directory = Split-Path -Parent $ResolvedZipPath
    $candidates = @(
        "$ResolvedZipPath.sha256",
        (Join-Path $directory ((Split-Path -Leaf $ResolvedZipPath) + '.sha256'))
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    $zipHash = Get-Sha256 $ResolvedZipPath
    foreach ($file in Get-ChildItem -LiteralPath $directory -File -Filter '*.sha256') {
        $text = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        if ($text -match "(?i)\b$zipHash\b") {
            return $file.FullName
        }
    }
    throw 'No se encontró un sidecar SHA-256 que corresponda al ZIP.'
}

function Read-Sidecar([string]$ResolvedSidecarPath) {
    $lines = @(Get-Content -LiteralPath $ResolvedSidecarPath -Encoding UTF8 | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($lines.Count -ne 1 -or $lines[0] -notmatch '^(?<hash>[0-9a-fA-F]{64})\s{2}(?<name>[^\\/]+\.zip)$') {
        throw 'El sidecar debe contener exactamente: <SHA-256><dos espacios><nombre lógico .zip>.'
    }
    return [ordered]@{
        sha256 = ([string]$Matches.hash).ToLowerInvariant()
        logicalZipName = [string]$Matches.name
    }
}

function Inspect-And-ExtractArchive([string]$ResolvedZipPath, [string]$ExtractionParent) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    New-Item -ItemType Directory -Path $ExtractionParent -Force | Out-Null

    $roots = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $caseFoldPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $archiveFiles = @{}
    $symlinkCount = 0
    $caseFoldCollisionCount = 0
    $nestedArchiveCount = 0
    $safePaths = $true
    $crcRead = $true

    $archive = [System.IO.Compression.ZipFile]::OpenRead($ResolvedZipPath)
    try {
        foreach ($entry in $archive.Entries) {
            $normalized = ([string]$entry.FullName).Replace('\', '/')
            if ([string]::IsNullOrWhiteSpace($normalized)) { continue }
            if ($normalized.StartsWith('/') -or $normalized.StartsWith('\') -or $normalized -match '^[A-Za-z]:') {
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
                if ($segment -match '[<>:"|?*\x00-\x1F]' -or $segment.EndsWith('.') -or $segment.EndsWith(' ') -or $baseName -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') {
                    $safePaths = $false
                }
            }
            if (-not $caseFoldPaths.Add($normalized)) { $caseFoldCollisionCount++ }
            $unixFileType = (($entry.ExternalAttributes -shr 16) -band 0xF000)
            if ($unixFileType -eq 0xA000) { $symlinkCount++ }
            if ($normalized.EndsWith('/')) { continue }
            if ($normalized -match '(?i)\.(zip|7z|rar|tar|tgz|gz|bz2|xz)$') { $nestedArchiveCount++ }
            if ($segments.Count -lt 2 -or $archiveFiles.ContainsKey($normalized)) {
                $safePaths = $false
                continue
            }

            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            $stream = $null
            try {
                $stream = $entry.Open()
                $hashBytes = $sha256.ComputeHash($stream)
                $archiveFiles[$normalized] = ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
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

        if (-not $safePaths -or $roots.Count -ne 1 -or $symlinkCount -ne 0 -or $caseFoldCollisionCount -ne 0 -or $nestedArchiveCount -ne 0) {
            throw 'El ZIP no supera la inspección de seguridad previa a la extracción.'
        }

        $destinationRoot = [System.IO.Path]::GetFullPath($ExtractionParent).TrimEnd([char[]]@('\', '/')) + [System.IO.Path]::DirectorySeparatorChar
        foreach ($entry in $archive.Entries) {
            $normalized = ([string]$entry.FullName).Replace('\', '/')
            if ([string]::IsNullOrWhiteSpace($normalized)) { continue }
            $destination = [System.IO.Path]::GetFullPath((Join-Path $ExtractionParent $normalized.Replace('/', '\')))
            if (-not $destination.StartsWith($destinationRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "La extracción intentó salir del directorio autorizado: $normalized"
            }
            if ($normalized.EndsWith('/')) {
                New-Item -ItemType Directory -Path $destination -Force | Out-Null
                continue
            }
            $parent = Split-Path -Parent $destination
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
        }
    }
    finally {
        $archive.Dispose()
    }

    $rootName = [string](@($roots | Sort-Object)[0])
    $projectRoot = Join-Path $ExtractionParent $rootName
    if (-not (Test-Path -LiteralPath $projectRoot -PathType Container)) {
        throw "No se encontró la raíz extraída: $projectRoot"
    }

    $matchesExtraction = $true
    $actualFiles = @{}
    foreach ($record in Get-RelativeFileRecords $projectRoot) {
        $fullArchivePath = "$rootName/$($record.RelativePath)"
        $actualFiles[$fullArchivePath] = $record.File.FullName
    }
    if ($actualFiles.Count -ne $archiveFiles.Count) {
        $matchesExtraction = $false
    }
    if ($matchesExtraction) {
        foreach ($archivePath in $archiveFiles.Keys) {
            if (-not $actualFiles.ContainsKey($archivePath) -or (Get-Sha256 $actualFiles[$archivePath]) -ne [string]$archiveFiles[$archivePath]) {
                $matchesExtraction = $false
                break
            }
        }
    }

    return [ordered]@{
        projectRoot = $projectRoot
        rootDirectory = $rootName
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

$resolvedZipPath = (Resolve-Path -LiteralPath $ZipPath).Path
$resolvedSidecarPath = Resolve-Sidecar $resolvedZipPath $SidecarPath
$sidecar = Read-Sidecar $resolvedSidecarPath
$zipSha256 = Get-Sha256 $resolvedZipPath
$sidecarMatch = $zipSha256 -eq [string]$sidecar.sha256
if (-not $sidecarMatch) {
    throw 'El SHA-256 real del ZIP no coincide con el sidecar.'
}

$baseDirectory = Split-Path -Parent $resolvedZipPath
$stamp = [DateTimeOffset]::Now.ToString('yyyyMMdd-HHmmss')
if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) {
    $WorkingDirectory = Join-Path $baseDirectory "FinScope_validation_$stamp"
}
$workingRoot = [System.IO.Path]::GetFullPath($WorkingDirectory)
if (Test-Path -LiteralPath $workingRoot) {
    Remove-Item -LiteralPath $workingRoot -Recurse -Force
}
$extractionParent = Join-Path $workingRoot 'extracted'
$evidenceRoot = Join-Path $workingRoot 'evidence'
$logRoot = Join-Path $evidenceRoot 'logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$startedAt = [DateTimeOffset]::Now.ToString('o')
$preflightChecks = [System.Collections.Generic.List[object]]::new()
$archiveInspection = Inspect-And-ExtractArchive $resolvedZipPath $extractionParent
$projectRoot = [string]$archiveInspection.projectRoot
$metadataPath = Join-Path $projectRoot 'PACKAGE_METADATA.json'
$inventoryPath = Join-Path $projectRoot 'PACKAGE_INVENTORY.json'
$manifestPath = Join-Path $projectRoot 'FILE_MANIFEST.sha256'
$metadata = Get-Content -LiteralPath $metadataPath -Raw -Encoding UTF8 | ConvertFrom-Json

$sidecarFileNameMatch = [string]$sidecar.logicalZipName -eq [string]$metadata.logicalZipName
Add-Check $preflightChecks 'ZIP_SHA256_MATCH' $sidecarMatch "real=$zipSha256"
Add-Check $preflightChecks 'SIDECAR_LOGICAL_NAME_MATCH' $sidecarFileNameMatch "sidecar=$($sidecar.logicalZipName); metadata=$($metadata.logicalZipName)"
Add-Check $preflightChecks 'ARCHIVE_SINGLE_ROOT' ($archiveInspection.archiveRootCount -eq 1) "root=$($archiveInspection.rootDirectory)"
Add-Check $preflightChecks 'ARCHIVE_CRC_READ' $archiveInspection.archiveCrcRead 'Todas las entradas fueron leídas completamente.'
Add-Check $preflightChecks 'ARCHIVE_SAFE_PATHS' $archiveInspection.archiveSafePaths 'Sin traversal, rutas absolutas ni nombres Windows inválidos.'
Add-Check $preflightChecks 'ARCHIVE_MATCHES_EXTRACTION' $archiveInspection.archiveMatchesExtraction 'ZIP y extracción coinciden byte a byte.'
Add-Check $preflightChecks 'ARCHIVE_NO_SYMLINKS' ($archiveInspection.archiveSymlinksDetected -eq 0) "count=$($archiveInspection.archiveSymlinksDetected)"
Add-Check $preflightChecks 'ARCHIVE_NO_CASEFOLD_COLLISIONS' ($archiveInspection.archiveCaseFoldCollisionsDetected -eq 0) "count=$($archiveInspection.archiveCaseFoldCollisionsDetected)"
Add-Check $preflightChecks 'ARCHIVE_NO_NESTED_ARCHIVES' ($archiveInspection.archiveNestedArchivesDetected -eq 0) "count=$($archiveInspection.archiveNestedArchivesDetected)"
Add-Check $preflightChecks 'METADATA_ROOT_MATCH' ([string]$metadata.rootDirectory -eq [string]$archiveInspection.rootDirectory) "metadata=$($metadata.rootDirectory); archive=$($archiveInspection.rootDirectory)"

$manifestValid = $false
$inventoryValid = $false
try { $manifestValid = Assert-FileManifest $projectRoot } catch { Add-Check $preflightChecks 'FILE_MANIFEST_VALID' $false $_.Exception.Message }
if ($manifestValid) { Add-Check $preflightChecks 'FILE_MANIFEST_VALID' $true 'Cobertura y hashes exactos.' }
try { $inventoryValid = Assert-PackageInventory $projectRoot } catch { Add-Check $preflightChecks 'PACKAGE_INVENTORY_VALID' $false $_.Exception.Message }
if ($inventoryValid) { Add-Check $preflightChecks 'PACKAGE_INVENTORY_VALID' $true 'Cobertura, tamaños y hashes exactos.' }

$metadataValid = (
    [string]$metadata.rootDirectory -eq [string]$archiveInspection.rootDirectory -and
    [string]$metadata.logicalZipName -eq [string]$sidecar.logicalZipName -and
    [string]$metadata.finalSha256Sidecar -eq ([string]$metadata.logicalZipName + '.sha256')
)
Add-Check $preflightChecks 'PACKAGE_METADATA_VALID' $metadataValid "zip=$($metadata.logicalZipName); sidecar=$($metadata.finalSha256Sidecar)"

$internalValidationScript = Join-Path $projectRoot 'implementation-control\scripts\Invoke-FinScopeControlPlaneValidation.ps1'
$scriptHashMatch = (Test-Path -LiteralPath $internalValidationScript -PathType Leaf) -and ((Get-Sha256 $PSCommandPath) -eq (Get-Sha256 $internalValidationScript))
Add-Check $preflightChecks 'VALIDATOR_SCRIPT_PROVENANCE' $scriptHashMatch 'El script ejecutado coincide byte a byte con el incluido en el candidato.'

$preflightStateStdout = Join-Path $logRoot 'preflight-control-plane.stdout.log'
$preflightStateStderr = Join-Path $logRoot 'preflight-control-plane.stderr.log'
Write-Utf8NoBom $preflightStateStdout ''
Write-Utf8NoBom $preflightStateStderr ''
$stateValidatorPath = Join-Path $projectRoot 'implementation-control\scripts\Validate-ControlPlaneState.mjs'
$stateExitCode = 9009
try {
    $stateProcess = Start-Process -FilePath 'node.exe' `
        -ArgumentList @($stateValidatorPath, $projectRoot) `
        -WorkingDirectory $projectRoot `
        -Wait -PassThru -NoNewWindow `
        -RedirectStandardOutput $preflightStateStdout `
        -RedirectStandardError $preflightStateStderr
    $stateExitCode = [int]$stateProcess.ExitCode
}
catch {
    [System.IO.File]::AppendAllText($preflightStateStderr, ($_.Exception.ToString() + [Environment]::NewLine), $Utf8NoBom)
}
$stateValid = $stateExitCode -eq 0
$stateDetails = if ($stateValid) { 'TASK_SOURCE_LOCK, 109 tareas, 25 mirrors, estado, gates y metadata sincronizados.' } else { "ExitCode=$stateExitCode. Revisar logs/preflight-control-plane.*.log" }
Add-Check $preflightChecks 'CONTROL_PLANE_STATE_VALID' $stateValid $stateDetails

$preflightFailCount = @($preflightChecks | Where-Object status -eq 'FAIL').Count
$preflightPassCount = @($preflightChecks | Where-Object status -eq 'PASS').Count
$preflightPass = $preflightFailCount -eq 0

$state = Get-Content -LiteralPath (Join-Path $projectRoot 'implementation-control\IMPLEMENTATION_STATE.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$specifyTreeSha256Before = Get-TreeSha256 (Join-Path $projectRoot '.specify')
$sourceTasksPath = Join-Path $projectRoot 'specs\001-fundamental-analysis-platform\tasks.md'
$sourceTasksSha256Before = Get-Sha256 $sourceTasksPath
$controlFileHashesBefore = Get-ControlFileHashes $projectRoot
$sourceTreeSha256Before = Get-TreeSha256 $projectRoot -ExcludeRegenerable
$extractedTreeSha256 = Get-TreeSha256 $projectRoot

Add-Check $preflightChecks 'SPECIFY_HASH_MATCH' ($specifyTreeSha256Before -eq [string]$state.specifyTreeSha256) "actual=$specifyTreeSha256Before"
Add-Check $preflightChecks 'TASKS_HASH_MATCH' ($sourceTasksSha256Before -eq [string]$state.sourceTasksSha256) "actual=$sourceTasksSha256Before"
$preflightFailCount = @($preflightChecks | Where-Object status -eq 'FAIL').Count
$preflightPassCount = @($preflightChecks | Where-Object status -eq 'PASS').Count
$preflightPass = $preflightFailCount -eq 0

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
$powerShellEdition = if ($PSVersionTable.PSObject.Properties.Name -contains 'PSEdition') { [string]$PSVersionTable.PSEdition } else { 'Desktop' }
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

$commands = @(
    [ordered]@{ id = 'npm-ci'; category = 'dependencies'; command = 'npm ci'; required = $true },
    [ordered]@{ id = 'playwright-chromium'; category = 'browser'; command = 'npm exec playwright install chromium'; required = $true },
    [ordered]@{ id = 'control-plane-state'; category = 'control'; command = 'npm run validate:control-plane'; required = $true },
    [ordered]@{ id = 'typecheck'; category = 'static'; command = 'npm run typecheck'; required = $true },
    [ordered]@{ id = 'test-control-plane'; category = 'contract'; command = 'npm run test:contract -- tests/contract/control-plane-integrity.test.ts tests/contract/test-discovery.test.ts tests/contract/schema-registry.test.ts'; required = $true },
    [ordered]@{ id = 'regression-vitest'; category = 'regression'; command = 'npm run test'; required = $true },
    [ordered]@{ id = 'regression-browser'; category = 'regression'; command = 'npm run test:browser'; required = $true },
    [ordered]@{ id = 'build'; category = 'build'; command = 'npm run build'; required = $true }
)

$commandResults = [System.Collections.Generic.List[object]]::new()
$failedRequiredCommandId = if ($preflightPass) { $null } else { 'preflight' }
foreach ($entry in $commands) {
    $skipReason = $null
    if ($SkipNpmCi -and $entry.id -eq 'npm-ci') { $skipReason = 'SKIPPED_BY_SWITCH:SkipNpmCi' }
    elseif ($SkipBrowserInstall -and $entry.id -eq 'playwright-chromium') { $skipReason = 'SKIPPED_BY_SWITCH:SkipBrowserInstall' }
    elseif ($null -ne $failedRequiredCommandId) { $skipReason = "FAIL_FAST_AFTER:$failedRequiredCommandId" }

    if ($null -ne $skipReason) {
        $commandResults.Add((New-NotRunResult $entry $skipReason))
        if ([bool]$entry.required -and $null -eq $failedRequiredCommandId) { $failedRequiredCommandId = [string]$entry.id }
        continue
    }

    $safeId = ([string]$entry.id -replace '[^A-Za-z0-9_.-]', '_')
    $stdoutPath = Join-Path $logRoot "$safeId.stdout.log"
    $stderrPath = Join-Path $logRoot "$safeId.stderr.log"
    Write-Utf8NoBom $stdoutPath ''
    Write-Utf8NoBom $stderrPath ''

    Write-Host "[CONTROL-PLANE] Ejecutando: $($entry.command)" -ForegroundColor Cyan
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
    finally { $stopwatch.Stop() }

    $commandFinished = [DateTimeOffset]::Now
    $stdoutItem = Get-Item -LiteralPath $stdoutPath
    $stderrItem = Get-Item -LiteralPath $stderrPath
    $policyViolation = if ($exitCode -eq 0) { Get-TestLogPolicyViolation $entry $stdoutPath $stderrPath } else { $null }
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
        Write-Host "Fallo requerido en $($entry.id). Los pasos restantes quedarán NOT_RUN." -ForegroundColor Red
    }
}

$specifyTreeSha256After = Get-TreeSha256 (Join-Path $projectRoot '.specify')
$sourceTasksSha256After = Get-Sha256 $sourceTasksPath
$controlFileHashesAfter = Get-ControlFileHashes $projectRoot
$sourceTreeSha256After = Get-TreeSha256 $projectRoot -ExcludeRegenerable
$controlFilesUnchanged = Test-OrderedHashesEqual $controlFileHashesBefore $controlFileHashesAfter
$sourceTreeUnchanged = $sourceTreeSha256Before -eq $sourceTreeSha256After

$requiredResults = @($commandResults | Where-Object required)
$requiredPassCount = @($requiredResults | Where-Object status -eq 'PASS').Count
$requiredFailCount = @($requiredResults | Where-Object status -eq 'FAIL').Count
$requiredNotRunCount = @($requiredResults | Where-Object status -eq 'NOT_RUN').Count
$preliminaryPass = (
    $preflightPass -and
    $commandResults.Count -eq $commands.Count -and
    $requiredPassCount -eq $requiredResults.Count -and
    $requiredFailCount -eq 0 -and
    $requiredNotRunCount -eq 0 -and
    $specifyTreeSha256After -eq $specifyTreeSha256Before -and
    $sourceTasksSha256After -eq $sourceTasksSha256Before -and
    $controlFilesUnchanged -and
    $sourceTreeUnchanged
)

$regenerableArtifacts = @(
    foreach ($relativePath in $RegenerableRoots) {
        [ordered]@{
            path = $relativePath
            presentAfterValidation = Test-Path -LiteralPath (Join-Path $projectRoot $relativePath)
            packageDisposition = 'EXCLUDED_FROM_CANDIDATE_PACKAGE'
        }
    }
)

$schemaRelativePath = 'implementation-control/schemas/control-plane-validation-evidence.schema.json'
$validatorRelativePath = 'implementation-control/scripts/Validate-ControlPlaneEvidence.mjs'
$schemaPath = Join-Path $projectRoot $schemaRelativePath.Replace('/', '\')
$validatorPath = Join-Path $projectRoot $validatorRelativePath.Replace('/', '\')
$evidencePath = Join-Path $evidenceRoot 'control-plane-validation.json'
$validatorCommand = "node `"$validatorPath`" `"$schemaPath`" `"$evidencePath`""

$evidence = [ordered]@{
    '$schema' = $schemaRelativePath
    schemaVersion = '1.0.0'
    validationType = 'CONTROL_PLANE_REMEDIATION'
    candidateRoot = $projectRoot
    candidate = [ordered]@{
        logicalZipName = [string]$metadata.logicalZipName
        zipSha256 = $zipSha256
        sidecarFileName = [string]$sidecar.logicalZipName
        sidecarExpectedSha256 = [string]$sidecar.sha256
        sidecarMatch = $sidecarMatch
        sidecarFileNameMatch = $sidecarFileNameMatch
        rootDirectory = [string]$archiveInspection.rootDirectory
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
    status = if ($preliminaryPass) { 'PASS' } else { 'FAIL' }
    preflight = [ordered]@{
        status = if ($preflightPass) { 'PASS' } else { 'FAIL' }
        passCount = $preflightPassCount
        failCount = $preflightFailCount
        checks = $preflightChecks
    }
    commandSummary = [ordered]@{
        expectedCommandCount = $commands.Count
        recordedCommandCount = $commandResults.Count
        requiredPassCount = $requiredPassCount
        requiredFailCount = $requiredFailCount
        requiredNotRunCount = $requiredNotRunCount
    }
    commands = $commandResults
    invariants = [ordered]@{
        specifyTreeSha256Before = $specifyTreeSha256Before
        specifyTreeSha256After = $specifyTreeSha256After
        sourceTasksSha256Before = $sourceTasksSha256Before
        sourceTasksSha256After = $sourceTasksSha256After
        controlFileHashesBefore = $controlFileHashesBefore
        controlFileHashesAfter = $controlFileHashesAfter
        controlFilesUnchanged = $controlFilesUnchanged
        sourceTreeSha256Before = $sourceTreeSha256Before
        sourceTreeSha256After = $sourceTreeSha256After
        sourceTreeUnchanged = $sourceTreeUnchanged
    }
    schemaValidation = [ordered]@{
        schemaPath = $schemaRelativePath
        status = 'PASS'
        validatorCommand = $validatorCommand
    }
    regenerableArtifacts = $regenerableArtifacts
}

$json = $evidence | ConvertTo-Json -Depth 40
Write-Utf8NoBom $evidencePath ($json + [Environment]::NewLine)
$schemaStdout = Join-Path $logRoot 'evidence-schema.stdout.log'
$schemaStderr = Join-Path $logRoot 'evidence-schema.stderr.log'
$schemaExitCode = 1
if (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules') -PathType Container) {
    $schemaProcess = Start-Process -FilePath 'node.exe' `
        -ArgumentList @($validatorPath, $schemaPath, $evidencePath) `
        -WorkingDirectory $projectRoot `
        -Wait -PassThru -NoNewWindow `
        -RedirectStandardOutput $schemaStdout `
        -RedirectStandardError $schemaStderr
    $schemaExitCode = [int]$schemaProcess.ExitCode
}
else {
    Write-Utf8NoBom $schemaStdout ''
    Write-Utf8NoBom $schemaStderr 'node_modules no existe; la evidencia no pudo validarse con Ajv.'
}

$schemaPass = $schemaExitCode -eq 0
if (-not $schemaPass) {
    $evidence.status = 'FAIL'
    $evidence.schemaValidation.status = 'FAIL'
    $evidence.finishedAt = [DateTimeOffset]::Now.ToString('o')
    $json = $evidence | ConvertTo-Json -Depth 40
    Write-Utf8NoBom $evidencePath ($json + [Environment]::NewLine)
}

$finalPass = $preliminaryPass -and $schemaPass
$evidenceZipPath = Join-Path $baseDirectory "FinScope_control_plane_evidence_$stamp.zip"
if (Test-Path -LiteralPath $evidenceZipPath) { Remove-Item -LiteralPath $evidenceZipPath -Force }
Compress-Archive -Path (Join-Path $evidenceRoot '*') -DestinationPath $evidenceZipPath -Force

Write-Host "Extracción limpia: $projectRoot" -ForegroundColor Yellow
if ($finalPass) {
    Write-Host "Validación PASS. Evidencia externa: $evidenceZipPath" -ForegroundColor Green
    exit 0
}
Write-Host "Validación FAIL. Evidencia externa: $evidenceZipPath" -ForegroundColor Red
exit 1
