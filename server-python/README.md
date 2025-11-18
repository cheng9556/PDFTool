# PDF转Word服务 (Python)

基于 `pdf2docx` 库的高质量PDF转Word转换服务。

## 📋 功能特性

- ✅ PDF转Word (DOCX格式)
- ✅ 保留文本格式和样式
- ✅ 支持表格转换
- ✅ 支持图片提取
- ✅ 支持多页文档
- ✅ RESTful API接口
- ✅ 跨域支持 (CORS)
- ✅ 自动清理临时文件

## 🚀 快速开始

### 前置要求

- Python 3.8 或更高版本
- pip (Python包管理器)

### Windows 启动

```bash
# 双击运行或命令行执行
start.bat
```

### Linux/Mac 启动

```bash
# 赋予执行权限
chmod +x start.sh

# 启动服务
./start.sh
```

### 手动启动

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py
```

服务将运行在: **http://localhost:8789**

## 📡 API 接口

### 1. 健康检查

**GET** `/health`

**响应示例：**
```json
{
  "status": "UP",
  "service": "PDF to Word Converter (pdf2docx)",
  "version": "1.0.0"
}
```

### 2. PDF转Word

**POST** `/pdf/toword`

**请求：**
- Content-Type: `multipart/form-data`
- 参数: `file` (PDF文件)

**响应示例：**
```json
{
  "url": "/download/abc123_document.docx",
  "filename": "abc123_document.docx",
  "size": 524288,
  "conversion_time": "2.35s"
}
```

### 3. 下载文件

**GET** `/download/{filename}`

**响应：** Word文档文件流

## 🧪 测试

### PowerShell测试脚本

```powershell
# 使用默认PDF文件测试
.\test-api.ps1

# 指定PDF文件测试
.\test-api.ps1 -PdfFile "C:\path\to\your\file.pdf"
```

### cURL测试

```bash
# 健康检查
curl http://localhost:8789/health

# PDF转Word
curl -X POST http://localhost:8789/pdf/toword \
  -F "file=@test.pdf" \
  -o response.json

# 下载转换后的文件
curl http://localhost:8789/download/filename.docx -o output.docx
```

### Python测试脚本

```python
import requests

# 上传PDF文件
with open('test.pdf', 'rb') as f:
    files = {'file': f}
    response = requests.post('http://localhost:8789/pdf/toword', files=files)
    result = response.json()
    print(f"转换成功: {result['url']}")

# 下载Word文件
download_url = f"http://localhost:8789{result['url']}"
word_response = requests.get(download_url)
with open('output.docx', 'wb') as f:
    f.write(word_response.content)
```

## 📁 项目结构

```
server-python/
├── app.py              # Flask应用主文件
├── requirements.txt    # Python依赖
├── start.bat          # Windows启动脚本
├── start.sh           # Linux/Mac启动脚本
├── test-api.ps1       # API测试脚本
├── README.md          # 项目文档
├── .gitignore         # Git忽略配置
├── temp/              # 临时文件目录
│   ├── uploads/       # 上传的PDF文件
│   └── converted/     # 转换后的Word文件
└── venv/              # Python虚拟环境 (自动创建)
```

## ⚙️ 配置说明

在 `app.py` 中可以修改以下配置：

```python
PORT = 8789                           # 服务端口
MAX_FILE_SIZE = 50 * 1024 * 1024     # 最大文件大小 (50MB)
UPLOAD_FOLDER = 'temp/uploads'        # 上传目录
CONVERTED_FOLDER = 'temp/converted'   # 转换目录
```

## 🔧 依赖说明

核心依赖：
- **Flask**: Web框架
- **Flask-CORS**: 跨域支持
- **pdf2docx**: PDF转Word核心库
- **python-docx**: Word文档处理
- **PyMuPDF**: PDF解析

## ⚠️ 注意事项

1. **文件大小限制**: 默认最大50MB，可在代码中修改
2. **转换质量**: 
   - 适合文本为主的PDF
   - 扫描版PDF需要OCR（此版本不支持）
   - 复杂布局可能需要手动调整
3. **临时文件**: 超过24小时的临时文件会自动清理
4. **性能**: 大文件转换可能需要较长时间

## 🐛 常见问题

### 1. 端口已被占用

修改 `app.py` 中的端口号：
```python
app.run(host='0.0.0.0', port=8790, debug=True)  # 改为其他端口
```

### 2. 依赖安装失败

尝试使用国内镜像：
```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 3. 转换质量不佳

pdf2docx对不同类型的PDF支持程度不同：
- ✅ 文本型PDF: 效果好
- ⚠️ 图文混排: 基本支持
- ❌ 扫描版PDF: 不支持（需要OCR）

## 📝 开发说明

### 添加新功能

在 `app.py` 中添加新的路由：

```python
@app.route('/new-endpoint', methods=['POST'])
def new_function():
    # 实现新功能
    pass
```

### 日志配置

修改日志级别：
```python
logging.basicConfig(level=logging.DEBUG)  # 更详细的日志
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

如有问题，请提交 Issue。
