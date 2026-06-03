$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:Path = "$Root\.tools\cargo\bin;$Root\.tools\node;$env:Path"
$env:RUSTUP_HOME = "$Root\.tools\rustup"
$env:CARGO_HOME = "$Root\.tools\cargo"

$Npm = Join-Path $Root ".tools\node\npm.cmd"
if (-not (Test-Path $Npm)) {
  $Npm = "npm"
}

Push-Location $Root
try {
  & $Npm run dev -- --port 5173
  if ($LASTEXITCODE -ne 0) {
    throw "npm run dev failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
