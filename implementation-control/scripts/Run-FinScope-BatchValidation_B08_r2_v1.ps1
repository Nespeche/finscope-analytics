#requires -Version 7.4
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$InputDirectory = $PSScriptRoot,

    [Parameter(Mandatory = $false)]
    [string]$WorkRoot = 'C:\FS\B08r2v1\work',

    [switch]$PreflightOnly,

    [switch]$SelfTestOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$BatchId = 'B08'
$MinimumPowerShellVersion = [version]'7.4.0'
$CandidateLogicalName = 'FS_B08_r2.zip'
$CandidateSidecarLogicalName = 'FS_B08_r2.zip.sha256'
$RunnerLogicalName = 'Run-FinScope-BatchValidation_B08_r2_v1.ps1'
$RunnerSidecarLogicalName = 'Run-FinScope-BatchValidation_B08_r2_v1.ps1.sha256'
$ExpectedRootDirectory = 'FinScope_v0.21.4'
$ExpectedTasksSha256 = 'd65b86ca4e1a642c3ee5b938ee2bae0a85ef941c7c42b027ee03ab0fca971a17'
$ExpectedSpecifyTreeSha256 = 'e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09'
$ExpectedSourceBaselineSha256 = '6e87f79be53a913fbf3db602cc50b1fa1fa211663596b126037c4a9b4d55be2e'
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture
$RunStamp = [DateTimeOffset]::Now.ToString('yyyyMMdd-HHmmssfff', $InvariantCulture)
$AuthenticatedRunnerSha256 = $null
$AuthenticatedCandidateSha256 = $null
$PreflightReportPath = $null
$WrapperLogRoot = $null
$EvidenceRoot = $null
$PrimaryFailure = $null
$SecondaryEvidenceErrors = [System.Collections.Generic.List[object]]::new()
$ValidatorRuntimeRoot = $null
$ResolvedInput = $null
$CandidatePhysicalPath = $null
$CandidateSidecarPhysicalPath = $null
$RunnerSidecarPhysicalPath = $null

function Write-Utf8Json {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [object]$Value
    )
    $json = $Value | ConvertTo-Json -Depth 50
    [System.IO.File]::WriteAllText($Path, ($json + [Environment]::NewLine), $Utf8NoBom)
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Write-Sha256Sidecar {
    param(
        [Parameter(Mandatory = $true)][string]$TargetPath,
        [Parameter(Mandatory = $true)][string]$LogicalName
    )
    $sidecarPath = "${TargetPath}.sha256"
    $line = "$(Get-Sha256 $TargetPath)  ${LogicalName}"
    [System.IO.File]::WriteAllText($sidecarPath, ($line + [Environment]::NewLine), $Utf8NoBom)
    return $sidecarPath
}

function Assert-Sidecar {
    param(
        [Parameter(Mandatory = $true)][string]$SidecarPath,
        [Parameter(Mandatory = $true)][string]$TargetPath,
        [Parameter(Mandatory = $true)][string]$ExpectedLogicalName
    )
    if (-not (Test-Path -LiteralPath $SidecarPath -PathType Leaf)) {
        throw "SIDECAR_MISSING: ${SidecarPath}"
    }
    if (-not (Test-Path -LiteralPath $TargetPath -PathType Leaf)) {
        throw "TARGET_MISSING: ${TargetPath}"
    }
    $lines = @(Get-Content -LiteralPath $SidecarPath -Encoding UTF8 | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($lines.Count -ne 1 -or $lines[0] -notmatch '^(?<hash>[0-9a-fA-F]{64})\s{2}(?<name>[^\\/]+)$') {
        throw "SIDECAR_FORMAT_INVALID: ${SidecarPath}"
    }
    $expectedHash = ([string]$Matches.hash).ToLowerInvariant()
    $logicalName = [string]$Matches.name
    if ($logicalName -ne $ExpectedLogicalName) {
        throw "SIDECAR_LOGICAL_NAME_MISMATCH: expected=${ExpectedLogicalName}; actual=${logicalName}"
    }
    $actualHash = Get-Sha256 $TargetPath
    if ($actualHash -ne $expectedHash) {
        throw "SIDECAR_HASH_MISMATCH: expected=${expectedHash}; actual=${actualHash}; target=${ExpectedLogicalName}"
    }
    return $actualHash
}

function Assert-PowerShellRuntime {
    if ($PSVersionTable.PSEdition -ne 'Core') {
        throw "POWERSHELL_CORE_REQUIRED: PSEdition=$($PSVersionTable.PSEdition)"
    }
    if ($PSVersionTable.PSVersion -lt $MinimumPowerShellVersion) {
        throw "POWERSHELL_VERSION_TOO_OLD: minimum=${MinimumPowerShellVersion}; actual=$($PSVersionTable.PSVersion)"
    }
}

function Assert-AstParse {
    param([Parameter(Mandatory = $true)][string]$Path)
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors)
    if (@($errors).Count -gt 0) {
        $messages = @($errors | ForEach-Object { "$($_.Extent.StartLineNumber):$($_.Extent.StartColumnNumber) $($_.Message)" })
        throw "RUNNER_AST_PARSE_FAILED: $($messages -join ' | ')"
    }
    return @($tokens).Count
}

function ConvertTo-ValidatedIsoTimestamp {
    param([Parameter(Mandatory = $true)][object]$Value)
    if ($Value -is [string]) {
        $original = [string]$Value
        if ($original -notmatch '(?:Z|[+-]\d{2}:\d{2})$') {
            throw "INVALID_COMMAND_TIMESTAMP_OFFSET: ${original}"
        }
        $parsed = [DateTimeOffset]::MinValue
        $ok = [DateTimeOffset]::TryParseExact(
            $original,
            'o',
            $InvariantCulture,
            [System.Globalization.DateTimeStyles]::RoundtripKind,
            [ref]$parsed
        )
        if (-not $ok) {
            throw "INVALID_COMMAND_TIMESTAMP_FORMAT: ${original}"
        }
        return [pscustomobject]@{ Original = $original; Parsed = $parsed }
    }
    if ($Value -is [DateTimeOffset]) {
        $text = ([DateTimeOffset]$Value).ToString('o', $InvariantCulture)
        return [pscustomobject]@{ Original = $text; Parsed = [DateTimeOffset]$Value }
    }
    if ($Value -is [DateTime]) {
        $dateTime = [DateTime]$Value
        if ($dateTime.Kind -eq [DateTimeKind]::Unspecified) {
            throw 'INVALID_COMMAND_TIMESTAMP_DATETIME_KIND: Unspecified'
        }
        $offsetValue = [DateTimeOffset]::new($dateTime)
        $text = $offsetValue.ToString('o', $InvariantCulture)
        return [pscustomobject]@{ Original = $text; Parsed = $offsetValue }
    }
    throw "INVALID_COMMAND_TIMESTAMP_TYPE: $($Value.GetType().FullName)"
}

function Assert-TimestampOrder {
    param(
        [Parameter(Mandatory = $true)][object]$StartedAt,
        [Parameter(Mandatory = $true)][object]$FinishedAt,
        [Parameter(Mandatory = $true)][string]$Scope
    )
    $start = ConvertTo-ValidatedIsoTimestamp $StartedAt
    $finish = ConvertTo-ValidatedIsoTimestamp $FinishedAt
    if ($start.Parsed -gt $finish.Parsed) {
        throw "INVALID_COMMAND_TIMESTAMP_ORDER: scope=${Scope}; startedAt=$($start.Original); finishedAt=$($finish.Original)"
    }
}

function Invoke-CultureAndJsonSelfTests {
    $originalCulture = [System.Threading.Thread]::CurrentThread.CurrentCulture
    $originalUiCulture = [System.Threading.Thread]::CurrentThread.CurrentUICulture
    try {
        foreach ($cultureName in @('es-AR', 'en-US')) {
            $culture = [System.Globalization.CultureInfo]::GetCultureInfo($cultureName)
            [System.Threading.Thread]::CurrentThread.CurrentCulture = $culture
            [System.Threading.Thread]::CurrentThread.CurrentUICulture = $culture
            $sample = '2026-07-26T00:01:02.3456789-03:00'
            $validated = ConvertTo-ValidatedIsoTimestamp $sample
            if ($validated.Original -cne $sample) {
                throw "TIMESTAMP_STRING_NOT_PRESERVED: culture=${cultureName}"
            }
            Assert-TimestampOrder $sample '2026-07-26T00:01:03.3456789-03:00' "self-test-${cultureName}"
        }
        $special = '{"":"preserved","normal":1}' | ConvertFrom-Json -AsHashtable
        if (-not $special.ContainsKey('') -or [string]$special[''] -ne 'preserved') {
            throw 'JSON_EMPTY_KEY_NOT_PRESERVED'
        }
    }
    finally {
        [System.Threading.Thread]::CurrentThread.CurrentCulture = $originalCulture
        [System.Threading.Thread]::CurrentThread.CurrentUICulture = $originalUiCulture
    }
}

