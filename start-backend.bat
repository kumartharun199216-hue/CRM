@echo off
title Sales CRM Backend Server
echo ============================================================
echo Starting Sales CRM Backend (Django on http://127.0.0.1:8000)
echo ============================================================
cd /d "%~dp0"
call .\venv\Scripts\activate.bat
python backend\manage.py runserver 127.0.0.1:8000
pause
