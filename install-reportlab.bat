@echo off
chcp 65001 >nul
echo ========================================
echo 安装ReportLab依赖
echo ========================================
echo.

cd server-python

echo 正在安装ReportLab...
pip install reportlab>=4.0.0

echo.
echo ========================================
echo ReportLab安装完成！
echo ========================================
echo.
echo 现在可以使用文本转PDF功能了
echo.

pause


