@echo off
title Lensello - local dev server
cd /d "%~dp0"

echo.
echo   Lensello - starting the local copy
echo   ----------------------------------
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js is not installed, or not on PATH.
  echo   Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "apps\web\.env.local" (
  echo   Missing apps\web\.env.local - the app cannot reach Supabase without it.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   First run: installing dependencies. This takes a few minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   Dependency install failed. Leave this window open and show Claude the error.
    pause
    exit /b 1
  )
)

echo   Starting the server. Your browser opens when it is ready.
echo   Closing this window stops the server.
echo.

REM Wait for the server to answer before opening the browser, otherwise the
REM first page load lands on a connection error and looks like a failure.
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline=(Get-Date).AddSeconds(120); while((Get-Date) -lt $deadline){ try{ Invoke-WebRequest -Uri 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 2 ^| Out-Null; Start-Process 'http://localhost:3000'; exit }catch{ Start-Sleep -Milliseconds 800 } }"

call npm run dev

echo.
echo   The server has stopped.
pause
