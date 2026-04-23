@echo off
setlocal

if "%~2"=="" exit /b 0

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "try { Stop-Process -Id %~2 -Force -ErrorAction Stop } catch { }"
exit /b 0