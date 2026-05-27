$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:Path = "$Root\.tools\node;$env:Path"

Push-Location $Root
try {
  npm run visual:qa
}
finally {
  Pop-Location
}
