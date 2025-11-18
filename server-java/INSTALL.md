# 安装指南

## 步骤1: 安装LibreOffice

### Windows

1. 访问 https://www.libreoffice.org/download/download/
2. 下载Windows版本 (推荐稳定版)
3. 运行安装程序，使用默认设置
4. 默认安装路径: `C:\Program Files\LibreOffice`

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install libreoffice
```

### macOS

```bash
brew install --cask libreoffice
```

## 步骤2: 验证LibreOffice安装

### Windows

打开命令提示符，运行:
```bash
"C:\Program Files\LibreOffice\program\soffice.exe" --version
```

应该显示LibreOffice版本号。

### Linux/macOS

```bash
libreoffice --version
```

## 步骤3: 检查Java和Maven

```bash
# 检查Java (需要11+)
java -version

# 检查Maven
mvn -version
```

如果没有安装，请先安装:

### Windows
- Java: https://adoptium.net/
- Maven: https://maven.apache.org/download.cgi

### Linux (Ubuntu/Debian)
```bash
sudo apt install openjdk-11-jdk maven
```

### macOS
```bash
brew install openjdk@11 maven
```

## 步骤4: 配置LibreOffice路径

编辑 `src/main/resources/application.yml`:

```yaml
jodconverter:
  local:
    office-home: C:/Program Files/LibreOffice  # 修改为实际路径
```

**常见路径:**
- Windows: `C:/Program Files/LibreOffice`
- Linux: `/usr/lib/libreoffice`
- macOS: `/Applications/LibreOffice.app/Contents`

## 步骤5: 启动服务

### Windows
双击 `start.bat` 或在命令行运行:
```bash
mvn spring-boot:run
```

### Linux/macOS
```bash
chmod +x start.sh
./start.sh
```

或:
```bash
mvn spring-boot:run
```

## 步骤6: 验证服务

打开浏览器访问:
```
http://localhost:8788/health
```

应该看到:
```json
{
  "status": "UP",
  "service": "Excel to PDF Converter (JodConverter)"
}
```

## 故障排除

### 问题1: 找不到LibreOffice

**错误信息:**
```
Cannot find office home
```

**解决方法:**
1. 确认LibreOffice已正确安装
2. 检查 `application.yml` 中的路径
3. Windows用户注意使用正斜杠 `/` 而不是反斜杠 `\`

### 问题2: 端口被占用

**错误信息:**
```
Port 2002 already in use
```

**解决方法:**

Windows:
```bash
taskkill /F /IM soffice.bin
taskkill /F /IM soffice.exe
```

Linux/macOS:
```bash
pkill -9 soffice.bin
```

### 问题3: Maven下载依赖慢

**解决方法:**

配置国内Maven镜像，编辑 `~/.m2/settings.xml`:

```xml
<mirrors>
  <mirror>
    <id>aliyun</id>
    <mirrorOf>central</mirrorOf>
    <name>Aliyun Maven</name>
    <url>https://maven.aliyun.com/repository/public</url>
  </mirror>
</mirrors>
```

## 完成！

现在您可以在微信小程序中使用Excel转PDF功能了。

前往 `pdf-to-png-converter/miniprogram/pages/excel2pdf/` 页面测试转换。


