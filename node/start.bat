@echo off
REM tiktok-live-events - Windows one-click launcher
setlocal enabledelayedexpansion

where node >nul 2>&1
if errorlevel 1 (
    echo [events] Node.js is not installed. Get it from https://nodejs.org/
    pause
    exit /b 1
)

echo [events] Updating tiktok-live-events...
call npm i -g tiktok-live-events@latest >nul 2>&1
if errorlevel 1 (
    echo [events] Global install failed. Will use npx.
)

set /p TTUSER=Enter the TikTok username (without @):
if "!TTUSER!"=="" (
    echo [events] No username entered. Exiting.
    pause
    exit /b 1
)

echo [events] connecting to @!TTUSER!  (Ctrl+C to stop)
where tiktok-live-events >nul 2>&1
if errorlevel 1 (
    call npx -y tiktok-live-events !TTUSER!
) else (
    call tiktok-live-events !TTUSER!
)

echo.
echo [events] done.
pause
