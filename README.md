# PDFTool - 全能PDF转换工具

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Java](https://img.shields.io/badge/Java-11+-orange.svg)](https://www.oracle.com/java/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-2.7.18-brightgreen.svg)](https://spring.io/projects/spring-boot)

一个功能强大的PDF转换工具集，支持PDF、PPT、Excel、图片等多种格式互转。包含微信小程序前端和高性能后端服务。

---

## ✨ 核心功能

### 📄 PDF转换
- **PDF → PPT**: 高清图片转换（200 DPI, 92%质量）
- **PPT → PDF**: 超高性能转换，智能超时、自动重试
- **PDF → Excel**: 智能表格识别和提取
- **Excel → PDF**: 高质量表格转换
- **Word → PDF**: 文档格式转换
- **PDF → Word**: 智能文档还原

### 🖼️ 图片处理
- **PDF → PNG**: 批量转换，单页/全部页提取
- **图片 → PDF**: 多图合并，支持压缩和优化

### 📱 微信小程序
- 现代化渐变UI设计
- 实时转换进度
- 文件大小和页数限制（60MB/100页）
- 在线预览和下载

---

## 🚀 快速开始

### 1. 启动Java服务（端口8788）
```bash
cd server-java
mvn spring-boot:run
```

### 2. 启动Python服务（端口8789）
```bash
cd server-python
pip install -r requirements.txt
python app_optimized.py
```

### 3. 配置LibreOffice（PPT/Word转换需要）
```properties
# server-java/src/main/resources/application.properties
jodconverter.local.office-home=C:/Program Files/LibreOffice
```

### 4. 启动微信小程序
用微信开发者工具打开 `pdf-to-png-converter` 目录

---

## 📊 性能特性

### PPT转PDF优化
- ✅ 转换速度：70+ KB/秒
- ✅ 输出分辨率：300 DPI
- ✅ 智能超时：根据文件大小动态调整
- ✅ 自动重试：最多3次，指数退避
- ✅ 成功率提升：+20-30%

### PDF转PPT优化
- ✅ 图片DPI：200（可调至400）
- ✅ JPEG质量：92%（可调至100%）
- ✅ 转换速度：5页/秒
- ✅ 质量提升：+33.3%

---

## 📁 项目结构

```
PDFTool/
├── server-java/              # Java后端（Spring Boot）
├── server-python/            # Python后端（Flask）
├── pdf-to-png-converter/     # 微信小程序
├── README.md                 # 项目说明
├── LICENSE                   # MIT许可证
└── .gitignore               # Git忽略规则
```

---

## 🎯 API文档

### Java服务（8788端口）

#### PPT转PDF
```bash
POST http://localhost:8788/ppt/topdf
Content-Type: multipart/form-data
参数: file (PPT文件)
```

### Python服务（8789端口）

#### PDF转PPT
```bash
POST http://localhost:8789/pdf/to-ppt
Content-Type: multipart/form-data
参数: file (PDF文件), dpi (默认200), quality (默认92)
```

---

## 📝 文档

- [PPT转PDF优化报告](PPT-TO-PDF-OPTIMIZATION.md)
- [PDF转PPT质量优化](PDF-TO-PPT-QUALITY-OPTIMIZATION.md)
- [GitHub上传指南](GITHUB-UPLOAD-GUIDE.md)
- [推送问题修复](GITHUB-PUSH-FIX.md)

---

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

## 📜 许可证

MIT License

---

## 🙏 致谢

- Apache PDFBox
- PyMuPDF
- JodConverter
- LibreOffice
- python-pptx

---

**⭐ 如果这个项目对您有帮助，请给个Star！**
