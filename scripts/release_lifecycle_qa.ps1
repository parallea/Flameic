param(
  [string]$MsiPath = 'D:\Flameic-cargo-target\release\bundle\msi\AgentBoard_0.1.0-1_x64_en-US.msi',
  [string]$NsisPath = 'D:\Flameic-cargo-target\release\bundle\nsis\AgentBoard_0.1.0-1_x64-setup.exe',
  [string]$EvidenceDirectory = "$PSScriptRoot\..\release-qa-evidence",
  [switch]$SkipMsi
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$appDataDirectory = Join-Path $env:APPDATA 'AgentBoard'
$workspaceRegistry = Join-Path $appDataDirectory 'workspaces.json'
$localInstallDirectory = Join-Path $env:LOCALAPPDATA 'AgentBoard'
$msiInstallDirectory = Join-Path $env:ProgramFiles 'AgentBoard'
$msiInstallDirectoryX86 = Join-Path ${env:ProgramFiles(x86)} 'AgentBoard'
$msiInstalled = $false

function Get-HashRecord {
  param([string]$Path, [string]$BasePath)

  $item = Get-Item -LiteralPath $Path
  [pscustomobject]@{
    relativePath = $item.FullName.Substring($BasePath.Length).TrimStart('\')
    length = $item.Length
    sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
  }
}

function Get-StateSnapshot {
  param([string]$Label)

  $appDataFiles = @()
  if (Test-Path -LiteralPath $appDataDirectory) {
    $appDataFiles = @(
      Get-ChildItem -LiteralPath $appDataDirectory -Recurse -File |
        ForEach-Object { Get-HashRecord -Path $_.FullName -BasePath $appDataDirectory } |
        Sort-Object relativePath
    )
  }

  $workspaces = @()
  if (Test-Path -LiteralPath $workspaceRegistry) {
    $registry = Get-Content -Raw -LiteralPath $workspaceRegistry | ConvertFrom-Json
    $workspaces = @(
      foreach ($workspace in $registry.workspaces) {
        $pipelinePath = Join-Path $workspace.path '.agentboard\pipelines.json'
        $logsDirectory = Join-Path $workspace.path '.agentboard\logs'
        $logs = @()
        if (Test-Path -LiteralPath $logsDirectory) {
          $logs = @(
            Get-ChildItem -LiteralPath $logsDirectory -File -Filter '*.log' |
              ForEach-Object { Get-HashRecord -Path $_.FullName -BasePath $logsDirectory } |
              Sort-Object relativePath
          )
        }
        [pscustomobject]@{
          id = $workspace.id
          name = $workspace.name
          path = $workspace.path
          exists = Test-Path -LiteralPath $workspace.path
          pipelineSha256 = if (Test-Path -LiteralPath $pipelinePath) {
            (Get-FileHash -LiteralPath $pipelinePath -Algorithm SHA256).Hash
          } else {
            $null
          }
          logs = $logs
        }
      }
    )
  }

  $installedExecutables = @(
    @(
      (Join-Path $localInstallDirectory 'agentboard.exe'),
      (Join-Path $msiInstallDirectory 'agentboard.exe'),
      (Join-Path $msiInstallDirectoryX86 'agentboard.exe')
    ) |
      Where-Object { Test-Path -LiteralPath $_ } |
      ForEach-Object {
        $item = Get-Item -LiteralPath $_
        [pscustomobject]@{
          path = $item.FullName
          length = $item.Length
          sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
          fileVersion = $item.VersionInfo.FileVersion
          productVersion = $item.VersionInfo.ProductVersion
        }
      }
  )

  [pscustomobject]@{
    label = $Label
    capturedAt = (Get-Date).ToString('o')
    appDataDirectory = $appDataDirectory
    appDataFiles = $appDataFiles
    workspaces = $workspaces
    installedExecutables = $installedExecutables
  }
}

function Save-StateSnapshot {
  param([string]$Label)

  $snapshot = Get-StateSnapshot -Label $Label
  $path = Join-Path $EvidenceDirectory "$Label.json"
  $snapshot | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
  $snapshot
}

function Assert-DataPreserved {
  param($Baseline, $Current, [string]$Phase)

  foreach ($file in $Baseline.appDataFiles) {
    $match = $Current.appDataFiles | Where-Object { $_.relativePath -eq $file.relativePath }
    if (-not $match) {
      throw "$Phase removed app data file $($file.relativePath)"
    }
    if ($match.sha256 -ne $file.sha256) {
      throw "$Phase changed app data file $($file.relativePath)"
    }
  }

  foreach ($workspace in $Baseline.workspaces) {
    $currentWorkspace = $Current.workspaces | Where-Object { $_.id -eq $workspace.id }
    if (-not $currentWorkspace -or -not $currentWorkspace.exists) {
      throw "$Phase removed registered workspace $($workspace.path)"
    }
    if ($currentWorkspace.pipelineSha256 -ne $workspace.pipelineSha256) {
      throw "$Phase changed pipeline metadata for $($workspace.path)"
    }
    foreach ($log in $workspace.logs) {
      $currentLog = $currentWorkspace.logs |
        Where-Object { $_.relativePath -eq $log.relativePath }
      if (-not $currentLog) {
        throw "$Phase removed session log $($workspace.path)\$($log.relativePath)"
      }
      if ($currentLog.sha256 -ne $log.sha256) {
        throw "$Phase changed session log $($workspace.path)\$($log.relativePath)"
      }
    }
  }
}

function Invoke-CheckedProcess {
  param(
    [string]$FilePath,
    [string]$ArgumentList,
    [string]$Label,
    [switch]$Elevate
  )

  $parameters = @{
    FilePath = $FilePath
    ArgumentList = $ArgumentList
    Wait = $true
    PassThru = $true
  }
  if ($Elevate) {
    $parameters.Verb = 'RunAs'
  }
  $process = Start-Process @parameters
  if ($process.ExitCode -ne 0) {
    throw "$Label failed with exit code $($process.ExitCode)"
  }
}

function Get-InstalledExecutable {
  foreach ($path in @(
    (Join-Path $localInstallDirectory 'agentboard.exe'),
    (Join-Path $msiInstallDirectory 'agentboard.exe'),
    (Join-Path $msiInstallDirectoryX86 'agentboard.exe')
  )) {
    if (Test-Path -LiteralPath $path) {
      return $path
    }
  }
  throw 'AgentBoard executable is not installed.'
}

function Test-PackagedLaunch {
  param([string]$Label)

  $executable = Get-InstalledExecutable
  $process = Start-Process -FilePath $executable -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 8
  $process.Refresh()
  if ($process.HasExited) {
    throw "$Label packaged app exited early with code $($process.ExitCode)"
  }
  if (-not $process.CloseMainWindow()) {
    Stop-Process -Id $process.Id
  } else {
    if (-not $process.WaitForExit(5000)) {
      Stop-Process -Id $process.Id
    }
  }
}

New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath $MsiPath)) {
  throw "MSI not found: $MsiPath"
}
if (-not (Test-Path -LiteralPath $NsisPath)) {
  throw "NSIS installer not found: $NsisPath"
}
if (-not (Test-Path -LiteralPath $workspaceRegistry)) {
  throw "Workspace registry not found: $workspaceRegistry"
}
if (Get-Process agentboard -ErrorAction SilentlyContinue) {
  throw 'AgentBoard must be closed before lifecycle QA.'
}

