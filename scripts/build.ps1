$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:Path = "$Root\.tools\cargo\bin;$Root\.tools\node;$env:Path"
$env:RUSTUP_HOME = "$Root\.tools\rustup"
$env:CARGO_HOME = "$Root\.tools\cargo"

Push-Location $Root
try {
  npm run build
}
finally {
  Pop-Location
}

