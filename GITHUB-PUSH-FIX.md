# 🔧 GitHub推送问题解决方案

## 📋 问题诊断

**错误信息**:
```
git@github.com: Permission denied (publickey).
fatal: Could not read from remote repository.
```

**原因**: 您的Git配置使用了SSH协议，但没有配置SSH密钥。

---

## ✅ 解决方案：切换到HTTPS（最简单）

### 步骤1️⃣：在IDE终端中执行

在您的IDE（VS Code/IntelliJ等）的终端中执行以下命令：

#### 1. 查看当前配置
```bash
git remote -v
```

应该显示类似：
```
origin  git@github.com:用户名/PDFTool.git (fetch)
origin  git@github.com:用户名/PDFTool.git (push)
```

#### 2. 移除SSH配置
```bash
git remote remove origin
```

#### 3. 添加HTTPS配置
**重要：请替换 `YOUR_USERNAME` 为您的实际GitHub用户名！**

```bash
git remote add origin https://github.com/YOUR_USERNAME/PDFTool.git
```

例如，如果您的GitHub用户名是 `zhangsan`：
```bash
git remote add origin https://github.com/zhangsan/PDFTool.git
```

#### 4. 验证配置
```bash
git remote -v
```

应该显示：
```
origin  https://github.com/YOUR_USERNAME/PDFTool.git (fetch)
origin  https://github.com/YOUR_USERNAME/PDFTool.git (push)
```

---

### 步骤2️⃣：推送到GitHub

#### 1. 推送代码
```bash
git push -u origin main
```

#### 2. 输入凭据

**会提示输入**：
- **Username**: 您的GitHub用户名
- **Password**: **使用Personal Access Token（不是GitHub密码）**

---

## 🔑 获取Personal Access Token

### 1. 访问GitHub Token页面
```
https://github.com/settings/tokens
```

### 2. 生成新Token
1. 点击：`Generate new token` → `Generate new token (classic)`
2. 填写：
   - **Note**: `PDFTool Upload Token`
   - **Expiration**: `90 days`
   - **Select scopes**: 勾选 `repo`（完整仓库权限）
3. 点击：`Generate token`

### 3. 复制Token
- **重要**: Token只显示一次，请立即复制！
- 格式类似：`ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 4. 使用Token
推送时，在Password提示处粘贴Token（不是您的GitHub密码）

---

## 💡 或者：使用Git Bash

如果IDE终端不工作，使用Git Bash：

### 1. 打开Git Bash
- 右键项目文件夹 → `Git Bash Here`
- 或从开始菜单打开Git Bash，然后：
  ```bash
  cd D:/AIProject/PDFTool
  ```

### 2. 执行上述命令
```bash
# 移除SSH远程仓库
git remote remove origin

# 添加HTTPS远程仓库（替换YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/PDFTool.git

# 推送
git push -u origin main
```

---

## 🎯 快速命令（复制粘贴）

**在您的IDE终端或Git Bash中执行**：

```bash
# 1. 移除SSH配置
git remote remove origin

# 2. 添加HTTPS配置（⚠️ 替换YOUR_USERNAME为您的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/PDFTool.git

# 3. 推送代码
git push -u origin main
```

---

## 🔐 方法二：配置SSH密钥（可选，适合高级用户）

如果您想继续使用SSH而不是HTTPS：

### 1. 生成SSH密钥
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### 2. 查看公钥
```bash
cat ~/.ssh/id_ed25519.pub
```

### 3. 添加到GitHub
1. 访问：https://github.com/settings/keys
2. 点击：`New SSH key`
3. 粘贴公钥内容
4. 点击：`Add SSH key`

### 4. 测试连接
```bash
ssh -T git@github.com
```

应该显示：
```
Hi username! You've successfully authenticated...
```

### 5. 推送
```bash
git push -u origin main
```

---

## ❓ 常见问题

### Q1: 推送时提示"Repository not found"
**A**: 检查远程仓库URL中的用户名是否正确，仓库是否已在GitHub上创建。

### Q2: Token认证失败
**A**: 
- 确保Token有`repo`权限
- Token没有过期
- 复制Token时没有多余空格

### Q3: 推送被拒绝（rejected）
**A**: 
```bash
git pull origin main --rebase
git push origin main
```

### Q4: 忘记保存Token
**A**: 
- 可以使用Git凭据管理器保存Token
- 或重新生成一个新Token

---

## ✅ 验证成功

推送成功后，访问您的GitHub仓库：
```
https://github.com/YOUR_USERNAME/PDFTool
```

应该能看到所有文件已上传！

---

## 📞 需要帮助？

如果遇到其他问题：
1. 检查网络连接
2. 确认GitHub账号和仓库存在
3. 确认Token权限正确
4. 使用Git Bash重试

---

**🎉 祝您上传成功！**

