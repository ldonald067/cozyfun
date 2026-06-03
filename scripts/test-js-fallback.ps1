$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:Path = "$Root\.tools\node;$env:Path"

$Npm = Join-Path $Root ".tools\node\npm.cmd"
if (-not (Test-Path $Npm)) {
  $Npm = "npm"
}

Push-Location $Root
try {
  & $Npm run test:js-fallback
  if ($LASTEXITCODE -ne 0) {
    throw "npm run test:js-fallback failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
