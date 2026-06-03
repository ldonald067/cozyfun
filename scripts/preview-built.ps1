param(
  [int]$Port = 4173
)
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Node = Join-Path $Root ".tools\node\node.exe"
$Preview = Join-Path $Root "scripts\preview-dist.mjs"

if (-not (Test-Path $Node)) {
  throw "Local Node runtime not found at $Node."
}

Push-Location $Root
try {
  & $Node $Preview $Port
  if ($LASTEXITCODE -ne 0) {
    throw "preview server failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
