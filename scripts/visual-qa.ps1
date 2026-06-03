$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:Path = "$Root\.tools\node;$env:Path"

$Npm = Join-Path $Root ".tools\node\npm.cmd"
if (-not (Test-Path $Npm)) {
  $Npm = "npm"
}

Push-Location $Root
try {
  & $Npm run visual:qa
  if ($LASTEXITCODE -ne 0) {
    throw "npm run visual:qa failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