function Assert-ShortWorkRoot {
    param([Parameter(Mandatory = $true)][string]$Path)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if ($fullPath -notmatch '^[A-Za-z]:\\FS\\[^\\]+\\work(?:\\)?$') {
        throw "WORK_ROOT_NOT_SHORT_OR_UNSAFE: use a path like C:\FS\B08r2v1\work; actual=${fullPath}"
    }
    if ($fullPath.Length -gt 80) {
        throw "WORK_ROOT_TOO_LONG: length=$($fullPath.Length)"
    }
    return $fullPath.TrimEnd('\')
}

function Get-RelativeFileRecords {
    param([Parameter(Mandatory = $true)][string]$Directory)
    $root = (Resolve-Path -LiteralPath $Directory).Path
    $prefix = $root.TrimEnd([char[]]@('\', '/')) + [System.IO.Path]::DirectorySeparatorChar
    return Get-ChildItem -LiteralPath $root -File -Recurse | ForEach-Object {
        if (-not $_.FullName.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "TREE_ESCAPE_DETECTED: $($_.FullName)"
        }
        [pscustomobject]@{
            File = $_
            RelativePath = $_.FullName.Substring($prefix.Length).Replace('\', '/')
        }
    } | Sort-Object RelativePath
}

function Get-TreeSha256 {
    param([Parameter(Mandatory = $true)][string]$Directory)
    $stream = [System.IO.MemoryStream]::new()
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        foreach ($record in (Get-RelativeFileRecords $Directory)) {
            $pathBytes = $Utf8NoBom.GetBytes([string]$record.RelativePath)
            $stream.Write($pathBytes, 0, $pathBytes.Length)
            $stream.WriteByte(0)
            $hex = Get-Sha256 $record.File.FullName
            [byte[]]$hashBytes = for ($index = 0; $index -lt $hex.Length; $index += 2) {
                [Convert]::ToByte($hex.Substring($index, 2), 16)
            }
            $stream.Write($hashBytes, 0, $hashBytes.Length)
            $stream.WriteByte(10)
        }
        return ([BitConverter]::ToString($sha256.ComputeHash($stream.ToArray()))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function Get-ArchiveInspection {
    param(
        [Parameter(Mandatory = $true)][string]$ZipPath,
        [Parameter(Mandatory = $true)][string]$ProjectedExtractionRoot
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $roots = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $paths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $fileCount = 0
    $symlinkCount = 0
    $caseFoldCollisionCount = 0
    $nestedArchiveCount = 0
    $crcRead = $true
    $safePaths = $true
    $maxProjectedPathLength = 0
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        foreach ($entry in $archive.Entries) {
            $entryName = [string]$entry.FullName
            $normalized = $entryName.Replace('\', '/')
            if ([string]::IsNullOrWhiteSpace($normalized)) { continue }
            if ($entryName.Contains('\')) { $safePaths = $false }
            if ($normalized.StartsWith('/') -or $normalized -match '^[A-Za-z]:') { $safePaths = $false }
            $segments = @($normalized.Split('/') | Where-Object { $_ -ne '' })
            if ($segments.Count -eq 0) { continue }
            [void]$roots.Add([string]$segments[0])
            if ($segments -contains '.' -or $segments -contains '..') { $safePaths = $false }
            foreach ($segment in $segments) {
                $baseName = [System.IO.Path]::GetFileNameWithoutExtension([string]$segment)
                if (
                    $segment -match '[<>:"|?*\x00-\x1F]' -or
                    $segment.EndsWith('.') -or
                    $segment.EndsWith(' ') -or
                    $baseName -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$'
                ) { $safePaths = $false }
            }
            if (-not $paths.Add($normalized)) { $caseFoldCollisionCount++ }
            $unixFileType = (($entry.ExternalAttributes -shr 16) -band 0xF000)
            if ($unixFileType -eq 0xA000) { $symlinkCount++ }
            $projected = Join-Path $ProjectedExtractionRoot $normalized.Replace('/', '\')
            $maxProjectedPathLength = [Math]::Max($maxProjectedPathLength, $projected.Length)
            if ($projected.Length -gt 240) { $safePaths = $false }
            if ($normalized.EndsWith('/')) { continue }
            $fileCount++
            if ($normalized -match '(?i)\.(zip|7z|rar|tar|tgz|gz|bz2|xz)$') { $nestedArchiveCount++ }
            $stream = $null
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            try {
                $stream = $entry.Open()
                [void]$sha256.ComputeHash($stream)
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
    return [ordered]@{
        fileCount = $fileCount
        rootCount = $roots.Count
        rootDirectory = if ($roots.Count -eq 1) { @($roots)[0] } else { $null }
        crcRead = $crcRead
        safePaths = $safePaths
        symlinks = $symlinkCount
        caseFoldCollisions = $caseFoldCollisionCount
        nestedArchives = $nestedArchiveCount
        maxProjectedPathLength = $maxProjectedPathLength
    }
}

function Assert-ArchiveInspection {
    param([Parameter(Mandatory = $true)][object]$Inspection)
    if (
        -not [bool]$Inspection.crcRead -or
        -not [bool]$Inspection.safePaths -or
        [int]$Inspection.rootCount -ne 1 -or
        [string]$Inspection.rootDirectory -ne $ExpectedRootDirectory -or
        [int]$Inspection.symlinks -ne 0 -or
        [int]$Inspection.caseFoldCollisions -ne 0 -or
        [int]$Inspection.nestedArchives -ne 0
    ) {
        throw "ARCHIVE_PREFLIGHT_FAILED: $($Inspection | ConvertTo-Json -Compress)"
    }
}

function Assert-FileManifest {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)
    $manifestPath = Join-Path $ProjectRoot 'FILE_MANIFEST.sha256'
    $expected = @{}
    foreach ($line in Get-Content -LiteralPath $manifestPath -Encoding UTF8) {
        if ($line -notmatch '^(?<hash>[0-9a-fA-F]{64})  (?<path>.+)$') {
            throw "FILE_MANIFEST_LINE_INVALID: ${line}"
        }
        $path = [string]$Matches.path
        if ($expected.ContainsKey($path)) { throw "FILE_MANIFEST_DUPLICATE: ${path}" }
        $expected[$path] = ([string]$Matches.hash).ToLowerInvariant()
    }
    $actual = @(Get-RelativeFileRecords $ProjectRoot | Where-Object RelativePath -ne 'FILE_MANIFEST.sha256')
    if ($actual.Count -ne $expected.Count) {
        throw "FILE_MANIFEST_COUNT_MISMATCH: expected=$($expected.Count); actual=$($actual.Count)"
    }
    foreach ($record in $actual) {
        $path = [string]$record.RelativePath
        if (-not $expected.ContainsKey($path)) { throw "FILE_MANIFEST_MISSING_PATH: ${path}" }
        if ((Get-Sha256 $record.File.FullName) -ne [string]$expected[$path]) {
            throw "FILE_MANIFEST_HASH_MISMATCH: ${path}"
        }
    }
    return $true
}

function Assert-PackageInventory {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)
    $inventoryPath = Join-Path $ProjectRoot 'PACKAGE_INVENTORY.json'
    $inventory = Get-Content -LiteralPath $inventoryPath -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
    $items = @($inventory['files'])
    if ([int]$inventory['itemCount'] -ne $items.Count) { throw 'PACKAGE_INVENTORY_ITEM_COUNT_MISMATCH' }
    $byPath = @{}
    foreach ($item in $items) {
        $path = [string]$item['path']
        if ($byPath.ContainsKey($path)) { throw "PACKAGE_INVENTORY_DUPLICATE: ${path}" }
        $byPath[$path] = $item
    }
    $actual = @(Get-RelativeFileRecords $ProjectRoot | Where-Object {
        $_.RelativePath -notin @('FILE_MANIFEST.sha256', 'PACKAGE_INVENTORY.json')
    })
    if ($actual.Count -ne $items.Count) { throw 'PACKAGE_INVENTORY_TREE_COUNT_MISMATCH' }
    foreach ($record in $actual) {
        $path = [string]$record.RelativePath
        if (-not $byPath.ContainsKey($path)) { throw "PACKAGE_INVENTORY_MISSING_PATH: ${path}" }
        $item = $byPath[$path]
        if ([int64]$item['sizeBytes'] -ne [int64]$record.File.Length) {
            throw "PACKAGE_INVENTORY_SIZE_MISMATCH: ${path}"
        }
        if ([string]$item['sha256'] -ne (Get-Sha256 $record.File.FullName)) {
            throw "PACKAGE_INVENTORY_HASH_MISMATCH: ${path}"
        }
    }
    return $true
}

function Assert-PackageHygiene {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)
    $forbiddenDirectoryNames = @(
        'node_modules','dist','build','coverage','playwright-report','test-results',
        '.wrangler','.vite','.cache','cache','tmp','temp','__pycache__'
    )
    $forbiddenFiles = [System.Collections.Generic.List[string]]::new()
    $secretHits = [System.Collections.Generic.List[string]]::new()
    $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
    $textExtensions = @('.md','.json','.ts','.svelte','.sh','.ps1','.mjs','.sha256','.html','.txt','.jsonc','.sql','.yaml','.yml','.css')
    $utf8Checked = 0
    foreach ($item in Get-ChildItem -LiteralPath $ProjectRoot -Force -Recurse) {
        $relative = $item.FullName.Substring($ProjectRoot.TrimEnd('\').Length + 1).Replace('\','/')
        if ($item.PSIsContainer) {
            if ($forbiddenDirectoryNames -contains $item.Name.ToLowerInvariant()) { $forbiddenFiles.Add($relative + '/') }
            continue
        }
        $lowerName = $item.Name.ToLowerInvariant()
        if ($lowerName -eq '.env' -or ($lowerName.StartsWith('.env.') -and $lowerName -notin @('.env.example','.env.sample'))) {
            $forbiddenFiles.Add($relative)
        }
        if ($textExtensions -contains $item.Extension.ToLowerInvariant() -or [string]::IsNullOrEmpty($item.Extension)) {
            try {
                $text = $strictUtf8.GetString([System.IO.File]::ReadAllBytes($item.FullName))
            }
            catch {
                throw "PACKAGE_TEXT_NOT_UTF8: ${relative}; $($_.Exception.Message)"
            }
            $utf8Checked++
            foreach ($pattern in @(
                '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
                '(?<![A-Za-z0-9])sk-(?:proj-)?[A-Za-z0-9_-]{20,}',
                '(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}',
                '(?<![A-Z0-9])AKIA[0-9A-Z]{16}(?![A-Z0-9])',
                '(?<![A-Za-z0-9])xox[baprs]-[A-Za-z0-9-]{16,}'
            )) {
                if ($text -match $pattern) { $secretHits.Add("${relative}:$pattern") }
            }
        }
    }
    if ($forbiddenFiles.Count -gt 0) { throw "PACKAGE_REGENERABLE_OR_ENV_ARTIFACT_DETECTED: $($forbiddenFiles -join ', ')" }
    if ($secretHits.Count -gt 0) { throw "PACKAGE_HIGH_CONFIDENCE_SECRET_DETECTED: $($secretHits -join ', ')" }
    return [ordered]@{
        status = 'PASS'
        utf8FilesChecked = $utf8Checked
        forbiddenArtifactsDetected = 0
        highConfidenceSecretsDetected = 0
    }
}

function Get-CommandOutput {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $output = & $Executable @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "COMMAND_DISCOVERY_FAILED: executable=${Executable}; output=$(($output | Out-String).Trim())"
    }
    return (($output | Select-Object -First 1) | Out-String).Trim()
}

function Assert-PreNpmExecutability {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [Parameter(Mandatory = $true)][object]$Batch
    )
    $node = Get-Command node -ErrorAction Stop
    $npm = Get-Command npm -ErrorAction Stop
    $nodeVersion = Get-CommandOutput $node.Source @('--version')
    $npmVersion = Get-CommandOutput $npm.Source @('--version')
    $packagePath = Join-Path $ProjectRoot 'package.json'
    $lockPath = Join-Path $ProjectRoot 'package-lock.json'
    $package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $lock = Get-Content -LiteralPath $lockPath -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
    if ([int]$lock['lockfileVersion'] -lt 3) { throw 'PACKAGE_LOCK_VERSION_UNSUPPORTED' }
    foreach ($entry in @($Batch.localValidation.commands)) {
        if ([string]$entry.command -match '^npm run (?<script>[^\s]+)') {
            $scriptName = [string]$Matches.script
            if ($package.scripts.PSObject.Properties.Name -notcontains $scriptName) {
                throw "NPM_SCRIPT_MISSING: ${scriptName}"
            }
        }
    }
    foreach ($relativePath in @($Batch.targetFiles + $Batch.testFiles)) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ([string]$relativePath).Replace('/', '\')) -PathType Leaf)) {
            throw "BATCH_FILE_MISSING: ${relativePath}"
        }
    }
    $browserRequired = [bool]$Batch.localValidation.browserRequired
    $requiredConfigs = [System.Collections.Generic.List[string]]::new()
    $requiredConfigs.Add('tsconfig.json')
    $requiredConfigs.Add('vitest.config.ts')
    if ($browserRequired) { $requiredConfigs.Add('playwright.config.ts') }
    foreach ($configPath in $requiredConfigs) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $configPath) -PathType Leaf)) {
            throw "TEST_DISCOVERY_CONFIG_MISSING: ${configPath}"
        }
    }
    $browserCommand = @($Batch.localValidation.commands | Where-Object id -eq 'playwright-chromium')
    if ($browserRequired -and $browserCommand.Count -ne 1) {
        throw 'BROWSER_REQUIRED_WITHOUT_SINGLE_CHROMIUM_INSTALL_COMMAND'
    }
    if (-not $browserRequired -and $browserCommand.Count -ne 0) {
        throw 'BROWSER_NOT_REQUIRED_BUT_CHROMIUM_INSTALL_COMMAND_PRESENT'
    }
    $rootPackage = $lock['packages']['']
    if ($null -eq $rootPackage) { throw 'PACKAGE_LOCK_ROOT_MISSING' }
    if ($package.devDependencies.PSObject.Properties.Name -notcontains 'vitest') {
        throw 'VITEST_DEPENDENCY_MISSING'
    }
    if (-not $lock['packages'].Contains('node_modules/vitest')) {
        throw 'PACKAGE_LOCK_DEPENDENCY_MISSING: node_modules/vitest'
    }
    $playwrightLocked = $false
    if ($browserRequired) {
        if ($package.devDependencies.PSObject.Properties.Name -notcontains '@playwright/test') {
            throw 'PLAYWRIGHT_DEPENDENCY_MISSING'
        }
        foreach ($lockedDependency in @('node_modules/@playwright/test','node_modules/playwright-core')) {
            if (-not $lock['packages'].Contains($lockedDependency)) {
                throw "PACKAGE_LOCK_DEPENDENCY_MISSING: ${lockedDependency}"
            }
        }
        $playwrightLocked = $true
    }
    return [ordered]@{
        nodePath = $node.Source
        npmPath = $npm.Source
        nodeVersion = $nodeVersion
        npmVersion = $npmVersion
        lockfileVersion = [int]$lock['lockfileVersion']
        playwrightLocked = $playwrightLocked
        chromiumInstallDerived = $browserRequired
        commandCount = @($Batch.localValidation.commands).Count
        browserRequired = $browserRequired
        chromiumInstallCommand = $(if ($browserRequired) { [string]$browserCommand[0].command } else { $null })
        testFileCount = @($Batch.testFiles).Count
    }
}


function Assert-BatchAuthorityFiles {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [Parameter(Mandatory = $true)][object]$Batch
    )
    $refs = @(
        @($Batch.primaryAuthorityRefs)
        @($Batch.acceptanceAuthorityRefs)
        @($Batch.fixtureRefs)
    ) | ForEach-Object { [string]$_ } | Sort-Object -Unique
    $paths = @($refs | ForEach-Object { ($_ -split '#', 2)[0] } | Sort-Object -Unique)
    $missing = [System.Collections.Generic.List[string]]::new()
    foreach ($relativePath in $paths) {
        if ([string]::IsNullOrWhiteSpace($relativePath)) { continue }
        $absolutePath = Join-Path $ProjectRoot $relativePath.Replace('/', '\')
        if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) { $missing.Add($relativePath) }
    }
    if ($missing.Count -gt 0) { throw "BATCH_AUTHORITY_FILE_MISSING: $($missing -join ', ')" }
    $schemaPaths = @($paths | Where-Object { $_ -match '(?i)(?:^|/)schemas/.*\.schema\.json$|openapi\.yaml$' })
    return [ordered]@{
        authorityRefCount=$refs.Count; authorityFileCount=$paths.Count; schemaFileCount=$schemaPaths.Count
        fixtureRefCount=@($Batch.fixtureRefs).Count; targetFileCount=@($Batch.targetFiles).Count
        testFileCount=@($Batch.testFiles).Count; taskCount=@($Batch.executionOrder).Count
        commandCount=@($Batch.localValidation.commands).Count; browserRequired=[bool]$Batch.localValidation.browserRequired
        authorityFiles=$paths; schemaFiles=$schemaPaths
    }
}

function Assert-ControlState {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)
    $statePath = Join-Path $ProjectRoot 'implementation-control\IMPLEMENTATION_STATE.json'
    $batchPath = Join-Path $ProjectRoot 'implementation-control\batches\B08.json'
    $lockPath = Join-Path $ProjectRoot 'implementation-control\TASK_SOURCE_LOCK.json'
    $mapPath = Join-Path $ProjectRoot 'implementation-control\IMPLEMENTATION_BATCH_MAP.json'
    $metadataPath = Join-Path $ProjectRoot 'PACKAGE_METADATA.json'
    $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $batch = Get-Content -LiteralPath $batchPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $lock = Get-Content -LiteralPath $lockPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $map = Get-Content -LiteralPath $mapPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $metadata = Get-Content -LiteralPath $metadataPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (
        -not [bool]$state.phaseGate.tasksAuthorized -or
        -not [bool]$state.phaseGate.analysisAuthorized -or
        -not [bool]$state.phaseGate.implementationAuthorized -or
        [bool]$state.phaseGate.convergenceAuthorized
    ) { throw 'PHASE_GATE_MISMATCH' }
    if ([string]$state.activeBatchId -ne $BatchId -or [string]$state.nextAuthorizedBatchId -ne $BatchId) {
        throw "ACTIVE_BATCH_MISMATCH: active=$($state.activeBatchId); next=$($state.nextAuthorizedBatchId)"
    }
    $mapEntry = @($map.batches | Where-Object batchId -eq $BatchId)
    if ($mapEntry.Count -ne 1 -or [string]$mapEntry[0].status -ne 'LOCAL_VALIDATION_REQUIRED') {
        throw 'B08_MAP_STATUS_MISMATCH'
    }
    $previousMapEntry = @($map.batches | Where-Object ordinal -eq ([int]$batch.ordinal - 1))
    if ($previousMapEntry.Count -ne 1 -or [string]$state.batchStatus.([string]$previousMapEntry[0].batchId) -ne 'COMPLETED') {
        throw "PREVIOUS_BATCH_NOT_COMPLETED: previous=$($previousMapEntry[0].batchId)"
    }
    if ([string]$state.batchStatus.$BatchId -ne 'LOCAL_VALIDATION_REQUIRED') {
        throw "ACTIVE_BATCH_STATUS_MISMATCH: $BatchId=$($state.batchStatus.$BatchId)"
    }
    if ([string]$batch.status -ne 'LOCAL_VALIDATION_REQUIRED') { throw 'B08_BATCH_FILE_STATUS_MISMATCH' }
    if ([string]$state.implementationStatus -ne 'LOCAL_VALIDATION_REQUIRED') { throw 'IMPLEMENTATION_STATUS_MISMATCH' }
    if ([string]$state.baselineRole -ne 'CANDIDATE_AWAITING_LOCAL_VALIDATION') { throw 'BASELINE_ROLE_MISMATCH' }
    if ([string]$state.sourceTasksSha256 -ne $ExpectedTasksSha256) { throw 'STATE_TASKS_HASH_MISMATCH' }
    if ([string]$state.specifyTreeSha256 -ne $ExpectedSpecifyTreeSha256) { throw 'STATE_SPECIFY_HASH_MISMATCH' }
    if ([string]$metadata.logicalZipName -ne $CandidateLogicalName -or [string]$metadata.finalSha256Sidecar -ne $CandidateSidecarLogicalName) {
        throw 'PACKAGE_METADATA_CANDIDATE_IDENTITY_MISMATCH'
    }
    if ([string]$metadata.rootDirectory -ne $ExpectedRootDirectory) { throw 'PACKAGE_METADATA_ROOT_MISMATCH' }
    $batchActualHash = Get-Sha256 $batchPath
    $lockEntry = @($lock.batches | Where-Object batchId -eq $BatchId)
    if ($lockEntry.Count -ne 1 -or [string]$lockEntry[0].sha256 -ne $batchActualHash) {
        throw "TASK_MIRROR_MISMATCH: B08 batch lock does not match ${batchActualHash}"
    }
    foreach ($taskId in @($batch.executionOrder)) {
        if ([string]$state.taskStatus.$taskId -ne 'IMPLEMENTED_PENDING_VALIDATION') {
            throw "TASK_STATUS_MISMATCH: ${taskId}=$($state.taskStatus.$taskId)"
        }
    }
    $nextMapEntry = @($map.batches | Where-Object ordinal -eq ([int]$batch.ordinal + 1))
    if ($nextMapEntry.Count -ne 1 -or [string]$state.batchStatus.([string]$nextMapEntry[0].batchId) -ne 'PENDING') {
        throw "FUTURE_BATCH_STATUS_CHANGED: next=$($nextMapEntry[0].batchId)"
    }
    $nextBatchPath = Join-Path $ProjectRoot ([string]$nextMapEntry[0].batchFile).Replace('/', '\')
    $nextBatch = Get-Content -LiteralPath $nextBatchPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($futureTaskId in @($nextBatch.executionOrder)) {
        if ([string]$state.taskStatus.$futureTaskId -ne 'PENDING') {
            throw "FUTURE_TASK_STATUS_CHANGED: ${futureTaskId}=$($state.taskStatus.$futureTaskId)"
        }
    }
    return [pscustomobject]@{ State = $state; Batch = $batch; Metadata = $metadata; BatchHash = $batchActualHash }
}

function Invoke-ProcessWithLogs {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$StdoutPath,
        [Parameter(Mandatory = $true)][string]$StderrPath
    )
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $process.StartInfo.FileName = $Executable
    $process.StartInfo.WorkingDirectory = $WorkingDirectory
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.StandardOutputEncoding = $Utf8NoBom
    $process.StartInfo.StandardErrorEncoding = $Utf8NoBom
    foreach ($argument in $Arguments) { [void]$process.StartInfo.ArgumentList.Add($argument) }
    $startedAt = [DateTimeOffset]::Now
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $stopwatch.Stop()
    $finishedAt = [DateTimeOffset]::Now
    [System.IO.File]::WriteAllText($StdoutPath, $stdout, $Utf8NoBom)
    [System.IO.File]::WriteAllText($StderrPath, $stderr, $Utf8NoBom)
    return [ordered]@{
        executable = $Executable
        arguments = $Arguments
        cwd = $WorkingDirectory
        startedAt = $startedAt.ToString('o', $InvariantCulture)
        finishedAt = $finishedAt.ToString('o', $InvariantCulture)
        durationMilliseconds = [int64]$stopwatch.ElapsedMilliseconds
        exitCode = [int]$process.ExitCode
        stdoutPath = $StdoutPath
        stderrPath = $StderrPath
        stdoutSha256 = Get-Sha256 $StdoutPath
        stderrSha256 = Get-Sha256 $StderrPath
    }
}

function Remove-RegenerableArtifacts {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)
    $removed = [System.Collections.Generic.List[string]]::new()
    foreach ($relativePath in @('node_modules','dist','playwright-report','test-results','.wrangler','coverage','.vite')) {
        $path = Join-Path $ProjectRoot $relativePath
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Recurse -Force
            $removed.Add($relativePath)
        }
    }
    return @($removed)
}


function Copy-DirectoryWithoutNestedArchives {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $false)][int64]$MaximumBytes = 52428800
    )
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) { return @() }
    $copied = [System.Collections.Generic.List[object]]::new()
    $totalBytes = [int64]0
    foreach ($file in Get-ChildItem -LiteralPath $Source -Recurse -File | Sort-Object FullName) {
        if ($file.Extension -ieq '.zip' -or $file.Extension -ieq '.7z' -or $file.Extension -ieq '.rar') { continue }
        if ($totalBytes + $file.Length -gt $MaximumBytes) { break }
        $relative = [System.IO.Path]::GetRelativePath($Source, $file.FullName)
        $target = Join-Path $Destination $relative
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
        $totalBytes += [int64]$file.Length
        $copied.Add([ordered]@{ path=$relative.Replace('\','/'); sizeBytes=[int64]$file.Length; sha256=Get-Sha256 $target })
    }
    return @($copied)
}

function Copy-BrowserDiagnosticArtifacts {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [Parameter(Mandatory = $true)][string]$DestinationRoot
    )
    $result = [System.Collections.Generic.List[object]]::new()
    foreach ($relativePath in @('test-results','playwright-report')) {
        $source = Join-Path $ProjectRoot $relativePath
        if (-not (Test-Path -LiteralPath $source -PathType Container)) { continue }
        $destination = Join-Path $DestinationRoot ("browser-artifacts\" + $relativePath)
        $files = @(Copy-DirectoryWithoutNestedArchives -Source $source -Destination $destination)
        $result.Add([ordered]@{
            sourcePath=$relativePath
            evidencePath=("browser-artifacts/" + $relativePath)
            copiedFileCount=$files.Count
            nestedArchivesExcluded=$true
            files=$files
        })
    }
    return @($result)
}

function New-EvidenceValidatorRuntime {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [Parameter(Mandatory = $true)][string]$WorkRoot
    )
    $runtimeRoot = Join-Path $WorkRoot (".evidence-validator-" + $RunStamp)
    if (Test-Path -LiteralPath $runtimeRoot) { Remove-Item -LiteralPath $runtimeRoot -Recurse -Force }
    New-Item -ItemType Directory -Path (Join-Path $runtimeRoot 'node_modules') -Force | Out-Null
    $validatorSource = Join-Path $ProjectRoot 'implementation-control\scripts\Validate-ControlPlaneEvidence.mjs'
    $schemaSource = Join-Path $ProjectRoot 'implementation-control\schemas\local-validation-evidence.schema.json'
    if (-not (Test-Path -LiteralPath $validatorSource -PathType Leaf) -or -not (Test-Path -LiteralPath $schemaSource -PathType Leaf)) {
        throw 'EVIDENCE_VALIDATOR_SOURCE_MISSING'
    }
    $validatorTarget = Join-Path $runtimeRoot 'Validate-ControlPlaneEvidence.mjs'
    $schemaTarget = Join-Path $runtimeRoot 'local-validation-evidence.schema.json'
    Copy-Item -LiteralPath $validatorSource -Destination $validatorTarget -Force
    Copy-Item -LiteralPath $schemaSource -Destination $schemaTarget -Force
    foreach ($dependency in @('ajv','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string')) {
        $source = Join-Path $ProjectRoot ("node_modules\" + $dependency)
        if (-not (Test-Path -LiteralPath $source -PathType Container)) {
            throw "EVIDENCE_VALIDATOR_DEPENDENCY_MISSING: ${dependency}"
        }
        $dependencyTarget = Join-Path $runtimeRoot ("node_modules\" + $dependency)
        Copy-Item -LiteralPath $source -Destination $dependencyTarget -Recurse -Force
    }
    return [pscustomobject]@{ Root=$runtimeRoot; Validator=$validatorTarget; Schema=$schemaTarget }
}

function Invoke-ControlPlaneValidator {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [Parameter(Mandatory = $false)][string]$Label = 'control-plane'
    )
    $validator = Join-Path $ProjectRoot 'implementation-control\scripts\Validate-ControlPlaneState.mjs'
    $stdoutPath = Join-Path $WrapperLogRoot "${Label}.stdout.log"
    $stderrPath = Join-Path $WrapperLogRoot "${Label}.stderr.log"
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $process.StartInfo.FileName = (Get-Command node -ErrorAction Stop).Source
    $process.StartInfo.WorkingDirectory = $ProjectRoot
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.StandardOutputEncoding = $Utf8NoBom
    $process.StartInfo.StandardErrorEncoding = $Utf8NoBom
    [void]$process.StartInfo.ArgumentList.Add($validator)
    [void]$process.StartInfo.ArgumentList.Add($ProjectRoot)
    [void]$process.Start()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    [System.IO.File]::WriteAllText($stdoutPath, $stdout, $Utf8NoBom)
    [System.IO.File]::WriteAllText($stderrPath, $stderr, $Utf8NoBom)
    if ($process.ExitCode -ne 0) {
        throw "TASK_MIRROR_MISMATCH: label=${Label}; exit=$($process.ExitCode); stderr=${stderr}; stdout=${stdout}"
    }
    return [ordered]@{
        label = $Label
        exitCode = [int]$process.ExitCode
        stdoutLog = "runner-logs/${Label}.stdout.log"
        stderrLog = "runner-logs/${Label}.stderr.log"
        stdoutSha256 = Get-Sha256 $stdoutPath
        stderrSha256 = Get-Sha256 $stderrPath
        summary = $stdout.Trim()
    }
}

function Read-SidecarRecord {
    param([Parameter(Mandatory = $true)][string]$Path)
    $lines = @(Get-Content -LiteralPath $Path -Encoding UTF8 | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($lines.Count -ne 1 -or $lines[0] -notmatch '^(?<hash>[0-9a-fA-F]{64})\s{2}(?<name>[^\\/]+)$') {
        throw "SIDECAR_FORMAT_INVALID: ${Path}"
    }
    return [pscustomobject]@{
        Path = $Path
        Hash = ([string]$Matches.hash).ToLowerInvariant()
        LogicalName = [string]$Matches.name
    }
}

function Find-SidecarForLogicalTarget {
    param(
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)][string]$TargetLogicalName
    )
    $matches = [System.Collections.Generic.List[object]]::new()
    foreach ($file in Get-ChildItem -LiteralPath $Directory -File -Filter '*.sha256') {
        try {
            $record = Read-SidecarRecord $file.FullName
            if ($record.LogicalName -ceq $TargetLogicalName) { $matches.Add($record) }
        }
        catch {
            # Sidecars for unrelated artifacts are ignored only when their target differs.
        }
    }
    if ($matches.Count -eq 0) { throw "SIDECAR_MISSING_FOR_LOGICAL_TARGET: ${TargetLogicalName}" }
    if ($matches.Count -gt 1) {
        $exact = @($matches | Where-Object { (Split-Path -Leaf $_.Path) -ceq "${TargetLogicalName}.sha256" })
        if ($exact.Count -eq 1) { return $exact[0] }
        throw "SIDECAR_AMBIGUOUS_FOR_LOGICAL_TARGET: ${TargetLogicalName}; count=$($matches.Count)"
    }
    return $matches[0]
}

function Find-TargetByAuthenticatedSidecar {
    param(
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)][object]$SidecarRecord,
        [Parameter(Mandatory = $true)][string]$Extension
    )
    $exactPath = Join-Path $Directory ([string]$SidecarRecord.LogicalName)
    if (Test-Path -LiteralPath $exactPath -PathType Leaf) {
        if ((Get-Sha256 $exactPath) -ne [string]$SidecarRecord.Hash) {
            throw "SIDECAR_HASH_MISMATCH: target=$($SidecarRecord.LogicalName)"
        }
        return $exactPath
    }
    $matches = @(
        Get-ChildItem -LiteralPath $Directory -File |
            Where-Object { $_.Extension -ieq $Extension -and (Get-Sha256 $_.FullName) -eq [string]$SidecarRecord.Hash }
    )
    if ($matches.Count -eq 0) {
        throw "AUTHENTICATED_TARGET_MISSING: logical=$($SidecarRecord.LogicalName); extension=${Extension}"
    }
    if ($matches.Count -gt 1) {
        throw "AUTHENTICATED_TARGET_AMBIGUOUS: logical=$($SidecarRecord.LogicalName); count=$($matches.Count)"
    }
    return $matches[0].FullName
}

