@echo off
REM PDF转Word Python服务启动脚本 (Windows)

echo ========================================
echo PDF转Word服务启动脚本
echo ========================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Python，请先安装Python 3.8+
    pause
    exit /b 1
)

echo Python版本:
python --version
echo.

REM 检查虚拟环境是否存在
if not exist "venv" (
    echo 首次运行，正在创建虚拟环境...
    python -m venv venv
    echo 虚拟环境创建完成
    echo.
)

REM 激活虚拟环境
echo 激活虚拟环境...
call venv\Scripts\activate.bat

REM 安装依赖
echo 检查并安装依赖...
pip install -r requirements.txt
echo.

REM 启动服务
echo 启动PDF转Word服务...
echo 服务地址: http://localhost:8789
echo 按 Ctrl+C 停止服务
echo.

python app.py

pause

