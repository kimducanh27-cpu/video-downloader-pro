@echo off
chcp 65001 >nul
title 🎬 Video Downloader Pro - Server

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║     🎬 VIDEO DOWNLOADER PRO - SCRAPBOOK EDITION 🎬       ║
echo ║                                                          ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║                                                          ║
echo ║   Dang khoi dong server...                               ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Kiểm tra Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Khong tim thay Node.js! Vui long cai dat Node.js truoc.
    echo Tai tai: https://nodejs.org/
    pause
    exit /b 1
)

:: Kiểm tra và cài đặt dependencies nếu chưa có
if not exist "node_modules" (
    echo [INFO] Dang cai dat dependencies...
    call npm install
    echo.
)

:: Khởi động server và mở trình duyệt sau 2 giây
echo [INFO] Dang khoi dong server tren cong 3000...
echo.

:: Mở trình duyệt sau 2 giây (chạy song song)
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Chạy server
node server.js

pause