function Get-TargetHashes {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRoot,
        [Parameter(Mandatory = $true)][object]$Batch
    )
    $hashes = [ordered]@{}
    foreach ($relativePath in @($Batch.targetFiles)) {
        $absolutePath = Join-Path $ProjectRoot ([string]$relativePath).Replace('/', '\')
        if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
            throw "TARGET_FILE_MISSING: ${relativePath}"
        }
        $hashes[[string]$relativePath] = Get-Sha256 $absolutePath
    }
    return $hashes
}

function Test-OrderedHashesEqual {
    param([Parameter(Mandatory = $true)][object]$Left, [Parameter(Mandatory = $true)][object]$Right)
    $leftKeys = @($Left.Keys)
    $rightKeys = @($Right.Keys)
    if ($leftKeys.Count -ne $rightKeys.Count) { return $false }
    foreach ($key in $leftKeys) {
        if (-not $Right.Contains($key) -or [string]$Left[$key] -ne [string]$Right[$key]) { return $false }
    }
    return $true
}

function Remove-AnsiEscapes {
    param([AllowEmptyString()][string]$Text)
    if ($null -eq $Text) { return '' }
    $escape = [string][char]27
    $pattern = $escape + '\[[0-?]*[ -/]*[@-~]'
    return [regex]::Replace($Text, $pattern, '')
}

