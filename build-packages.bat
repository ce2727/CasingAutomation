@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: build-packages.bat
:: Creates packaged desktop builds of ProCase for macOS and Windows.
::
:: Usage:
::   build-packages.bat          (Build for both macOS and Windows)
::   build-packages.bat mac      (Build for macOS only)
::   build-packages.bat win      (Build for Windows only)
:: ==============================================================================

cd /d "%~dp0"

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=all"

echo =================================================
echo   ProCase Desktop Build ^& Package Generator
echo =================================================
echo Target: %TARGET%
echo.

:: 1. Ensure dependencies are installed
if not exist "node_modules" (
  echo ==^> node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 goto :error
)

:: 2. Build TypeScript and Vite web & electron bundles
echo ==^> Step 1: Compiling TypeScript and building Vite bundle...
call npm run build
if errorlevel 1 goto :error

:: 3. Package based on target
if /i "%TARGET%"=="mac" goto :build_mac
if /i "%TARGET%"=="win" goto :build_win
if /i "%TARGET%"=="all" goto :build_all

echo Unknown target: %TARGET%
echo Valid options: all, mac, win
exit /b 1

:build_mac
echo.
echo ==^> Step 2: Packaging for macOS...
call npx electron-builder --mac
if errorlevel 1 goto :error
goto :done

:build_win
echo.
echo ==^> Step 2: Packaging for Windows...
call npx electron-builder --win
if errorlevel 1 goto :error
goto :done

:build_all
echo.
echo ==^> Step 2: Packaging for macOS...
call npx electron-builder --mac
if errorlevel 1 goto :error

echo.
echo ==^> Step 3: Packaging for Windows...
call npx electron-builder --win
if errorlevel 1 goto :error
goto :done

:done
echo.
echo =================================================
echo   Build successful! Artifacts generated in: release\
echo =================================================
dir release
exit /b 0

:error
echo.
echo =================================================
echo   [ERROR] Packaging failed!
echo =================================================
exit /b 1
