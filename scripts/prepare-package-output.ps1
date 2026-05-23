$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = [System.IO.Path]::GetFullPath($workspaceRoot)
$appBuilderPath = Join-Path $workspaceRoot 'node_modules\app-builder-bin\'
$unpackedAppPath = Join-Path $workspaceRoot 'dist\win-unpacked\'

function Get-LockingProcesses {
  Get-CimInstance Win32_Process | Where-Object {
    $executablePath = $_.ExecutablePath

    if ([string]::IsNullOrWhiteSpace($executablePath)) {
      return $false
    }

    $executablePath.StartsWith($appBuilderPath, [System.StringComparison]::OrdinalIgnoreCase) -or
    $executablePath.StartsWith($unpackedAppPath, [System.StringComparison]::OrdinalIgnoreCase)
  }
}

function Stop-LockingProcesses {
  $stoppedProcessIds = @()
  $lockingProcesses = Get-LockingProcesses

  foreach ($process in $lockingProcesses) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
      $stoppedProcessIds += $process.ProcessId
    } catch {
      Write-Warning "Failed to stop process $($process.Name) ($($process.ProcessId)): $($_.Exception.Message)"
    }
  }

  foreach ($processId in $stoppedProcessIds) {
    try {
      Wait-Process -Id $processId -Timeout 5 -ErrorAction SilentlyContinue
    } catch {
    }
  }

  return $stoppedProcessIds
}

Stop-LockingProcesses | Out-Null

$distPath = Join-Path $workspaceRoot 'dist'
if (Test-Path -LiteralPath $distPath) {
  try {
    Remove-Item -LiteralPath $distPath -Recurse -Force
  } catch {
    Stop-LockingProcesses | Out-Null
    Remove-Item -LiteralPath $distPath -Recurse -Force
  }
}