function Get-TestDiscoveryEvidenceFromText {
    param(
        [Parameter(Mandatory = $true)][string]$CommandId,
        [Parameter(Mandatory = $true)][string]$Category,
        [Parameter(Mandatory = $true)][string]$Command,
        [AllowEmptyString()][string]$Text
    )
    $clean = Remove-AnsiEscapes $Text
    $framework = if ($Command -match '(?i)playwright' -or $CommandId -in @('test-e2e','regression-browser')) { 'playwright' } else { 'vitest' }
    $result = [ordered]@{
        commandId = $CommandId
        category = $Category
        framework = $framework
        status = 'FAIL'
        reason = $null
        testFilesPassed = 0
        testsPassed = 0
        testsFailed = 0
        testsSkipped = 0
        parserVersion = 'B08-r2-v1'
    }
    if ($clean -match '(?im)\b(?:no tests found|no test files found|did not find any tests)\b') {
        $result.reason = 'NO_TESTS_DISCOVERED'
        return [pscustomobject]$result
    }
    $skippedMatches = [regex]::Matches($clean, '(?im)\b(?<count>[1-9][0-9]*)\s+(?:skipped|pending|todo)\b')
    foreach ($match in $skippedMatches) { $result.testsSkipped += [int]$match.Groups['count'].Value }
    if ($framework -eq 'vitest') {
        $files = [regex]::Match($clean, '(?im)^\s*Test Files\s+(?<passed>[1-9][0-9]*)\s+passed(?:\s+\([0-9]+\))?\s*$')
        $tests = [regex]::Match($clean, '(?im)^\s*Tests\s+(?<passed>[1-9][0-9]*)\s+passed(?:\s+\([0-9]+\))?\s*$')
        $failed = [regex]::Matches($clean, '(?im)\b(?<count>[1-9][0-9]*)\s+failed\b')
        foreach ($match in $failed) { $result.testsFailed = [Math]::Max($result.testsFailed, [int]$match.Groups['count'].Value) }
        if ($files.Success) { $result.testFilesPassed = [int]$files.Groups['passed'].Value }
        if ($tests.Success) { $result.testsPassed = [int]$tests.Groups['passed'].Value }
    }
    else {
        $passed = [regex]::Matches($clean, '(?im)^\s*(?<count>[1-9][0-9]*)\s+passed(?:\s+\([^\r\n]+\))?\s*$')
        if ($passed.Count -gt 0) { $result.testsPassed = [int]$passed[$passed.Count - 1].Groups['count'].Value }
        $failed = [regex]::Matches($clean, '(?im)^\s*(?<count>[1-9][0-9]*)\s+failed(?:\s+\([^\r\n]+\))?\s*$')
        if ($failed.Count -gt 0) { $result.testsFailed = [int]$failed[$failed.Count - 1].Groups['count'].Value }
        $result.testFilesPassed = if ($result.testsPassed -gt 0) { 1 } else { 0 }
    }
    if ($clean -match '(?im)\b(?:flaky|interrupted|timed out)\b') { $result.reason = 'UNSTABLE_OR_INTERRUPTED_TESTS_REPORTED'; return [pscustomobject]$result }
    if ($result.testsFailed -gt 0) { $result.reason = 'FAILED_TESTS_REPORTED'; return [pscustomobject]$result }
    if ($result.testsSkipped -gt 0) { $result.reason = 'SKIPPED_OR_PENDING_TESTS_REPORTED'; return [pscustomobject]$result }
    if ($result.testsPassed -le 0 -or $result.testFilesPassed -le 0) {
        $result.reason = 'TEST_DISCOVERY_NOT_PROVEN'
        return [pscustomobject]$result
    }
    $result.status = 'PASS'
    return [pscustomobject]$result
}

function Get-CommandPolicyResult {
    param(
        [Parameter(Mandatory = $true)][object]$Entry,
        [Parameter(Mandatory = $true)][string]$StdoutPath,
        [Parameter(Mandatory = $true)][string]$StderrPath
    )
    $category = [string]$Entry.category
    if ($category -notin @('unit','integration','contract','negative','e2e','regression')) {
        return [pscustomobject]@{ commandId = [string]$Entry.id; status = 'NOT_APPLICABLE'; reason = $null; discovery = $null }
    }
    $stdout = Get-Content -LiteralPath $StdoutPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    $stderr = Get-Content -LiteralPath $StderrPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    $discovery = Get-TestDiscoveryEvidenceFromText `
        -CommandId ([string]$Entry.id) `
        -Category $category `
        -Command ([string]$Entry.command) `
        -Text (([string]$stdout) + [Environment]::NewLine + ([string]$stderr))
    return [pscustomobject]@{
        commandId = [string]$Entry.id
        status = [string]$discovery.status
        reason = [string]$discovery.reason
        discovery = $discovery
    }
}

