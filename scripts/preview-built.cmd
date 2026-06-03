@echo off
set PORT=%~1
if "%PORT%"=="" set PORT=4173
cd /d "%~dp0.."
".tools\node\node.exe" "scripts\preview-dist.mjs" "%PORT%"
echo.
echo Preview stopped. If this was unexpected, keep this window open and read the message above.
pause
