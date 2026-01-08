@echo off
chcp 65001 >nul
echo ========================================
echo Excel转PDF服务 (JodConverter)
echo ========================================
echo.
echo 正在启动服务...
echo 端口: 8788
echo.

REM 设置LibreOffice环境变量（解决"Could not find platform independent libraries"错误）
set "URE_BOOTSTRAP=C:\Program Files\LibreOffice\program\fundamental.ini"
set "SAL_USE_VCLPLUGIN=gen"
set "SAL_DISABLE_OPENCL=1"

echo 已设置LibreOffice环境变量:
echo   URE_BOOTSTRAP=%URE_BOOTSTRAP%
echo   SAL_USE_VCLPLUGIN=%SAL_USE_VCLPLUGIN%
echo   SAL_DISABLE_OPENCL=%SAL_DISABLE_OPENCL%
echo.

cd /d %~dp0
call mvn spring-boot:run

pause


