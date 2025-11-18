# Python 安装指南

## Windows 系统

### 方法1：从官网下载安装（推荐）

1. **下载Python**
   - 访问 Python 官网：https://www.python.org/downloads/
   - 下载 **Python 3.8 或更高版本**
   - 推荐下载：Python 3.11.x（稳定版）

2. **安装Python**
   - 运行下载的安装程序
   - ⚠️ **重要**：勾选 "Add Python to PATH"
   - 点击 "Install Now"
   - 等待安装完成

3. **验证安装**
   ```powershell
   python --version
   # 应显示：Python 3.11.x
   ```

### 方法2：使用Microsoft Store（简单）

1. 打开 **Microsoft Store**
2. 搜索 "Python 3.11"
3. 点击"获取"或"安装"
4. 安装完成后，在命令行中验证：
   ```powershell
   python --version
   ```

### 方法3：使用Chocolatey（开发者推荐）

```powershell
# 以管理员身份运行PowerShell
choco install python
```

## 常见问题

### 1. "python"不是内部或外部命令

**原因**：Python未添加到系统PATH环境变量

**解决方案**：
1. 找到Python安装目录（通常在 `C:\Users\你的用户名\AppData\Local\Programs\Python\Python311\`）
2. 右键"此电脑" → "属性" → "高级系统设置" → "环境变量"
3. 在"系统变量"中找到"Path"，点击"编辑"
4. 添加Python安装目录和Scripts目录：
   - `C:\Users\你的用户名\AppData\Local\Programs\Python\Python311\`
   - `C:\Users\你的用户名\AppData\Local\Programs\Python\Python311\Scripts\`
5. 点击"确定"保存
6. 重启命令行窗口

### 2. 找不到Python安装目录

在PowerShell中运行：
```powershell
where.exe python
```

### 3. pip不可用

```powershell
# 下载get-pip.py
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py

# 安装pip
python get-pip.py
```

## 验证安装完成

运行以下命令，确保都能正常输出：

```powershell
# 检查Python版本
python --version

# 检查pip版本
pip --version

# 测试Python
python -c "print('Python安装成功！')"
```

## 下一步

安装完成后，运行 `start.bat` 启动PDF转Word服务。

## 获取帮助

- Python官方文档：https://docs.python.org/zh-cn/3/
- Python中文社区：https://www.python.org/community/

