# PDF工具箱 - 微信小程序

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-green.svg)
![Flask](https://img.shields.io/badge/flask-3.0.0-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

一个功能强大的PDF处理工具微信小程序，提供PDF转换、编辑、水印、拼图等多种功能。

[功能特性](#功能特性) • [快速开始](#快速开始) • [部署文档](DEPLOYMENT.md) • [技术栈](#技术栈)

</div>

---

## 📋 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [功能演示](#功能演示)
- [API文档](#api文档)
- [开发指南](#开发指南)
- [部署说明](#部署说明)
- [常见问题](#常见问题)
- [更新日志](#更新日志)
- [许可证](#许可证)

---

## ✨ 功能特性

### 核心功能

#### 📄 PDF 转换
- **PDF转图片**：支持单页/全部转换，可选PNG/JPG格式
- **图片转PDF**：支持单张/批量转换，自动适配页面大小

#### 🔧 PDF 编辑
- **PDF合并**：将多个PDF文件合并为一个
- **PDF拆分**：按页码范围拆分PDF文件
- **PDF裁剪**：自定义裁剪边距（上下左右）

#### 🎨 PDF 美化
- **添加水印**：
  - 文字水印（支持单点/平铺模式）
  - 自定义颜色、透明度、旋转角度
  - 6种位置选择（居中/四角/自定义）
- **添加密码**：
  - 打开密码（限制PDF打开）
  - 编辑密码（限制PDF编辑）
- **添加页码**：
  - 多种位置选择（顶部/底部/页脚）
  - 自定义样式和颜色

#### 🧹 PDF 处理
- **去除水印**：
  - 自动识别模式（智能检测水印）
  - 文本匹配模式（精确匹配文字）
  - 区域覆盖模式（指定位置覆盖）
- **转黑白**：
  - 完全黑白（转为灰度）
  - 仅去除彩色（保留黑白内容）

#### 🖼️ 图片拼图
- **多种布局**：支持6种预设布局（1x1、1x2、1x3、2x1、2x2、2x3）
- **图片描述**：每张图片可添加最多15字的描述
- **导出格式**：支持导出为JPG图片或PDF文件
- **高质量输出**：A4尺寸，300dpi高清输出

#### 📊 转换记录
- **本地存储**：转换记录存储在本地，保护隐私
- **自动清理**：24小时后自动删除过期记录
- **批量操作**：支持批量下载/删除记录
- **重新下载**：可随时重新下载已处理的文件

---

## 🛠 技术栈

### 后端
- **Python 3.8+**
- **Flask 3.0.0** - Web框架
- **PyMuPDF (fitz)** - PDF处理核心库
- **Pillow** - 图像处理
- **Flask-CORS** - 跨域支持

### 前端
- **微信小程序** - WXML/WXSS/JavaScript
- **WeChat API** - 文件上传/下载/预览
- **本地存储** - 转换记录管理

---

## 📁 项目结构

```
PDFTool/
├── server-python/              # Python后端服务
│   ├── app.py                 # Flask主应用
│   ├── requirements.txt       # Python依赖
│   └── uploads/               # 临时文件存储目录
│
├── pdf-to-png-converter/      # 微信小程序前端
│   └── miniprogram/
│       ├── pages/             # 页面目录
│       │   ├── home/          # 首页
│       │   ├── pdf-to-image/  # PDF转图片
│       │   ├── image-to-pdf/  # 图片转PDF
│       │   ├── combine/       # PDF合并
│       │   ├── split/         # PDF拆分
│       │   ├── watermark/     # 添加水印/密码
│       │   ├── remove-watermark/ # 去除水印
│       │   ├── pagenumber/    # 添加页码
│       │   ├── collage/       # 图片拼图
│       │   ├── grayscale/     # 转黑白
│       │   ├── crop/          # PDF裁剪
│       │   └── records/       # 转换记录
│       ├── utils/             # 工具函数
│       │   └── records.js     # 记录管理
│       ├── custom-tab-bar/    # 自定义导航栏
│       ├── images/            # 图片资源
│       ├── app.js             # 小程序入口
│       ├── app.json           # 小程序配置
│       └── app.wxss           # 全局样式
│
├── DEPLOYMENT.md              # 部署文档
└── README.md                  # 项目文档
```

---

## 🚀 快速开始

### 前置要求

- Python 3.8 或更高版本
- 微信开发者工具
- Git（可选）

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/PDFTool.git
cd PDFTool
```

### 2. 启动后端服务

```bash
# 安装依赖
cd server-python
pip install -r requirements.txt

# 启动服务
python app.py
```

后端服务将在 `http://localhost:8789` 运行。

### 3. 启动前端小程序

1. 打开**微信开发者工具**
2. 导入项目：`PDFTool/pdf-to-png-converter/miniprogram`
3. 填写 AppID（测试可使用测试号）
4. 点击**编译**运行

### 4. 开始使用

在模拟器或真机上体验各项功能！

---

## 📸 功能演示

### 主页功能菜单
```
┌─────────────────────────────────────┐
│  PDF工具箱                           │
├─────────────────────────────────────┤
│  📄 PDF转图片    🖼️  图片转PDF      │
│  📚 PDF合并      ✂️  PDF拆分        │
│  💧 添加水印     🧹 去除水印         │
│  🔢 添加页码     🔐 添加密码         │
│  🖼️  图片拼图    ⚫ 转黑白          │
│  ✂️  PDF裁剪     📊 转换记录        │
└─────────────────────────────────────┘
```

### 转换记录管理
- ✅ 查看所有转换历史
- ✅ 批量选择操作
- ✅ 重新下载文件
- ✅ 删除记录
- ✅ 自动清理过期记录

---

## 📚 API文档

### 后端API端点

#### PDF转图片
```
POST /pdf/to-image
Content-Type: multipart/form-data

参数:
- file: PDF文件
- page_num: 页码（可选，-1表示全部）
- format: 输出格式（png/jpg，默认png）

返回:
{
  "success": true,
  "images": ["url1", "url2", ...],
  "message": "转换成功"
}
```

#### 图片转PDF
```
POST /image/to-pdf
Content-Type: multipart/form-data

参数:
- files[]: 图片文件数组

返回:
{
  "success": true,
  "url": "/download/output.pdf",
  "message": "转换成功"
}
```

#### 添加水印
```
POST /pdf/watermark-password
Content-Type: multipart/form-data

参数:
- file: PDF文件
- watermark_text: 水印文字
- watermark_color: 颜色（十六进制）
- opacity: 透明度（0-100）
- rotation: 旋转角度（0-360）
- position: 位置（center/top_left/...）
- mode: 模式（single/tile）
- password_open: 打开密码（可选）
- password_edit: 编辑密码（可选）

返回:
{
  "success": true,
  "url": "/download/output.pdf",
  "message": "处理成功"
}
```

#### 去除水印
```
POST /pdf/remove-watermark
Content-Type: multipart/form-data

参数:
- file: PDF文件
- remove_mode: 模式（auto/text/area）
- watermark_text: 文字（text模式）
- area_x: X坐标（area模式，百分比）
- area_y: Y坐标（area模式，百分比）
- area_width: 宽度（area模式，百分比）
- area_height: 高度（area模式，百分比）

返回:
{
  "success": true,
  "url": "/download/output.pdf",
  "message": "去除成功"
}
```

> 更多API文档请参考 `server-python/app.py` 中的注释

---

## 💻 开发指南

### 添加新功能

#### 1. 后端添加API

在 `server-python/app.py` 中添加新的路由：

```python
@app.route('/your/new-endpoint', methods=['POST'])
def your_new_function():
    try:
        # 处理逻辑
        return jsonify({
            'success': True,
            'message': '处理成功'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

#### 2. 前端创建页面

1. 在 `miniprogram/pages/` 创建新目录
2. 创建4个文件：`index.js`, `index.wxml`, `index.wxss`, `index.json`
3. 在 `app.json` 中注册页面

#### 3. 添加到主页

在 `pages/home/index.wxml` 和 `index.js` 中添加菜单项。

### 代码规范

- **Python**: 遵循 PEP 8
- **JavaScript**: 使用 ES6+ 语法
- **注释**: 关键函数必须添加注释
- **错误处理**: 所有API必须包含try-catch

### 测试

```bash
# 后端单元测试
cd server-python
python -m pytest tests/

# 前端测试
# 在微信开发者工具中进行手动测试
```

---

## 🚢 部署说明

详细的部署文档请查看 [DEPLOYMENT.md](DEPLOYMENT.md)

### 快速部署

#### 开发环境
```bash
# 后端
cd server-python && python app.py

# 前端
# 使用微信开发者工具打开 miniprogram 目录
```

#### 生产环境
```bash
# 使用 Gunicorn 运行后端
cd server-python
gunicorn -w 4 -b 0.0.0.0:8789 app:app

# 配置 Nginx 反向代理（可选）
# 配置 SSL 证书
# 上传小程序代码到微信平台
```

---

## ❓ 常见问题

### Q1: 上传大文件失败
**A**: 调整后端 `MAX_CONTENT_LENGTH` 配置和 Nginx 的 `client_max_body_size`。

### Q2: 文件下载失败
**A**: 确保小程序的 `downloadFile` 域名在白名单中，开发时可勾选"不校验合法域名"。

### Q3: 水印不显示
**A**: 检查透明度设置，确保不是100%透明。

### Q4: 转换记录不显示
**A**: 清除小程序缓存，检查本地存储是否开启。

### Q5: 后端服务无法访问
**A**: 检查防火墙设置，确保端口8789已开放。

更多问题请查看 [DEPLOYMENT.md](DEPLOYMENT.md) 的"常见问题"章节。

---

## 📝 更新日志

### v1.0.0 (2025-12-12)
- ✨ 初始版本发布
- ✅ PDF转图片功能
- ✅ 图片转PDF功能
- ✅ PDF合并/拆分功能
- ✅ 水印添加/去除功能
- ✅ 页码添加功能
- ✅ 图片拼图功能
- ✅ PDF转黑白功能
- ✅ PDF裁剪功能
- ✅ 转换记录管理功能

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 👥 作者

- **开发者**: [您的名字]
- **邮箱**: [您的邮箱]
- **GitHub**: [您的GitHub]

---

## 🙏 致谢

- [PyMuPDF](https://github.com/pymupdf/PyMuPDF) - 强大的PDF处理库
- [Flask](https://flask.palletsprojects.com/) - 优雅的Python Web框架
- [Pillow](https://python-pillow.org/) - Python图像处理库
- [微信小程序](https://developers.weixin.qq.com/miniprogram/dev/framework/) - 小程序开发框架

---

<div align="center">

**如果这个项目对您有帮助，请给一个 ⭐️ Star！**

Made with ❤️ by [您的名字]

</div>
