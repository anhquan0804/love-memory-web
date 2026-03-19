@echo off
cd /d D:\VibeCode

:: Add Node.js to PATH
set PATH=%PATH%;C:\Program Files\nodejs

:: Start Node.js server in background
echo Starting Love Memory server...
start "" /B node server.js

:: Wait for server to be ready
timeout /t 3 /nobreak > nul

:: Start Cloudflare tunnel and send Telegram notification
echo Starting Cloudflare Tunnel...
node start-tunnel.js
