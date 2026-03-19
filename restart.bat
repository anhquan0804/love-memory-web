@echo off
echo Stopping old server...
taskkill /F /IM node.exe >nul 2>&1

echo Restarting...
cd /d D:\VibeCode
call start-tunnel.bat
