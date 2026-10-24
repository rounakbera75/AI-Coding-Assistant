@echo off
cd /d "%~dp0"
title Nexus AI Assistant - Live Server
echo ========================================================
echo Starting Nexus AI Copilot and Public Cloudflare Tunnel...
echo ========================================================
.\.venv\Scripts\python.exe run_live.py
pause
