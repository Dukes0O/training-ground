@echo off
setlocal
cd /d "%~dp0"
title Training Ground

where node >nul 2>nul
if errorlevel 1 (
  echo [Training Ground] Node.js was not found on this machine.
  echo Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if /i "%~1"=="update" (
  echo [Training Ground] Updating dependencies and rebuilding...
  call npm ci || goto :fail
  call npm run build || goto :fail
)

if not exist node_modules (
  echo [Training Ground] First run: installing dependencies. This takes a few minutes, one time only.
  call npm ci || goto :fail
)

if not exist dist\index.html (
  echo [Training Ground] Building the app...
  call npm run build || goto :fail
)

echo [Training Ground] Starting...
node server\index.mjs --open
exit /b 0

:fail
echo.
echo [Training Ground] Something went wrong. Review the output above, then try again.
pause
exit /b 1