function Invoke-ParserSelfTests {
    $esc = [string][char]27
    $vitest = "${esc}[2m Test Files ${esc}[22m ${esc}[1m${esc}[32m1 passed${esc}[39m${esc}[22m${esc}[90m (1)${esc}[39m`n${esc}[2m Tests ${esc}[22m ${esc}[1m${esc}[32m4 passed${esc}[39m${esc}[22m${esc}[90m (4)${esc}[39m"
    $v = Get-TestDiscoveryEvidenceFromText -CommandId 'self-vitest' -Category 'unit' -Command 'npm run test:unit' -Text $vitest
    if ($v.status -ne 'PASS' -or $v.testFilesPassed -ne 1 -or $v.testsPassed -ne 4) {
        throw "PARSER_SELF_TEST_FAILED: vitest=$($v | ConvertTo-Json -Compress)"
    }
    $playwright = "Running 2 tests using 1 worker`n  2 passed (1.4s)"
    $p = Get-TestDiscoveryEvidenceFromText -CommandId 'self-playwright' -Category 'e2e' -Command 'playwright test' -Text $playwright
    if ($p.status -ne 'PASS' -or $p.testsPassed -ne 2) {
        throw "PARSER_SELF_TEST_FAILED: playwright=$($p | ConvertTo-Json -Compress)"
    }
    $zero = Get-TestDiscoveryEvidenceFromText -CommandId 'self-zero' -Category 'unit' -Command 'vitest run' -Text 'No test files found'
    if ($zero.status -ne 'FAIL' -or $zero.reason -ne 'NO_TESTS_DISCOVERED') {
        throw "PARSER_SELF_TEST_FAILED: zero=$($zero | ConvertTo-Json -Compress)"
    }
    return [ordered]@{
        status = 'PASS'
        parserVersion = 'B08-r2-v1'
        ansiVitest = $v
        playwright = $p
        zeroDiscoveryRejection = $zero
    }
}


function Assert-ExpectedFailure {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Action,
        [Parameter(Mandatory = $true)][string]$ExpectedPattern,
        [Parameter(Mandatory = $true)][string]$CaseId
    )
    $caught = $null
    try { & $Action }
    catch { $caught = $_ }
    if ($null -eq $caught) { throw "SELF_TEST_EXPECTED_FAILURE_MISSING: ${CaseId}" }
    if ([string]$caught.Exception.Message -notmatch $ExpectedPattern) {
        throw "SELF_TEST_UNEXPECTED_FAILURE: case=${CaseId}; actual=$($caught.Exception.Message)"
    }
    return [ordered]@{ caseId=$CaseId; status='PASS'; observedFailure=[string]$caught.Exception.Message }
}

function Invoke-ValueShapeSelfTests {
    $nullValue = $null
    $rawNullArrayExpressionCount = @($nullValue).Count
    $normalizedNullItems = [System.Collections.Generic.List[object]]::new()
    if ($null -ne $nullValue) { $normalizedNullItems.Add($nullValue) }

    $emptyString = ''
    $zero = @()
    $one = @('one')
    $many = @('one','two','three')

    if ($null -ne $nullValue) { throw 'SELF_TEST_NULL_IDENTITY_FAILED' }
    if ($normalizedNullItems.Count -ne 0) { throw 'SELF_TEST_NULL_NORMALIZATION_NOT_ZERO' }
    if ($emptyString.Length -ne 0 -or [string]::IsNullOrEmpty($emptyString) -ne $true) { throw 'SELF_TEST_EMPTY_STRING_FAILED' }
    if ($zero.Count -ne 0 -or $one.Count -ne 1 -or $many.Count -ne 3) { throw 'SELF_TEST_COLLECTION_CARDINALITY_FAILED' }

    $json = [ordered]@{ nullValue=$nullValue; emptyString=$emptyString; zero=$zero; one=$one; many=$many } | ConvertTo-Json -Depth 5
    $roundTrip = $json | ConvertFrom-Json
    if ($null -ne $roundTrip.nullValue -or [string]$roundTrip.emptyString -ne '' -or @($roundTrip.zero).Count -ne 0 -or @($roundTrip.one).Count -ne 1 -or @($roundTrip.many).Count -ne 3) {
        throw 'SELF_TEST_VALUE_SHAPE_JSON_ROUNDTRIP_FAILED'
    }

    return [ordered]@{
        status = 'PASS'
        nullValueIsNull = ($null -eq $nullValue)
        rawNullArrayExpressionCount = $rawNullArrayExpressionCount
        normalizedNullCount = $normalizedNullItems.Count
        emptyStringLength = $emptyString.Length
        collectionCounts = @($zero.Count,$one.Count,$many.Count)
    }
}

function New-SyntheticZip {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Entries
    )
    Add-Type -AssemblyName System.IO.Compression
    if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Force }
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        foreach ($name in @($Entries.Keys)) {
            $entry = $archive.CreateEntry([string]$name)
            $entryStream = $entry.Open()
            try {
                $bytes = $Utf8NoBom.GetBytes([string]$Entries[$name])
                $entryStream.Write($bytes, 0, $bytes.Length)
            }
            finally { $entryStream.Dispose() }
        }
    }
    finally { $archive.Dispose(); $stream.Dispose() }
    return $Path
}

function Invoke-RunnerQualificationSelfTests {
    param([Parameter(Mandatory = $true)][string]$RunnerSha256)
    $selfRoot = Join-Path ([System.IO.Path]::GetTempPath()) "FinScope-B08-runner-selftest-$([Guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $selfRoot -Force | Out-Null
    try {
        $valueShapes = Invoke-ValueShapeSelfTests
        $safeWorkRoot = Assert-ShortWorkRoot 'C:\FS\B08r2v1\work'
        $unsafeWorkRoot = Assert-ExpectedFailure -CaseId 'unsafe-work-root' -ExpectedPattern 'WORK_ROOT_NOT_SHORT_OR_UNSAFE' -Action { [void](Assert-ShortWorkRoot 'C:\Users\example\FinScope\work') }

        $validZip = New-SyntheticZip (Join-Path $selfRoot 'valid.zip') ([ordered]@{ "${ExpectedRootDirectory}/selftest.txt"='valid' })
        $validSidecar = Write-Sha256Sidecar $validZip 'valid.zip'
        [void](Assert-Sidecar $validSidecar $validZip 'valid.zip')
        $validInspection = Get-ArchiveInspection $validZip 'C:\FS\B08-selftest\work'
        [void](Assert-ArchiveInspection $validInspection)
        $extractRoot = Join-Path $selfRoot 'extract'
        New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
        [System.IO.Compression.ZipFile]::ExtractToDirectory($validZip, $extractRoot)
        if (-not (Test-Path -LiteralPath (Join-Path $extractRoot "${ExpectedRootDirectory}\selftest.txt") -PathType Leaf)) {
            throw 'SELF_TEST_ZIP_ROOT_NOT_PRESERVED'
        }

        $badSidecar = Join-Path $selfRoot 'bad.zip.sha256'
        [System.IO.File]::WriteAllText($badSidecar, (('0' * 64) + '  valid.zip' + [Environment]::NewLine), $Utf8NoBom)
        $hashNegative = Assert-ExpectedFailure -CaseId 'hash-mismatch' -ExpectedPattern 'SIDECAR_HASH_MISMATCH' -Action { [void](Assert-Sidecar $badSidecar $validZip 'valid.zip') }

        $wrongRootZip = New-SyntheticZip (Join-Path $selfRoot 'wrong-root.zip') ([ordered]@{ 'WrongRoot/selftest.txt'='invalid' })
        $rootNegative = Assert-ExpectedFailure -CaseId 'wrong-root' -ExpectedPattern 'ARCHIVE_PREFLIGHT_FAILED' -Action { [void](Assert-ArchiveInspection (Get-ArchiveInspection $wrongRootZip 'C:\FS\B08-selftest\work')) }

        $traversalZip = New-SyntheticZip (Join-Path $selfRoot 'traversal.zip') ([ordered]@{ "${ExpectedRootDirectory}/../escape.txt"='invalid' })
        $traversalNegative = Assert-ExpectedFailure -CaseId 'traversal' -ExpectedPattern 'ARCHIVE_PREFLIGHT_FAILED' -Action { [void](Assert-ArchiveInspection (Get-ArchiveInspection $traversalZip 'C:\FS\B08-selftest\work')) }

        $evidenceRoot = Join-Path $selfRoot 'evidence'
        New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
        foreach ($name in @('B08-local-validation.json','VERIFICATION_SUMMARY.json')) {
            [System.IO.File]::WriteAllText((Join-Path $evidenceRoot $name), '{}', $Utf8NoBom)
        }
        Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $evidenceRoot $RunnerLogicalName) -Force
        [System.IO.File]::WriteAllText((Join-Path $evidenceRoot $RunnerSidecarLogicalName), ("${RunnerSha256}  ${RunnerLogicalName}" + [Environment]::NewLine), $Utf8NoBom)
        [System.IO.File]::WriteAllText((Join-Path $evidenceRoot $CandidateSidecarLogicalName), (('1' * 64) + "  ${CandidateLogicalName}" + [Environment]::NewLine), $Utf8NoBom)
        [void](Write-EvidenceInventoryAndManifest $evidenceRoot)
        $evidenceZip = Join-Path $selfRoot 'synthetic-evidence.zip'
        Compress-Archive -Path (Join-Path $evidenceRoot '*') -DestinationPath $evidenceZip -Force
        $evidenceSidecar = Write-Sha256Sidecar $evidenceZip 'synthetic-evidence.zip'
        [void](Assert-Sidecar $evidenceSidecar $evidenceZip 'synthetic-evidence.zip')
        $evidenceArchive = Assert-CompressedEvidenceArchive $evidenceZip $RunnerSha256

        return [ordered]@{
            status='PASS'; valueShapes=$valueShapes; safeWorkRoot=$safeWorkRoot; unsafeWorkRoot=$unsafeWorkRoot
            validArchive=$validInspection; hashNegative=$hashNegative; rootNegative=$rootNegative; traversalNegative=$traversalNegative
            evidenceArchive=$evidenceArchive; evidenceZipSha256=Get-Sha256 $evidenceZip
        }
    }
    finally {
        if (Test-Path -LiteralPath $selfRoot) { Remove-Item -LiteralPath $selfRoot -Recurse -Force }
    }
}

function New-NotRunResult {
    param([Parameter(Mandatory = $true)][object]$Entry, [Parameter(Mandatory = $true)][string]$Reason)
    return [ordered]@{
        id = [string]$Entry.id; category = [string]$Entry.category; command = [string]$Entry.command
        required = [bool]$Entry.required; startedAt = $null; finishedAt = $null; durationMilliseconds = 0
        exitCode = $null; status = 'NOT_RUN'; stdoutLog = $null; stderrLog = $null
        stdoutSha256 = $null; stderrSha256 = $null; stdoutBytes = 0; stderrBytes = 0; reason = $Reason
    }
}

function Get-RegenerableArtifactStatus {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)
    return @(
        foreach ($relativePath in @('node_modules','dist','playwright-report','test-results','.wrangler','coverage','.vite')) {
            [ordered]@{
                path = $relativePath
                presentAfterValidation = Test-Path -LiteralPath (Join-Path $ProjectRoot $relativePath)
                packageDisposition = 'EXCLUDED_FROM_CANDIDATE_PACKAGE'
            }
        }
    )
}

