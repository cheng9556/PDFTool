@echo off
chcp 65001 >nul
echo ========================================
echo 修复GitHub连接问题
echo ========================================
echo.

echo [步骤1] 检查当前远程仓库配置...
git remote -v
echo.

echo [步骤2] 移除现有的SSH远程仓库...
git remote remove origin 2>nul
echo 已移除旧配置
echo.

echo [步骤3] 请输入您的GitHub用户名（例如：zhangsan）
set /p GITHUB_USERNAME="GitHub用户名: "
echo.

echo [步骤4] 添加HTTPS远程仓库...
git remote add origin https://github.com/%GITHUB_USERNAME%/PDFTool.git
echo.

echo [步骤5] 验证新配置...
git remote -v
echo.

echo ========================================
echo ✅ 配置完成！
echo ========================================
echo.
echo 接下来请运行：
echo   git push -u origin main
echo.
echo 推送时会提示输入GitHub凭据：
echo   - Username: 您的GitHub用户名
echo   - Password: 使用Personal Access Token（不是密码）
echo.
echo 如何获取Token：
echo   1. 访问: https://github.com/settings/tokens
echo   2. 点击: Generate new token (classic)
echo   3. 勾选: repo (完整权限)
echo   4. 生成并复制token
echo   5. 推送时粘贴token作为密码
echo.
pause

