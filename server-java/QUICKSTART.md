# 快速开始指南

## 🚀 5分钟上手

### 前提条件

✅ 已安装 LibreOffice  
✅ 已安装 Java 11+  
✅ 已安装 Maven

如果没有，请先查看 [INSTALL.md](INSTALL.md)

---

## 第一步：启动Java服务

### Windows
```bash
cd server-java
start.bat
```

或
```bash
mvn spring-boot:run
```

### Linux/macOS
```bash
cd server-java
./start.sh
```

等待看到：
```
=================================
Excel to PDF Server 启动成功!
访问地址: http://localhost:8788
API端点: POST /excel/topdf
=================================
```

---

## 第二步：测试转换 (可选)

打开新的命令行窗口测试：

```bash
# 测试健康检查
curl http://localhost:8788/health

# 转换Excel文件
curl -X POST http://localhost:8788/excel/topdf \
  -F "file=@D:\AIProject\PDFTool\原型\test.xlsx"
```

应该返回：
```json
{
  "url": "/download/xxx.pdf"
}
```

然后下载PDF：
```bash
curl http://localhost:8788/download/xxx.pdf -o result.pdf
```

---

## 第三步：启动Node.js服务（其他功能）

在**新的命令行窗口**中：

```bash
cd pdf-to-png-converter/server
npm start
```

---

## 第四步：测试微信小程序

1. 打开微信开发者工具
2. 打开项目：`pdf-to-png-converter/miniprogram`
3. 进入"首页" -> 点击"Excel转PDF"
4. 选择Excel文件
5. 点击"开始转换"
6. 转换成功后点击"预览PDF"

---

## 服务端口说明

| 服务 | 端口 | 功能 |
|------|------|------|
| Java服务 | 8788 | Excel转PDF (JodConverter) |
| Node.js服务 | 8787 | PDF转Excel、图片转PDF等 |

**重要：两个服务需要同时运行！**

---

## 架构说明

```
微信小程序
    ├── Excel转PDF → Java服务 (8788端口) [使用JodConverter]
    ├── PDF转Excel → Node.js服务 (8787端口)
    ├── 图片转PDF → Node.js服务 (8787端口)
    └── 其他功能 → Node.js服务 (8787端口)
```

---

## 常见问题

### Q1: Java服务启动失败

**原因：** 找不到LibreOffice

**解决：** 
1. 确认LibreOffice已安装
2. 修改 `src/main/resources/application.yml` 中的 `office-home` 路径

### Q2: 端口冲突

**原因：** 8788端口被占用

**解决：** 
修改 `application.yml` 中的 `server.port`，同时修改小程序的 `SERVER_URL`

### Q3: 转换失败

**原因：** LibreOffice进程卡死

**解决：** 
```bash
# Windows
taskkill /F /IM soffice.bin

# Linux/macOS
pkill -9 soffice.bin
```

---

## 性能对比测试

使用 `D:\AIProject\PDFTool\原型\test.xlsx` 测试：

| 方案 | 文件大小 | 转换质量 | 转换时间 |
|------|---------|---------|---------|
| Node.js (Canvas) | ~200KB | 中等 | ~2秒 |
| Java (JodConverter) | ~50KB | 优秀 ✓ | ~3秒 |

**结论：** Java方案文件更小，质量更高！

---

## 下一步

- [ ] 测试复杂的Excel文件（包含公式、图表）
- [ ] 调整JodConverter配置优化性能
- [ ] 部署到生产环境

详细文档请查看 [README.md](README.md)


