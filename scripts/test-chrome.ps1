param(
  [int]$AppPort = 4173,
  [switch]$Headless,
  [switch]$KeepOpen
)
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:Path = "$Root\.tools\node;$env:Path"
$Chrome = $env:BROWSER_BINARY
if (-not $Chrome) {
  $Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $Chrome)) {
  $Chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $Chrome)) {
  $Chrome = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $Chrome)) {
  $Chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $Chrome)) {
  throw "Chrome or Edge was not found. Set BROWSER_BINARY to chrome.exe or msedge.exe."
}

$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
$Listener.Start()
$Port = $Listener.LocalEndpoint.Port
$Listener.Stop()

$Profile = Join-Path ([System.IO.Path]::GetTempPath()) ("cozy-chrome-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $Profile | Out-Null
$BrowserProcess = $null

Push-Location $Root
try {
  $Arguments = @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=$Profile",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-networking",
    "--disable-extensions",
    "--disable-sync",
    "--no-default-browser-check",
    "--no-first-run",
    "--window-size=1280,800",
    "about:blank"
  )
  if ($Headless) {
    $Arguments = @("--headless=new", "--disable-gpu", "--no-sandbox") + $Arguments
  }

  $BrowserProcess = Start-Process -FilePath $Chrome -ArgumentList $Arguments -PassThru
  $env:CHROME_QA_APP_PORT = "$AppPort"
  node scripts/chrome-qa.mjs $Port
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  if ($KeepOpen) {
    Write-Host "Chrome QA passed. Browser left open on http://127.0.0.1:$AppPort/ with profile $Profile"
    $BrowserProcess = $null
    $Profile = $null
  }
}
finally {
  if (-not $KeepOpen) {
    $Owner = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
    if ($Owner) {
      Stop-Process -Id $Owner -Force -ErrorAction SilentlyContinue
    }
    if ($BrowserProcess) {
      Stop-Process -Id $BrowserProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($Profile) {
      Remove-Item -Recurse -Force $Profile -ErrorAction SilentlyContinue
    }
  }
  Pop-Location
}
