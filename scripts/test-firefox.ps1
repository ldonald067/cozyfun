param(
  [int]$AppPort = 4173
)
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:Path = "$Root\.tools\node;$env:Path"
$Firefox = $env:FIREFOX_BINARY
if (-not $Firefox) {
  $Firefox = "C:\Program Files\Mozilla Firefox\firefox.exe"
}
if (-not (Test-Path $Firefox)) {
  $Firefox = "C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
}
if (-not (Test-Path $Firefox)) {
  throw "Firefox was not found. Set FIREFOX_BINARY to firefox.exe."
}

$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
$Listener.Start()
$Port = $Listener.LocalEndpoint.Port
$Listener.Stop()

$Profile = Join-Path ([System.IO.Path]::GetTempPath()) ("cozy-firefox-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $Profile | Out-Null
@'
user_pref("remote.active-protocols", 1);
user_pref("remote.experimental.enabled", true);
'@ | Set-Content -Path (Join-Path $Profile "user.js") -Encoding ASCII
$FirefoxProcess = $null

Push-Location $Root
try {
  $FirefoxProcess = Start-Process -FilePath $Firefox -ArgumentList @(
    "--headless",
    "--new-instance",
    "--no-remote",
    "--profile",
    $Profile,
    "--remote-debugging-port",
    "$Port",
    "--remote-allow-hosts",
    "127.0.0.1,localhost",
    "--remote-allow-origins",
    "http://127.0.0.1:$Port,ws://127.0.0.1:$Port",
    "--remote-allow-system-access",
    "http://127.0.0.1:$AppPort/?firefoxQa=start"
  ) -WindowStyle Hidden -PassThru

  $env:FIREFOX_QA_APP_PORT = "$AppPort"
  node scripts/firefox-qa.mjs $Port
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  $Owner = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
  if ($Owner) {
    Stop-Process -Id $Owner -Force -ErrorAction SilentlyContinue
  }
  if ($FirefoxProcess) {
    Stop-Process -Id $FirefoxProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Recurse -Force $Profile -ErrorAction SilentlyContinue
  Pop-Location
}
