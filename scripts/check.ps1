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
  Invoke-CheckStep "Material identity audit" { & $Npm run material:audit }
  Invoke-CheckStep "Rust simulation tests" { & $Npm run test:sim }
  Invoke-CheckStep "Production build" { & $Npm run build }
  Invoke-CheckStep "WASM smoke checks" { & (Join-Path $Root ".tools\node\node.exe") "scripts/smoke-wasm.mjs" }
  Invoke-CheckStep "JavaScript fallback smoke checks" { & $Npm run test:js-fallback }
  Invoke-CheckStep "Browser smoke checks" { & $Npm run test:browser }
  Invoke-CheckStep "Audio QA renders" { & $Npm run audio:qa }
  Invoke-CheckStep "Visual QA captures" { & $Npm run visual:qa }
  Write-Host ""
  Write-Host "Full local check passed."
}
finally {
  Pop-Location
}
