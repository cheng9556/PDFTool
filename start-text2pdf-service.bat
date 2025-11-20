@echo off
chcp 65001 >nul

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║            启动文本转PDF服务                                ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo ✨ 功能特性：
echo   • 支持直接输入文本或上传TXT文件
echo   • 自动换行和分页
echo   • 完美支持中文
echo   • 可自定义字体大小和行间距
echo   • 高性能、高质量、快速转换
echo.

echo ⏳ 正在启动Python服务...
echo.

cd server-python
python app_optimized.py

