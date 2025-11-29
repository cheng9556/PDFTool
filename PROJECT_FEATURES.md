# PDFTool 项目功能清单

## 📋 项目概述

PDFTool 是一个全能的PDF转换和处理工具集，包含：
- **Python后端服务** (Flask, 端口8789)
- **Java后端服务** (Spring Boot, 端口8788)
- **微信小程序前端** (Weixin MiniProgram)

---

## 🎯 已实现功能清单

### 一、PDF转换功能

#### 1. PDF → Word
- **接口**: `POST /pdf/toword`
- **功能**: PDF转Word文档
- **特性**:
  - 支持多种转换模式（ultra-fast, fast, balanced, quality）
  - 支持页码选择（单页/多页/范围）
  - 支持图片提取
  - 高性能优化（Windows单进程模式）
- **使用库**: `pdf2docx`, `PyMuPDF`

#### 2. PDF → Excel
- **接口**: `POST /pdf/toexcel` (Node.js服务)
- **功能**: PDF表格提取转Excel
- **特性**: 智能表格识别和提取
- **使用库**: `pdf-lib`, `exceljs`

#### 3. PDF → PPT
- **接口**: `POST /pdf/to-ppt`
- **功能**: PDF转PowerPoint演示文稿
- **特性**:
  - 高质量图片转换（200 DPI, 92%质量）
  - 每页转换为一张幻灯片
  - 可调节DPI和质量参数
- **使用库**: `PyMuPDF`, `python-pptx`

#### 4. PDF → 图片
- **接口**: `POST /pdf/to-images`
- **功能**: PDF转PNG图片
- **特性**:
  - 批量转换，单页/全部页提取
  - 支持DPI设置
  - 返回图片列表
- **使用库**: `PyMuPDF`, `PIL`

#### 5. Word → PDF
- **接口**: `POST /word/topdf` (Java服务)
- **功能**: Word文档转PDF
- **特性**: 使用LibreOffice转换
- **使用库**: `JodConverter`, `LibreOffice`

#### 6. Excel → PDF
- **接口**: `POST /excel/topdf` (Java服务)
- **功能**: Excel表格转PDF
- **特性**: 高质量表格转换
- **使用库**: `JodConverter`, `LibreOffice`

#### 7. PPT → PDF
- **接口**: `POST /ppt/topdf` (Java服务)
- **功能**: PowerPoint转PDF
- **特性**:
  - 超高性能转换（70+ KB/秒）
  - 300 DPI输出分辨率
  - 智能超时和自动重试
- **使用库**: `JodConverter`, `LibreOffice`

#### 8. 文字 → PDF
- **接口**: `POST /text/to-pdf`
- **功能**: 纯文本转PDF
- **特性**: 支持自定义字体、字号、颜色
- **使用库**: `PyMuPDF`

---

### 二、PDF编辑功能

#### 9. PDF页面旋转
- **接口**: `POST /pdf/rotate`
- **功能**: PDF页面旋转
- **特性**:
  - 支持0°/90°/180°/270°顺时针旋转
  - 支持单页/多页/批量旋转
  - 支持不同页面不同角度
  - 自动处理页面尺寸
- **使用库**: `PyMuPDF`

#### 10. PDF压缩
- **接口**: `POST /pdf/compress`
- **功能**: PDF文件压缩
- **特性**:
  - 三种压缩级别（低~20%/中~50%/高~80%）
  - 图片压缩和优化
  - PNG转JPEG
  - DPI优化
- **使用库**: `PyMuPDF`, `PIL`

#### 11. PDF合并
- **接口**: `POST /pdf/merge`
- **功能**: 多个PDF文件合并
- **特性**:
  - 支持多文件上传
  - 按顺序合并
  - 高性能处理
- **使用库**: `PyMuPDF`

#### 12. PDF拆分
- **接口**: `POST /pdf/split`
- **功能**: PDF文件拆分
- **特性**:
  - 按页码拆分
  - 单页或多页拆分
- **使用库**: `PyMuPDF`

#### 13. PDF页面管理（增删页/排序）
- **接口**: `POST /pdf/manage-pages`
- **功能**: PDF页面增删和重排序
- **特性**:
  - 删除指定页面
  - 页面重排序
  - 插入图片到PDF
- **使用库**: `PyMuPDF`, `PIL`

#### 14. PDF页面编排
- **接口**: 
  - `POST /pdf/arrange/upload` - 上传PDF文件
  - `POST /pdf/arrange/generate` - 生成编排后的PDF
- **功能**: 多PDF文件页面自由编排
- **特性**:
  - 支持多文件上传
  - 页面选择和管理
  - 自定义页面顺序
  - 上下移动调整顺序
- **使用库**: `PyMuPDF`

---

### 三、PDF提取功能

#### 15. PDF文本提取
- **接口**: `POST /pdf/extract/text`
- **功能**: 提取PDF文本内容
- **特性**: 支持全文提取
- **使用库**: `PyMuPDF`

#### 16. PDF页面图片提取
- **接口**: `POST /pdf/extract/page-image`
- **功能**: 提取PDF页面为图片
- **特性**: 单页提取
- **使用库**: `PyMuPDF`

