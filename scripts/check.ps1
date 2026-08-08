$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:Path = "$Root\.tools\cargo\bin;$Root\.tools\node;$env:Path"
$env:RUSTUP_HOME = "$Root\.tools\rustup"
$env:CARGO_HOME = "$Root\.tools\cargo"

$Npm = Join-Path $Root ".tools\node\npm.cmd"
if (-not (Test-Path $Npm)) {
  $Npm = "npm"
}

function Invoke-CheckStep {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Name"
  $Start = Get-Date
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
  $Elapsed = (Get-Date) - $Start
  Write-Host ("<== {0} completed in {1:n1}s" -f $Name, $Elapsed.TotalSeconds)
}

Push-Location $Root
try {
  # One stage list, one owner. This wrapper used to enumerate every stage itself and
  # has now drifted from package.json twice — first shipping as a silent nine-stage
  # subset of twelve, then missing the interaction audit when the gate grew to thirteen.
  # It exists to put the repo-local toolchains on PATH, so that is all it does; the
  # stages come from `npm run check`, where they are defined.
  Invoke-CheckStep "Full gate (npm run check)" { & $Npm run check }
}
finally {
  Pop-Location
}
