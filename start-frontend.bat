@echo off
title Sales CRM Frontend Server
echo ============================================================
echo Starting Sales CRM Frontend (Vite on http://localhost:5173)
echo ============================================================
cd /d "%~dp0frontend"
npm run dev
pause