function Write-EvidenceInventoryAndManifest {
    param([Parameter(Mandatory = $true)][string]$Directory)
    $inventoryPath = Join-Path $Directory 'EVIDENCE_INVENTORY.json'
    $manifestPath = Join-Path $Directory 'EVIDENCE_MANIFEST.sha256'
    foreach ($path in @($inventoryPath,$manifestPath)) { if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force } }
    $records = @(Get-RelativeFileRecords $Directory | Where-Object { $_.RelativePath -notin @('EVIDENCE_INVENTORY.json','EVIDENCE_MANIFEST.sha256') })
    $inventory = [ordered]@{
        schemaVersion = '1.0.0'
        batchId = $BatchId
        generatedAt = [DateTimeOffset]::Now.ToString('o', $InvariantCulture)
        resolutionBase = '.'
        exclusions = @('EVIDENCE_INVENTORY.json','EVIDENCE_MANIFEST.sha256')
        itemCount = $records.Count
        files = @($records | ForEach-Object {
            [ordered]@{ path = $_.RelativePath; sizeBytes = [int64]$_.File.Length; sha256 = Get-Sha256 $_.File.FullName }
        })
    }
    Write-Utf8Json $inventoryPath $inventory
    $manifestRecords = @(Get-RelativeFileRecords $Directory | Where-Object RelativePath -ne 'EVIDENCE_MANIFEST.sha256')
    $lines = @($manifestRecords | ForEach-Object { "$(Get-Sha256 $_.File.FullName)  $($_.RelativePath)" })
    [System.IO.File]::WriteAllText($manifestPath, (($lines -join [Environment]::NewLine) + [Environment]::NewLine), $Utf8NoBom)
    foreach ($line in Get-Content -LiteralPath $manifestPath -Encoding UTF8) {
        if ($line -notmatch '^(?<hash>[0-9a-f]{64})  (?<path>.+)$') { throw "EVIDENCE_MANIFEST_LINE_INVALID: ${line}" }
        $target = Join-Path $Directory ([string]$Matches.path).Replace('/', '\')
        if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Get-Sha256 $target) -ne [string]$Matches.hash) {
            throw "EVIDENCE_MANIFEST_HASH_MISMATCH: $($Matches.path)"
        }
    }
    return [ordered]@{
        inventoryPath = $inventoryPath
        inventorySha256 = Get-Sha256 $inventoryPath
        manifestPath = $manifestPath
        manifestSha256 = Get-Sha256 $manifestPath
        itemCount = $records.Count
    }
}