$summary = [ordered]@{
  startedAt = (Get-Date).ToString('o')
  msiPath = $MsiPath
  msiSha256 = (Get-FileHash -LiteralPath $MsiPath -Algorithm SHA256).Hash
  nsisPath = $NsisPath
  nsisSha256 = (Get-FileHash -LiteralPath $NsisPath -Algorithm SHA256).Hash
  phases = @()
  result = 'running'
}

$baseline = Save-StateSnapshot -Label '00-baseline'

try {
  Invoke-CheckedProcess -FilePath $NsisPath -ArgumentList '/S' -Label 'NSIS update install'
  Test-PackagedLaunch -Label 'NSIS update install'
  $afterNsisUpdate = Save-StateSnapshot -Label '01-after-nsis-update'
  Assert-DataPreserved -Baseline $baseline -Current $afterNsisUpdate -Phase 'NSIS update'
  $summary.phases += 'NSIS update install and launch passed'

  $uninstaller = Join-Path $localInstallDirectory 'uninstall.exe'
  Invoke-CheckedProcess -FilePath $uninstaller -ArgumentList '/S' -Label 'NSIS uninstall'
  if (Test-Path -LiteralPath (Join-Path $localInstallDirectory 'agentboard.exe')) {
    throw 'NSIS uninstall left agentboard.exe installed.'
  }
  $afterNsisUninstall = Save-StateSnapshot -Label '02-after-nsis-uninstall'
  Assert-DataPreserved -Baseline $baseline -Current $afterNsisUninstall -Phase 'NSIS uninstall'
  $summary.phases += 'NSIS uninstall preserved app data, workspaces, and logs'

  Invoke-CheckedProcess -FilePath $NsisPath -ArgumentList '/S' -Label 'NSIS reinstall'
  Test-PackagedLaunch -Label 'NSIS reinstall'
  $afterNsisReinstall = Save-StateSnapshot -Label '03-after-nsis-reinstall'
  Assert-DataPreserved -Baseline $baseline -Current $afterNsisReinstall -Phase 'NSIS reinstall'
  $summary.phases += 'NSIS reinstall and launch passed'

  if ($SkipMsi) {
    $summary.phases += 'MSI phase skipped by request'
  } else {
    $uninstaller = Join-Path $localInstallDirectory 'uninstall.exe'
    Invoke-CheckedProcess -FilePath $uninstaller -ArgumentList '/S' -Label 'NSIS uninstall before MSI'

    $msiInstallLog = Join-Path $EvidenceDirectory 'msi-install.log'
    Invoke-CheckedProcess -FilePath 'msiexec.exe' `
      -ArgumentList "/i `"$MsiPath`" /qn /norestart /L*v `"$msiInstallLog`"" `
      -Label 'MSI install' `
      -Elevate
    $msiInstalled = $true
    Test-PackagedLaunch -Label 'MSI install'
    $afterMsiInstall = Save-StateSnapshot -Label '04-after-msi-install'
    Assert-DataPreserved -Baseline $baseline -Current $afterMsiInstall -Phase 'MSI install'
    $summary.phases += 'MSI install and launch passed'

    $msiUninstallLog = Join-Path $EvidenceDirectory 'msi-uninstall.log'
    Invoke-CheckedProcess -FilePath 'msiexec.exe' `
      -ArgumentList "/x `"$MsiPath`" /qn /norestart /L*v `"$msiUninstallLog`"" `
      -Label 'MSI uninstall' `
      -Elevate
    $msiInstalled = $false
    if (Test-Path -LiteralPath (Join-Path $msiInstallDirectory 'agentboard.exe')) {
      throw 'MSI uninstall left the Program Files executable installed.'
    }
    $afterMsiUninstall = Save-StateSnapshot -Label '05-after-msi-uninstall'
    Assert-DataPreserved -Baseline $baseline -Current $afterMsiUninstall -Phase 'MSI uninstall'
    $summary.phases += 'MSI uninstall preserved app data, workspaces, and logs'

    Invoke-CheckedProcess -FilePath $NsisPath -ArgumentList '/S' -Label 'Final NSIS install'
    Test-PackagedLaunch -Label 'Final NSIS install'
    $finalState = Save-StateSnapshot -Label '06-final-nsis-install'
    Assert-DataPreserved -Baseline $baseline -Current $finalState -Phase 'Final NSIS install'
    $summary.phases += 'Final NSIS install and launch passed'
  }
  $summary.result = 'passed'
} catch {
  $summary.result = 'failed'
  $summary.error = $_.Exception.Message
  throw
} finally {
  if ($msiInstalled) {
    $cleanupLog = Join-Path $EvidenceDirectory 'msi-cleanup-uninstall.log'
    $cleanup = Start-Process -FilePath 'msiexec.exe' `
      -ArgumentList "/x `"$MsiPath`" /qn /norestart /L*v `"$cleanupLog`"" `
      -Verb RunAs -Wait -PassThru
    $summary.msiCleanupExitCode = $cleanup.ExitCode
  }
  if (-not (Test-Path -LiteralPath (Join-Path $localInstallDirectory 'agentboard.exe'))) {
    $restore = Start-Process -FilePath $NsisPath -ArgumentList '/S' -Wait -PassThru
    $summary.finalNsisRestoreExitCode = $restore.ExitCode
  }
  $summary.finishedAt = (Get-Date).ToString('o')
  $summary | ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'summary.json') -Encoding UTF8
}

$summary | ConvertTo-Json -Depth 8
