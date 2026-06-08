@echo off
REM tiktok-live-events (Python) - Windows one-click launcher
setlocal enabledelayedexpansion

where python >nul 2>&1
if errorlevel 1 (
    echo [events] Python is not installed. Get it from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [events] Updating tiktok-live-events...
call python -m pip install --user --upgrade --upgrade-strategy eager tiktok-live-events
if errorlevel 1 (
    echo [events] pip install failed. Continuing with existing install if present.
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
    call python -m tiktok_live_events.cli !TTUSER!
) else (
    call tiktok-live-events !TTUSER!
)

echo.
echo [events] done.
pause
