param(
  [switch]$BuildInstaller,
  [switch]$SkipE2E
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Invoke-Checked {
  param([string]$Command, [string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Push-Location $Root
try {
  Invoke-Checked "npm" @("run", "lint")
  Invoke-Checked "npm" @("test")
  Invoke-Checked "npm" @("run", "build")

  if (-not $SkipE2E) {
    Invoke-Checked "npx" @("playwright", "install", "chrome")
    Invoke-Checked "npm" @("run", "test:e2e")
  }

  Push-Location (Join-Path $Root "src-tauri")
  try {
    Invoke-Checked "cargo" @("fmt", "--all", "--check")
    Invoke-Checked "cargo" @("clippy", "--all-targets", "--", "-D", "warnings")
    Invoke-Checked "cargo" @("test")
  }
  finally {
    Pop-Location
  }

  if ($BuildInstaller) {
    Invoke-Checked "npx" @("tauri", "build", "--bundles", "nsis")
    $installers = Get-ChildItem -Path (Join-Path $Root "src-tauri/target/release/bundle/nsis") -Filter "*.exe" |
      Sort-Object LastWriteTime -Descending
    if ($installers.Count -eq 0) {
      throw "NSIS installer was not created"
    }
    Write-Host "Windows installer: $($installers[0].FullName)"
    Get-FileHash -Algorithm SHA256 $installers[0].FullName | Format-List
  }
}
finally {
  Pop-Location
}