#### 17. PDF内嵌图片提取
- **接口**: `POST /pdf/extract/embedded-images`
- **功能**: 提取PDF中的内嵌图片
- **特性**: 批量提取所有图片
- **使用库**: `PyMuPDF`

---

### 四、图片处理功能

#### 18. 图片转PDF
- **接口**: `POST /img2pdf/commit` (Node.js服务)
- **功能**: 多张图片合并为PDF
- **特性**:
  - 支持PNG/JPG格式
  - 多图合并
  - 自动适配尺寸
- **使用库**: `pdf-lib`

---

### 五、辅助功能

#### 19. PDF信息获取
- **接口**: `POST /pdf/info`
- **功能**: 获取PDF基本信息
- **特性**: 页数、尺寸等
- **使用库**: `PyMuPDF`

#### 20. PDF预览图生成
- **接口**: `POST /pdf/preview`
- **功能**: 生成PDF预览缩略图
- **特性**: 用于前端展示
- **使用库**: `PyMuPDF`

#### 21. PDF页面预览
- **接口**: `POST /pdf/get-pages`
- **功能**: 获取所有页面缩略图
- **特性**: 用于页面选择界面
- **使用库**: `PyMuPDF`

#### 22. 文件下载
- **接口**: `GET /download/<filename>`
- **功能**: 下载转换后的文件
- **特性**: 支持多种文件类型（PDF/Word/Excel等）

---

## 🛠️ 使用的工具和库

### Python后端 (server-python)

#### 核心框架
- **Flask** - Web框架
- **flask-cors** - 跨域支持

#### PDF处理
- **PyMuPDF (fitz)** - PDF处理核心库
  - PDF读取/写入
  - 页面操作（旋转、合并、拆分）
  - 图片提取和渲染
  - 文本提取
  - 高质量图片生成

#### 文档转换
- **pdf2docx** - PDF转Word
- **python-pptx** - PowerPoint操作
- **python-docx** - Word文档操作

#### 图片处理
- **Pillow (PIL)** - 图片处理
  - 图片压缩
  - 格式转换
  - 图片拼接
  - 尺寸调整

#### 其他工具
- **uuid** - 唯一ID生成
- **base64** - 编码/解码
- **io** - 内存流处理
- **logging** - 日志记录
- **datetime** - 时间处理

---

### Java后端 (server-java)

#### 核心框架
- **Spring Boot 2.7.18** - Web框架
- **Spring Web** - RESTful API

#### 文档转换
- **JodConverter 4.4.11** - 文档格式转换
  - Word/Excel/PPT ↔ PDF
  - 基于LibreOffice
- **LibreOffice** - 文档处理引擎（外部依赖）

#### PDF处理
- **Apache PDFBox 2.0.29** - PDF生成和处理

#### Office文档处理
- **Apache POI 5.2.5** - Excel/PPT处理
  - poi-ooxml - Excel/PPT读写
  - poi-scratchpad - PPT支持

#### 表格提取
- **Tabula 1.0.5** - PDF表格提取

#### 图形处理
- **Apache Batik 1.17** - SVG渲染（PPT形状）

---

### Node.js服务 (pdf-to-png-converter/server)

#### 核心框架
- **Express** - Web框架
- **multer** - 文件上传

#### PDF处理
- **pdf-lib** - PDF操作
- **pdfjs-dist** - PDF.js（PDF渲染）

#### Excel处理
- **exceljs** - Excel文件操作

#### 图片处理
- **canvas** - Canvas绘图（Node.js）
- **pdf-to-png** - PDF转PNG

---

### 微信小程序前端

#### 核心框架
- **微信小程序框架** - 原生小程序开发

#### UI组件
- 自定义组件
- 渐变UI设计

#### 功能特性
- 文件选择（`wx.chooseMessageFile`）
- 文件上传（`wx.uploadFile`）
- 文件下载（`wx.downloadFile`）
- 文档预览（`wx.openDocument`）

---

## 📊 功能统计

### 按类别统计
- **PDF转换**: 8个功能
- **PDF编辑**: 6个功能
- **PDF提取**: 3个功能
- **图片处理**: 1个功能
- **辅助功能**: 3个功能

### 总计
- **21个核心功能**
- **3个后端服务** (Python/Java/Node.js)
- **1个前端应用** (微信小程序)

---

## 🚀 性能特性

### 优化措施
1. **Windows单进程模式** - 避免多进程死锁
2. **智能超时机制** - 根据文件大小动态调整
3. **自动重试机制** - 最多3次，指数退避
4. **文件缓存** - 减少重复打开
5. **批量处理** - 提高处理效率

### 性能指标
- **PPT转PDF**: 70+ KB/秒，300 DPI
- **PDF转PPT**: 5页/秒，200 DPI
- **PDF压缩**: 支持大文件（100MB）
- **PDF旋转**: 高性能批量处理

---

## 📝 备注

### 待实现功能（前端已预留）
- PDF转长图
- 转黑白
- 添加密码
- 去水印
- 加水印

### 技术限制
- 微信小程序不支持原生拖拽排序（已用上下移动按钮替代）
- LibreOffice需要单独安装（Java服务）
- 部分功能需要外部依赖

---

**最后更新**: 2025-11-29

