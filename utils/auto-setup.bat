@echo off
%SystemRoot%\System32\chcp.com 65001 >nul 2>&1
:: Автоматический подбор и установка лучшего пресета

setlocal EnableDelayedExpansion

set "SYS32=%SystemRoot%\System32"
set "PS_EXE=%SYS32%\WindowsPowerShell\v1.0\powershell.exe"

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"

echo Запуск умного авто-подбора пресетов...
%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%BASE_DIR%\test-presets.ps1" -AutoRun

echo.
echo Авто-подбор завершен. 
if /i not "%~1"=="silent" (
    timeout /t 3 /nobreak >nul
)
