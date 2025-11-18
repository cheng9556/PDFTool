# Excel转PDF服务 (JodConverter + LibreOffice)

基于Spring Boot + JodConverter的高质量Excel转PDF服务。

## 🎯 特点

- ✅ **高质量转换**: 使用LibreOffice引擎，完美保留Excel格式
- ✅ **支持复杂样式**: 自动处理公式、图表、条件格式等
- ✅ **文件体积小**: 相比Canvas渲染，文件更小更优化
- ✅ **简单易用**: 仅需安装LibreOffice，无需复杂配置
- ✅ **微信小程序集成**: 与现有小程序无缝对接

## 📋 前置要求

### 1. 安装Java 11+

```bash
java -version
```

### 2. 安装Maven

```bash
mvn -version
```

### 3. 安装LibreOffice

#### Windows
- 下载: https://www.libreoffice.org/download/download/
- 默认安装到: `C:\Program Files\LibreOffice`

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libreoffice
```

#### macOS
```bash
brew install --cask libreoffice
```

### 4. 配置LibreOffice路径

编辑 `src/main/resources/application.yml`:

```yaml
jodconverter:
  local:
    office-home: C:/Program Files/LibreOffice  # 修改为实际安装路径
```

## 🚀 快速开始

### 1. 启动服务

```bash
cd server-java
mvn spring-boot:run
```

服务将在 **http://localhost:8788** 启动。

### 2. 测试转换

```bash
curl -X POST http://localhost:8788/excel/topdf \
  -F "file=@test.xlsx"
```

响应:
```json
{
  "url": "/download/xxx.pdf"
}
```

### 3. 下载PDF

```bash
curl http://localhost:8788/download/xxx.pdf -o result.pdf
```

## 📡 API文档

### POST /excel/topdf

上传Excel文件并转换为PDF。

**请求:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file` (Excel文件)

**响应 (成功):**
```json
{
  "url": "/download/xxx.pdf"
}
```

**响应 (失败):**
```json
{
  "error": "错误信息"
}
```

### GET /download/{filename}

下载已转换的PDF文件。

**请求:**
- Method: `GET`
- Path: `/download/{filename}`

**响应:**
- Content-Type: `application/pdf`
- Body: PDF文件内容

### GET /health

健康检查。

**响应:**
```json
{
  "status": "UP",
  "service": "Excel to PDF Converter (JodConverter)"
}
```

## 🔗 微信小程序集成

### 配置说明

微信小程序的 `pages/excel2pdf/index.js` 已配置为使用Java后台：

```javascript
const SERVER_URL = 'http://localhost:8788'; // Java后台
```

### 注意事项

1. **其他页面保持不变**: PDF转Excel等其他功能仍使用Node.js后台(8787端口)
2. **同时运行两个服务**: 
   - Java服务: `localhost:8788` (Excel转PDF)
   - Node.js服务: `localhost:8787` (其他功能)

## 📁 项目结构

```
server-java/
├── pom.xml                                    # Maven依赖
├── src/main/
│   ├── java/com/pdftool/
│   │   ├── ExcelToPdfApplication.java        # 主入口
│   │   ├── config/
│   │   │   └── JodConverterConfig.java       # JodConverter配置
│   │   ├── controller/
│   │   │   └── ExcelToPdfController.java     # REST API
│   │   └── service/
│   │       └── ConversionService.java        # 转换服务
│   └── resources/
│       └── application.yml                    # 应用配置
├── temp/                                      # 临时PDF文件
└── README.md
```

## ⚙️ 配置参数

编辑 `application.yml`:

```yaml
server:
  port: 8788  # 服务端口

jodconverter:
  local:
    office-home: C:/Program Files/LibreOffice  # LibreOffice路径
    port-numbers: 2002                         # LibreOffice监听端口
    max-tasks-per-process: 100                 # 最大任务数
    task-execution-timeout: 120000             # 超时时间(毫秒)
```

## 🐛 常见问题

### 1. 找不到LibreOffice

**错误:** `Cannot find office home`

**解决:**
- 确认LibreOffice已安装
- 检查 `application.yml` 中的 `office-home` 路径
- Windows路径使用正斜杠: `C:/Program Files/LibreOffice`

### 2. 端口被占用

**错误:** `Port 2002 already in use`

**解决:**
```bash
# Windows
taskkill /F /IM soffice.bin

# Linux/macOS
pkill -9 soffice.bin
```

或修改 `application.yml` 中的 `port-numbers`。

### 3. 转换超时

**解决:**
- 增加 `task-execution-timeout` 值
- 检查Excel文件大小和复杂度
- 查看LibreOffice进程是否正常

### 4. 中文显示问题

LibreOffice会自动处理中文，无需额外配置。

## 🆚 与Node.js版本对比

| 特性 | Node.js (Canvas) | Java (JodConverter) |
|------|------------------|---------------------|
| 转换质量 | 自定义渲染 | LibreOffice原生 ✓ |
| 文件大小 | 较大 (150-800KB) | 较小 ✓ |
| 复杂格式 | 需自行实现 | 原生支持 ✓ |
| 公式/图表 | 不支持 | 完全支持 ✓ |
| 维护成本 | 高 | 低 ✓ |
| 部署依赖 | Node.js + Canvas | Java + LibreOffice |
| 启动速度 | 快 | 中等 |

## 📝 许可证

MIT License