function Assert-CompressedEvidenceArchive {
    param(
        [Parameter(Mandatory = $true)][string]$ZipPath,
        [Parameter(Mandatory = $true)][string]$ExpectedRunnerHash
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $required = @(
        'B08-local-validation.json',
        'VERIFICATION_SUMMARY.json',
        'EVIDENCE_INVENTORY.json',
        'EVIDENCE_MANIFEST.sha256',
        $RunnerLogicalName,
        $RunnerSidecarLogicalName,
        $CandidateSidecarLogicalName
    )
    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        foreach ($entry in $archive.Entries) {
            $name = ([string]$entry.FullName).Replace('\','/')
            if ($name.StartsWith('/') -or $name -match '^[A-Za-z]:' -or @($name.Split('/')) -contains '..') {
                throw "EVIDENCE_ARCHIVE_UNSAFE_PATH: ${name}"
            }
            if (-not $seen.Add($name)) { throw "EVIDENCE_ARCHIVE_DUPLICATE_PATH: ${name}" }
            if ($name.EndsWith('/')) { continue }
            $stream = $entry.Open()
            try {
                $sha = [System.Security.Cryptography.SHA256]::Create()
                try { $hash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
                finally { $sha.Dispose() }
            }
            finally { $stream.Dispose() }
            if ($name -ceq $RunnerLogicalName -and $hash -ne $ExpectedRunnerHash) {
                throw "EVIDENCE_RUNNER_HASH_MISMATCH: expected=${ExpectedRunnerHash}; actual=${hash}"
            }
        }
    }
    finally { $archive.Dispose() }
    foreach ($path in $required) {
        if (-not $seen.Contains($path)) { throw "EVIDENCE_ARCHIVE_REQUIRED_FILE_MISSING: ${path}" }
    }
    return [ordered]@{ status='PASS'; fileCount=$seen.Count; runnerHash=$ExpectedRunnerHash }
}

function New-FailureDiagnostic {
    param(
        [Parameter(Mandatory = $true)][string]$Reason,
        [Parameter(Mandatory = $true)][string]$OutputDirectory
    )
    try {
        New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
        $root = Join-Path $OutputDirectory "FinScope_runner_diagnostic_B08_${RunStamp}_FAILED"
        if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $root 'runner') -Force | Out-Null
        if ($null -ne $EvidenceRoot -and (Test-Path -LiteralPath $EvidenceRoot -PathType Container)) {
            Copy-Item -Path (Join-Path $EvidenceRoot '*') -Destination $root -Recurse -Force -ErrorAction SilentlyContinue
        }
        $diagnostic = [ordered]@{
            schemaVersion = '2.0.0'; batchId = $BatchId; status = 'FAIL'
            failedAt = [DateTimeOffset]::Now.ToString('o', $InvariantCulture)
            primaryFailure = $PrimaryFailure; secondaryEvidenceErrors = @($SecondaryEvidenceErrors); runnerInfrastructureError = $Reason
            runnerLogicalName = $RunnerLogicalName; runnerSha256 = $AuthenticatedRunnerSha256
            candidateLogicalName = $CandidateLogicalName; candidateSha256 = $AuthenticatedCandidateSha256
            powerShellVersion = $PSVersionTable.PSVersion.ToString(); powerShellEdition = [string]$PSVersionTable.PSEdition
            currentCulture = [System.Globalization.CultureInfo]::CurrentCulture.Name
            currentUICulture = [System.Globalization.CultureInfo]::CurrentUICulture.Name
        }
        Write-Utf8Json (Join-Path $root 'runner-diagnostic.json') $diagnostic
        foreach ($item in @(
            @{Source=$PSCommandPath; Name=$RunnerLogicalName},
            @{Source=$RunnerSidecarPhysicalPath; Name=$RunnerSidecarLogicalName},
            @{Source=$CandidateSidecarPhysicalPath; Name=$CandidateSidecarLogicalName},
            @{Source=$PreflightReportPath; Name=$(if ($null -ne $PreflightReportPath) { Split-Path -Leaf $PreflightReportPath } else { $null })}
        )) {
            if ($null -ne $item.Source -and (Test-Path -LiteralPath $item.Source -PathType Leaf)) {
                Copy-Item -LiteralPath $item.Source -Destination (Join-Path $root $item.Name) -Force
            }
        }
        if ($null -ne $WrapperLogRoot -and (Test-Path -LiteralPath $WrapperLogRoot -PathType Container)) {
            Copy-Item -LiteralPath $WrapperLogRoot -Destination (Join-Path $root 'wrapper-logs') -Recurse -Force
        }
        $precheck = [ordered]@{ validationStatus='FAIL'; packagingStatus='PASS'; checkedAt=[DateTimeOffset]::Now.ToString('o',$InvariantCulture); primaryFailure=$PrimaryFailure }
        Write-Utf8Json (Join-Path $root 'runner/precompression-self-verification.json') $precheck
        [void](Write-EvidenceInventoryAndManifest $root)
        $zipPath = "${root}.zip"
        Compress-Archive -Path (Join-Path $root '*') -DestinationPath $zipPath -Force
        [void](Write-Sha256Sidecar $zipPath (Split-Path -Leaf $zipPath))
        Write-Host "VALIDATION FAIL. Diagnóstico completo: ${zipPath}" -ForegroundColor Red
    }
    catch {
        Write-Warning "No se pudo empaquetar el diagnóstico secundario: $($_.Exception.Message)"
    }
}


try {
    Assert-PowerShellRuntime
    $ResolvedInput = (Resolve-Path -LiteralPath $InputDirectory).Path
    $astTokenCount = Assert-AstParse $PSCommandPath
    Invoke-CultureAndJsonSelfTests
    $parserSelfTests = Invoke-ParserSelfTests

    $runnerSidecarRecord = Find-SidecarForLogicalTarget $ResolvedInput $RunnerLogicalName
    $RunnerSidecarPhysicalPath = [string]$runnerSidecarRecord.Path
    $AuthenticatedRunnerSha256 = Get-Sha256 $PSCommandPath
    if ($AuthenticatedRunnerSha256 -ne [string]$runnerSidecarRecord.Hash) { throw 'RUNNER_SIDECAR_HASH_MISMATCH' }
    $qualificationSelfTests = Invoke-RunnerQualificationSelfTests $AuthenticatedRunnerSha256

    if ($SelfTestOnly) {
        $selfTestPath = Join-Path $ResolvedInput "FinScope_runner_selftest_B08_${RunStamp}.json"
        Write-Utf8Json $selfTestPath ([ordered]@{
            schemaVersion='1.0.0'; batchId=$BatchId; status='PASS'; npmExecuted=$false
            checkedAt=[DateTimeOffset]::Now.ToString('o',$InvariantCulture)
            runner=[ordered]@{ logicalName=$RunnerLogicalName; sha256=$AuthenticatedRunnerSha256; astTokenCount=$astTokenCount }
            cultureAndJsonSelfTests='PASS'; parserSelfTests=$parserSelfTests; qualificationSelfTests=$qualificationSelfTests
        })
        [void](Write-Sha256Sidecar $selfTestPath (Split-Path -Leaf $selfTestPath))
        Write-Host "Runner B08 r2 v1 SelfTest PASS (sin candidato ni npm): ${selfTestPath}" -ForegroundColor Green
        exit 0
    }
    $resolvedWorkRoot = Assert-ShortWorkRoot $WorkRoot
    $inputCanonical = $ResolvedInput.TrimEnd('\')
    $workCanonical = $resolvedWorkRoot.TrimEnd('\')
    if (
        $inputCanonical -ieq $workCanonical -or
        $inputCanonical.StartsWith($workCanonical + '\', [System.StringComparison]::OrdinalIgnoreCase) -or
        $workCanonical.StartsWith($inputCanonical + '\', [System.StringComparison]::OrdinalIgnoreCase)
    ) { throw "WORK_ROOT_OVERLAPS_INPUT: input=${inputCanonical}; work=${workCanonical}" }
    if (Test-Path -LiteralPath $resolvedWorkRoot) { Remove-Item -LiteralPath $resolvedWorkRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $resolvedWorkRoot -Force | Out-Null
    $WrapperLogRoot = Join-Path $resolvedWorkRoot "runner-logs-${RunStamp}"
    New-Item -ItemType Directory -Path $WrapperLogRoot -Force | Out-Null

    $candidateSidecarRecord = Find-SidecarForLogicalTarget $ResolvedInput $CandidateLogicalName
    $CandidateSidecarPhysicalPath = [string]$candidateSidecarRecord.Path
    $CandidatePhysicalPath = Find-TargetByAuthenticatedSidecar $ResolvedInput $candidateSidecarRecord '.zip'
    $AuthenticatedCandidateSha256 = Get-Sha256 $CandidatePhysicalPath

    $inspection = Get-ArchiveInspection $CandidatePhysicalPath $resolvedWorkRoot
    Assert-ArchiveInspection $inspection

    $candidateCopy = Join-Path $resolvedWorkRoot $CandidateLogicalName
    $candidateSidecarCopy = Join-Path $resolvedWorkRoot $CandidateSidecarLogicalName
    Copy-Item -LiteralPath $CandidatePhysicalPath -Destination $candidateCopy -Force
    Copy-Item -LiteralPath $CandidateSidecarPhysicalPath -Destination $candidateSidecarCopy -Force
    if ((Get-Sha256 $candidateCopy) -ne $AuthenticatedCandidateSha256) { throw 'CANDIDATE_COPY_HASH_MISMATCH' }

    $projectRoot = Join-Path $resolvedWorkRoot $ExpectedRootDirectory
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($candidateCopy, $resolvedWorkRoot)
    if (-not (Test-Path -LiteralPath $projectRoot -PathType Container)) { throw 'CANDIDATE_ROOT_NOT_EXTRACTED' }

    $metadataPath = Join-Path $projectRoot 'PACKAGE_METADATA.json'
    $metadata = Get-Content -LiteralPath $metadataPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]$metadata.logicalZipName -ne $CandidateLogicalName) { throw 'METADATA_LOGICAL_ZIP_MISMATCH' }
    if ([string]$metadata.finalSha256Sidecar -ne $CandidateSidecarLogicalName) { throw 'METADATA_SIDECAR_MISMATCH' }
    if ([string]$metadata.rootDirectory -ne $ExpectedRootDirectory) { throw 'METADATA_ROOT_MISMATCH' }
    if ([string]$metadata.sourceBaseline.sha256 -ne $ExpectedSourceBaselineSha256) { throw 'SOURCE_BASELINE_HASH_MISMATCH' }

    [void](Assert-FileManifest $projectRoot)
    [void](Assert-PackageInventory $projectRoot)
    $packageHygiene = Assert-PackageHygiene $projectRoot
    $control = Assert-ControlState $projectRoot
    $authorityFiles = Assert-BatchAuthorityFiles $projectRoot $control.Batch
    $tasksPath = Join-Path $projectRoot 'specs\001-fundamental-analysis-platform\tasks.md'
    $tasksHash = Get-Sha256 $tasksPath
    if ($tasksHash -ne $ExpectedTasksSha256) { throw 'TASKS_HASH_MISMATCH' }
    $specifyHash = Get-TreeSha256 (Join-Path $projectRoot '.specify')
    if ($specifyHash -ne $ExpectedSpecifyTreeSha256) { throw 'SPECIFY_TREE_HASH_MISMATCH' }
    $controlPlane = Invoke-ControlPlaneValidator $projectRoot 'control-plane-initial'
    $controlSummary = $controlPlane.summary | ConvertFrom-Json
    if ([string]$controlSummary.status -ne 'PASS' -or [int]$controlSummary.failCount -ne 0 -or [int]$controlSummary.passCount -ne [int]$controlSummary.checkCount) {
        throw 'CONTROL_PLANE_SEMANTIC_SUMMARY_MISMATCH'
    }
    $executability = Assert-PreNpmExecutability $projectRoot $control.Batch
    $initialTreeSha256 = Get-TreeSha256 $projectRoot

    $preflight = [ordered]@{
        schemaVersion = '2.0.0'; batchId = $BatchId; status = 'PASS'; npmExecuted = $false
        checkedAt = [DateTimeOffset]::Now.ToString('o', $InvariantCulture)
        runner = [ordered]@{ logicalName=$RunnerLogicalName; physicalName=(Split-Path -Leaf $PSCommandPath); sha256=$AuthenticatedRunnerSha256; sidecar=$RunnerSidecarLogicalName; sidecarPhysicalName=(Split-Path -Leaf $RunnerSidecarPhysicalPath); astTokenCount=$astTokenCount }
        parserSelfTests = $parserSelfTests
        qualificationSelfTests = $qualificationSelfTests
        environment = [ordered]@{ PSVersion=$PSVersionTable.PSVersion.ToString(); PSEdition=[string]$PSVersionTable.PSEdition; CurrentCulture=[System.Globalization.CultureInfo]::CurrentCulture.Name; CurrentUICulture=[System.Globalization.CultureInfo]::CurrentUICulture.Name }
        candidate = [ordered]@{ logicalName=$CandidateLogicalName; physicalName=(Split-Path -Leaf $CandidatePhysicalPath); sha256=$AuthenticatedCandidateSha256; sidecar=$CandidateSidecarLogicalName; sidecarPhysicalName=(Split-Path -Leaf $CandidateSidecarPhysicalPath); rootDirectory=$ExpectedRootDirectory; archive=$inspection; fileManifestValid=$true; inventoryValid=$true; metadataValid=$true }
        controlPlane = $controlPlane
        hashes = [ordered]@{ tasksSha256=$tasksHash; specifyTreeSha256=$specifyHash; B08Sha256=$control.BatchHash; extractedTreeSha256=$initialTreeSha256 }
        packageHygiene = $packageHygiene
        authorityFiles = $authorityFiles
        executability = $executability
        state = [ordered]@{ implementationStatus=[string]$control.State.implementationStatus; activeBatchId=[string]$control.State.activeBatchId; nextAuthorizedBatchId=[string]$control.State.nextAuthorizedBatchId; B07=[string]$control.State.batchStatus.B07; B08=[string]$control.State.batchStatus.B08; B09=[string]$control.State.batchStatus.B09; convergenceAuthorized=[bool]$control.State.phaseGate.convergenceAuthorized }
    }
    $PreflightReportPath = Join-Path $ResolvedInput "FinScope_preflight_B08_${RunStamp}.json"
    Write-Utf8Json $PreflightReportPath $preflight
    [void](Write-Sha256Sidecar $PreflightReportPath (Split-Path -Leaf $PreflightReportPath))
    Write-Host "Preflight B08 r2 v1 PASS (sin npm): ${PreflightReportPath}" -ForegroundColor Green
    if ($PreflightOnly) { exit 0 }

    $EvidenceRoot = Join-Path $resolvedWorkRoot "FinScope_local_evidence_B08_${RunStamp}"
    $logRoot = Join-Path $EvidenceRoot 'logs'
    $runnerArtifactRoot = Join-Path $EvidenceRoot 'runner'
    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $runnerArtifactRoot -Force | Out-Null

    $specifyTreeSha256Before = $specifyHash
    $sourceTasksSha256Before = $tasksHash
    $targetFileHashesBefore = Get-TargetHashes $projectRoot $control.Batch
    $startedAt = [DateTimeOffset]::Now.ToString('o', $InvariantCulture)
    $commandResults = [System.Collections.Generic.List[object]]::new()
    $policyResults = [System.Collections.Generic.List[object]]::new()
    $failedRequiredCommandId = $null

    $previousNoColor = $env:NO_COLOR; $previousForceColor = $env:FORCE_COLOR; $previousCi = $env:CI
    $env:NO_COLOR = '1'; Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue; $env:CI = '1'
    try {
        foreach ($entry in @($control.Batch.localValidation.commands)) {
            if ($null -ne $failedRequiredCommandId) {
                $commandResults.Add((New-NotRunResult $entry "FAIL_FAST_AFTER:${failedRequiredCommandId}"))
                continue
            }
            $safeId = ([string]$entry.id -replace '[^A-Za-z0-9_.-]', '_')
            $stdoutPath = Join-Path $logRoot "${safeId}.stdout.log"
            $stderrPath = Join-Path $logRoot "${safeId}.stderr.log"
            Write-Host "[B08] Ejecutando: $($entry.command)" -ForegroundColor Cyan
            $execution = Invoke-ProcessWithLogs `
                -Executable $env:ComSpec `
                -Arguments @('/d','/s','/c',[string]$entry.command) `
                -WorkingDirectory $projectRoot `
                -StdoutPath $stdoutPath `
                -StderrPath $stderrPath
            $policy = if ($execution.exitCode -eq 0) { Get-CommandPolicyResult $entry $stdoutPath $stderrPath } else { [pscustomobject]@{ commandId=[string]$entry.id; status='NOT_EVALUATED_AFTER_EXIT_FAILURE'; reason=$null; discovery=$null } }
            $policyResults.Add($policy)
            $status = if ($execution.exitCode -eq 0 -and $policy.status -in @('PASS','NOT_APPLICABLE')) { 'PASS' } else { 'FAIL' }
            $reason = if ($execution.exitCode -ne 0) { "NONZERO_EXIT_CODE:$($execution.exitCode)" } elseif ($policy.status -eq 'FAIL') { [string]$policy.reason } else { $null }
            $stdoutItem = Get-Item -LiteralPath $stdoutPath
            $stderrItem = Get-Item -LiteralPath $stderrPath
            $commandResults.Add([ordered]@{
                id=[string]$entry.id; category=[string]$entry.category; command=[string]$entry.command; required=[bool]$entry.required
                startedAt=$execution.startedAt; finishedAt=$execution.finishedAt; durationMilliseconds=[int64]$execution.durationMilliseconds
                exitCode=[int]$execution.exitCode; status=$status; stdoutLog="logs/${safeId}.stdout.log"; stderrLog="logs/${safeId}.stderr.log"
                stdoutSha256=$execution.stdoutSha256; stderrSha256=$execution.stderrSha256; stdoutBytes=[int64]$stdoutItem.Length; stderrBytes=[int64]$stderrItem.Length; reason=$reason
            })
            if ([bool]$entry.required -and $status -eq 'FAIL') {
                $failedRequiredCommandId = [string]$entry.id
                $PrimaryFailure = [ordered]@{ type='REQUIRED_COMMAND_FAILURE'; commandId=[string]$entry.id; command=[string]$entry.command; exitCode=[int]$execution.exitCode; reason=$reason }
                Write-Host "Fallo requerido en $($entry.id); se preservará como causa primaria." -ForegroundColor Red
                if ($stdoutItem.Length -gt 0) { Get-Content -LiteralPath $stdoutPath -Encoding UTF8 | ForEach-Object { Write-Host $_ } }
                if ($stderrItem.Length -gt 0) { Get-Content -LiteralPath $stderrPath -Encoding UTF8 | ForEach-Object { Write-Host $_ } }
            }
        }
    }
    finally {
        $env:NO_COLOR = $previousNoColor; if ($null -eq $previousForceColor) { Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue } else { $env:FORCE_COLOR = $previousForceColor }; $env:CI = $previousCi
    }

    $browserArtifacts = @(Copy-BrowserDiagnosticArtifacts -ProjectRoot $projectRoot -DestinationRoot $EvidenceRoot)
    try {
        $validatorRuntime = New-EvidenceValidatorRuntime -ProjectRoot $projectRoot -WorkRoot $resolvedWorkRoot
        $ValidatorRuntimeRoot = $validatorRuntime.Root
    }
    catch {
        $validatorRuntime = $null
        $partialValidatorRuntime = Join-Path $resolvedWorkRoot (".evidence-validator-" + $RunStamp)
        if (Test-Path -LiteralPath $partialValidatorRuntime) { Remove-Item -LiteralPath $partialValidatorRuntime -Recurse -Force }
        $SecondaryEvidenceErrors.Add([ordered]@{ type='EVIDENCE_VALIDATOR_RUNTIME_PREPARATION_FAILURE'; reason=$_.Exception.Message })
    }
    $regenerableArtifacts = Get-RegenerableArtifactStatus $projectRoot
    $removedRegenerables = Remove-RegenerableArtifacts $projectRoot
    $specifyTreeSha256After = Get-TreeSha256 (Join-Path $projectRoot '.specify')
    $sourceTasksSha256After = Get-Sha256 $tasksPath
    $targetFileHashesAfter = Get-TargetHashes $projectRoot $control.Batch
    $targetFilesUnchanged = Test-OrderedHashesEqual $targetFileHashesBefore $targetFileHashesAfter
    $finalTreeSha256 = Get-TreeSha256 $projectRoot
    $treeRestoredAfterCleanup = $finalTreeSha256 -eq $initialTreeSha256

    $requiredResults = @($commandResults | Where-Object required)
    $requiredPassCount = @($requiredResults | Where-Object status -eq 'PASS').Count
    $requiredFailCount = @($requiredResults | Where-Object status -eq 'FAIL').Count
    $requiredNotRunCount = @($requiredResults | Where-Object status -eq 'NOT_RUN').Count
    $functionalPass = (
        $commandResults.Count -eq @($control.Batch.localValidation.commands).Count -and
        $requiredPassCount -eq $requiredResults.Count -and $requiredFailCount -eq 0 -and $requiredNotRunCount -eq 0 -and
        $specifyTreeSha256After -eq $specifyTreeSha256Before -and $sourceTasksSha256After -eq $sourceTasksSha256Before -and
        $targetFilesUnchanged -and $treeRestoredAfterCleanup
    )
    if (-not $functionalPass -and $null -eq $PrimaryFailure) {
        $PrimaryFailure = [ordered]@{ type='POST_EXECUTION_INVARIANT_FAILURE'; commandId=$null; reason='One or more immutable-tree or command-summary invariants failed.' }
    }

    $environment = [ordered]@{
        operatingSystem=[System.Runtime.InteropServices.RuntimeInformation]::OSDescription.Trim()
        osVersion=[System.Environment]::OSVersion.Version.ToString()
        osArchitecture=[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
        processArchitecture=[System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
        powerShellVersion=$PSVersionTable.PSVersion.ToString(); powerShellEdition=[string]$PSVersionTable.PSEdition
        nodeVersion=(Get-CommandOutput 'node' @('--version')); npmVersion=(Get-CommandOutput 'npm' @('--version'))
    }
    $evidence = [ordered]@{
        '$schema'='implementation-control/schemas/local-validation-evidence.schema.json'; schemaVersion='1.1.0'; batchId=$BatchId; candidateRoot=$projectRoot
        candidate=[ordered]@{
            logicalZipName=$CandidateLogicalName; zipSha256=$AuthenticatedCandidateSha256; sidecarFileName=$CandidateSidecarLogicalName
            sidecarExpectedSha256=[string]$candidateSidecarRecord.Hash; sidecarMatch=$true; rootDirectory=$ExpectedRootDirectory
            archiveFileCount=[int]$inspection.fileCount; archiveRootCount=[int]$inspection.rootCount; archiveCrcRead=[bool]$inspection.crcRead
            archiveSafePaths=[bool]$inspection.safePaths; archiveMatchesExtraction=$true; archiveSymlinksDetected=[int]$inspection.symlinks
            archiveCaseFoldCollisionsDetected=[int]$inspection.caseFoldCollisions; archiveNestedArchivesDetected=[int]$inspection.nestedArchives
            fileManifestSha256=Get-Sha256 (Join-Path $projectRoot 'FILE_MANIFEST.sha256'); fileManifestValid=$true
            inventorySha256=Get-Sha256 (Join-Path $projectRoot 'PACKAGE_INVENTORY.json'); inventoryValid=$true
            metadataSha256=Get-Sha256 $metadataPath; metadataValid=$true; extractedTreeSha256=$initialTreeSha256
        }
        environment=$environment; startedAt=$startedAt; finishedAt=[DateTimeOffset]::Now.ToString('o',$InvariantCulture)
        status=if ($functionalPass) {'PASS'} else {'FAIL'}
        commandSummary=[ordered]@{ expectedCommandCount=@($control.Batch.localValidation.commands).Count; recordedCommandCount=$commandResults.Count; requiredPassCount=$requiredPassCount; requiredFailCount=$requiredFailCount; requiredNotRunCount=$requiredNotRunCount }
        commands=$commandResults; specifyTreeSha256Before=$specifyTreeSha256Before; specifyTreeSha256After=$specifyTreeSha256After
        sourceTasksSha256Before=$sourceTasksSha256Before; sourceTasksSha256After=$sourceTasksSha256After
        targetFileHashesBefore=$targetFileHashesBefore; targetFileHashesAfter=$targetFileHashesAfter; targetFilesUnchanged=$targetFilesUnchanged
        regenerableArtifacts=$regenerableArtifacts
    }
    $evidenceJsonPath = Join-Path $EvidenceRoot 'B08-local-validation.json'
    Write-Utf8Json $evidenceJsonPath $evidence
    Write-Utf8Json (Join-Path $runnerArtifactRoot 'runtime-and-parser-self-tests.json') ([ordered]@{ schemaVersion='1.0.0'; status='PASS'; astTokenCount=$astTokenCount; cultureAndJsonSelfTests='PASS'; parserSelfTests=$parserSelfTests; qualificationSelfTests=$qualificationSelfTests; runnerSha256=$AuthenticatedRunnerSha256 })
    Write-Utf8Json (Join-Path $runnerArtifactRoot 'command-policy-results.json') ([ordered]@{ schemaVersion='1.0.0'; batchId=$BatchId; results=$policyResults })
    Write-Utf8Json (Join-Path $runnerArtifactRoot 'command-execution-context.json') ([ordered]@{ schemaVersion='1.0.0'; batchId=$BatchId; cwd=$projectRoot; browserRequired=[bool]$control.Batch.localValidation.browserRequired; commands=@($control.Batch.localValidation.commands); environment=$environment })
    Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $EvidenceRoot $RunnerLogicalName) -Force
    Copy-Item -LiteralPath $RunnerSidecarPhysicalPath -Destination (Join-Path $EvidenceRoot $RunnerSidecarLogicalName) -Force
    Copy-Item -LiteralPath $CandidateSidecarPhysicalPath -Destination (Join-Path $EvidenceRoot $CandidateSidecarLogicalName) -Force
    Copy-Item -LiteralPath $PreflightReportPath -Destination $EvidenceRoot -Force
    Copy-Item -LiteralPath "${PreflightReportPath}.sha256" -Destination $EvidenceRoot -Force

    $schemaStdout = Join-Path $WrapperLogRoot 'evidence-schema.stdout.log'
    $schemaStderr = Join-Path $WrapperLogRoot 'evidence-schema.stderr.log'
    if ($null -ne $validatorRuntime) {
        try {
            $schemaExecution = Invoke-ProcessWithLogs -Executable (Get-Command node -ErrorAction Stop).Source -Arguments @($validatorRuntime.Validator,$validatorRuntime.Schema,$evidenceJsonPath) -WorkingDirectory $validatorRuntime.Root -StdoutPath $schemaStdout -StderrPath $schemaStderr
            $schemaPass = $schemaExecution.exitCode -eq 0
        }
        finally {
            if ($null -ne $ValidatorRuntimeRoot -and (Test-Path -LiteralPath $ValidatorRuntimeRoot)) { Remove-Item -LiteralPath $ValidatorRuntimeRoot -Recurse -Force }
        }
    }
    else {
        [System.IO.File]::WriteAllText($schemaStdout, '', $Utf8NoBom)
        [System.IO.File]::WriteAllText($schemaStderr, 'Evidence validator runtime could not be prepared before cleanup.', $Utf8NoBom)
        $schemaExecution = [ordered]@{ executable='node'; arguments=@(); cwd=$resolvedWorkRoot; startedAt=[DateTimeOffset]::Now.ToString('o',$InvariantCulture); finishedAt=[DateTimeOffset]::Now.ToString('o',$InvariantCulture); durationMilliseconds=0; exitCode=1; stdoutPath=$schemaStdout; stderrPath=$schemaStderr; stdoutSha256=Get-Sha256 $schemaStdout; stderrSha256=Get-Sha256 $schemaStderr }
        $schemaPass = $false
    }
    if (-not $schemaPass) {
        $schemaFailure = [ordered]@{ type='EVIDENCE_SCHEMA_FAILURE'; exitCode=$schemaExecution.exitCode; reason='Core evidence failed operational schema validation.' }
        if ($null -eq $PrimaryFailure) { $PrimaryFailure = $schemaFailure } else { $SecondaryEvidenceErrors.Add($schemaFailure) }
    }

    $controlPlaneFinal = Invoke-ControlPlaneValidator $projectRoot 'control-plane-final'
    $controlFinalSummary = $controlPlaneFinal.summary | ConvertFrom-Json
    $controlFinalPass = ([string]$controlFinalSummary.status -eq 'PASS' -and [int]$controlFinalSummary.failCount -eq 0 -and [int]$controlFinalSummary.passCount -eq [int]$controlFinalSummary.checkCount)
    if (-not $controlFinalPass) {
        $controlFailure = [ordered]@{ type='FINAL_CONTROL_PLANE_FAILURE'; reason='Final semantic control-plane validation failed.' }
        if ($null -eq $PrimaryFailure) { $PrimaryFailure = $controlFailure } else { $SecondaryEvidenceErrors.Add($controlFailure) }
    }
    $overallPass = $functionalPass -and $schemaPass -and $controlFinalPass
    $evidenceRunnerLogs = Join-Path $EvidenceRoot 'runner-logs'
    if (Test-Path -LiteralPath $evidenceRunnerLogs) { Remove-Item -LiteralPath $evidenceRunnerLogs -Recurse -Force }
    Copy-Item -LiteralPath $WrapperLogRoot -Destination $evidenceRunnerLogs -Recurse -Force

    $verificationSummary = [ordered]@{
        schemaVersion='2.0.0'; batchId=$BatchId; status=if ($overallPass) {'PASS'} else {'FAIL'}
        candidate=[ordered]@{ logicalName=$CandidateLogicalName; physicalName=(Split-Path -Leaf $CandidatePhysicalPath); sha256=$AuthenticatedCandidateSha256 }
        runner=[ordered]@{ logicalName=$RunnerLogicalName; physicalName=(Split-Path -Leaf $PSCommandPath); sha256=$AuthenticatedRunnerSha256 }
        primaryFailure=$PrimaryFailure; secondaryEvidenceErrors=@($SecondaryEvidenceErrors); commandSummary=$evidence.commandSummary; schemaValidation=[ordered]@{ status=if ($schemaPass) {'PASS'} else {'FAIL'}; execution=$schemaExecution }
        browserArtifacts=$browserArtifacts
        controlPlaneInitial=$controlPlane; controlPlaneFinal=$controlPlaneFinal; treeRestoredAfterCleanup=$treeRestoredAfterCleanup
        initialTreeSha256=$initialTreeSha256; finalTreeSha256=$finalTreeSha256; removedRegenerableArtifacts=$removedRegenerables
        finalizedAt=[DateTimeOffset]::Now.ToString('o',$InvariantCulture)
    }
    Write-Utf8Json (Join-Path $EvidenceRoot 'VERIFICATION_SUMMARY.json') $verificationSummary
    Write-Utf8Json (Join-Path $runnerArtifactRoot 'precompression-self-verification.json') ([ordered]@{
        schemaVersion='1.0.0'; status='PASS'; checkedAt=[DateTimeOffset]::Now.ToString('o',$InvariantCulture)
        coreEvidencePresent=(Test-Path -LiteralPath $evidenceJsonPath); runnerHashMatches=((Get-Sha256 (Join-Path $EvidenceRoot $RunnerLogicalName)) -eq $AuthenticatedRunnerSha256)
        candidateSidecarPresent=(Test-Path -LiteralPath (Join-Path $EvidenceRoot $CandidateSidecarLogicalName)); primaryFailure=$PrimaryFailure; secondaryEvidenceErrors=@($SecondaryEvidenceErrors)
    })
    [void](Write-EvidenceInventoryAndManifest $EvidenceRoot)

    $baseName = "FinScope_local_evidence_B08_${RunStamp}" + $(if ($overallPass) { '' } else { '_FAILED' })
    $finalZip = Join-Path $ResolvedInput "${baseName}.zip"
    Compress-Archive -Path (Join-Path $EvidenceRoot '*') -DestinationPath $finalZip -Force
    $finalSidecar = Write-Sha256Sidecar $finalZip (Split-Path -Leaf $finalZip)
    [void](Assert-Sidecar $finalSidecar $finalZip (Split-Path -Leaf $finalZip))
    [void](Assert-CompressedEvidenceArchive $finalZip $AuthenticatedRunnerSha256)
    if (-not $overallPass) { Write-Host "VALIDATION FAIL. Evidencia completa: ${finalZip}" -ForegroundColor Red; exit 1 }
    Write-Host "VALIDATION PASS. Evidencia completa: ${finalZip}" -ForegroundColor Green
    exit 0
}
catch {
    $reason = $_.Exception.ToString()
    $fallback = if ($null -ne $ResolvedInput) { $ResolvedInput } else { try { (Resolve-Path -LiteralPath $InputDirectory).Path } catch { $PSScriptRoot } }
    New-FailureDiagnostic -Reason $reason -OutputDirectory $fallback
    Write-Error $reason
    exit 1
}
