@echo off
cd /d "%~dp0"
title Arno Flashcard Generator
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install Node.js version 20 or later.
  echo Download from: https://nodejs.org/
  pause
  exit /b 1
)
echo Starting Arno...
echo Open http://localhost:3000 in your browser.
start "" /B powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"
node server.mjs
pause
