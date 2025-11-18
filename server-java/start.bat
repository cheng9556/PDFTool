@echo off
chcp 65001 >nul
echo ========================================
echo Excel转PDF服务 (JodConverter)
echo ========================================
echo.
echo 正在启动服务...
echo 端口: 8788
echo.

cd /d %~dp0
call mvn spring-boot:run

pause


