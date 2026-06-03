$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$NodeRoot = Join-Path $Root ".tools\node"
$Npm = Join-Path $NodeRoot "npm.cmd"

if (-not (Test-Path $Npm)) {
  throw "Local npm runtime not found at $Npm. Run npm directly, or restore the repo .tools runtime."
}

$env:Path = "$NodeRoot;$env:Path"

Push-Location $Root
try {
  & $Npm --prefix app @args
  if ($LASTEXITCODE -ne 0) {
    throw "app npm command failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
