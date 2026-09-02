@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: deploy-vercel.bat
:: Deploys the ProCase web application to Vercel production.
::
:: Usage:
::   deploy-vercel.bat           (Deploy to production)
::   deploy-vercel.bat --preview (Deploy preview build)
:: ==============================================================================

cd /d "%~dp0"

echo =================================================
echo   ProCase Vercel Deployment
echo =================================================
echo.

if not exist "node_modules" (
  echo ==^> node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 goto :error
)

echo ==^> Verifying web bundle build (VERCEL=1)...
set VERCEL=1
call npm run build
if errorlevel 1 goto :error

set "TARGET_FLAG=--prod"
if /i "%~1"=="--preview" set "TARGET_FLAG="

if defined TARGET_FLAG (
  echo.
  echo ==^> Deploying to Vercel ^(Production^)...
  call npx vercel deploy --prod --yes %*
) else (
  echo.
  echo ==^> Deploying to Vercel ^(Preview^)...
  call npx vercel deploy --yes %*
)

if errorlevel 1 goto :error

echo.
echo =================================================
echo   Vercel deployment completed successfully!
echo =================================================
exit /b 0

:error
echo.
echo =================================================
echo   [ERROR] Vercel deployment failed!
echo =================================================
exit /b 1
