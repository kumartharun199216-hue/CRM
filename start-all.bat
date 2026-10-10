@echo off
title Sales CRM Launcher
echo Starting both Sales CRM Backend and Frontend...
start "" "%~dp0start-backend.bat"
timeout /t 2 /nobreak >nul
start "" "%~dp0start-frontend.bat"
echo Servers launched in background windows!
