# 发布清单

## ✅ 已完成的准备工作

- [x] 删除所有 console.log 调试代码
- [x] 删除测试数据文件 (data.json)
- [x] 创建 .gitignore 文件
- [x] 验证 versions.json 文件
- [x] 更新 README.md
- [x] 最终构建测试通过

## 📝 需要你手动完成的步骤

### 1. 更新 manifest.json 中的作者信息

打开 `manifest.json`，修改以下字段：

```json
{
  "author": "你的名字",
  "authorUrl": "https://github.com/你的用户名",
  "fundingUrl": "你的赞助链接（可选，如果不需要可以删除）"
}
```

### 2. 创建 GitHub 仓库

1. 访问 https://github.com/new
2. 仓库名建议: `obsidian-pinned-items`
3. 设置为 Public
4. 不要初始化 README (我们已经有了)

### 3. 推送代码到 GitHub

```bash
cd "/Users/yeyan1996/Library/Mobile Documents/iCloud~md~obsidian/Documents/面试面试面试/.obsidian/plugins/obsidian-sample-plugin"

# 初始化 git
git init
git add .
git commit -m "Initial commit: Pinned Items Plugin v1.0.0"

# 连接到你的 GitHub 仓库（替换为你的用户名）
git remote add origin https://github.com/你的用户名/obsidian-pinned-items.git
git branch -M main
git push -u origin main
```

### 4. 创建 GitHub Release

1. 在 GitHub 仓库页面，点击 **"Releases"** → **"Create a new release"**
2. **Tag version**: 输入 `1.0.0` (注意：不要加 v 前缀！)
3. **Release title**: `1.0.0`
4. **Description**: 复制以下内容

```markdown
# Pinned Items Plugin v1.0.0

首次发布！一个简单但强大的插件，让你可以将重要文件和文件夹固定在文件浏览器顶部。

## ✨ 功能特性

- 📌 右键菜单固定/取消固定文件和文件夹
- ⚡ 快速访问常用文件
- 🎯 支持 iOS 和 Android 单击操作
- 🎨 简洁紧凑的界面设计
- 💾 自动保存固定状态
- 🔄 轻松管理固定项

## 🎯 使用方法

1. 在文件浏览器中右键点击任何文件或文件夹
2. 选择 "📌 Pin to top"
3. 固定项将出现在文件浏览器顶部

## 📱 跨平台支持

- Windows、macOS、Linux
- iOS、Android
```

5. **Upload assets**: 拖拽以下 3 个文件
   - `main.js`
   - `manifest.json`
   - `styles.css`

6. 点击 **"Publish release"**

### 5. （可选）提交到 Obsidian 社区插件

如果你想让插件出现在 Obsidian 的社区插件列表中：

1. Fork 这个仓库: https://github.com/obsidianmd/obsidian-releases
2. 编辑 `community-plugins.json`，在最后添加：

```json
{
  "id": "pinned-items-plugin",
  "name": "Pinned Items",
  "author": "你的名字",
  "description": "Pin files and folders to the top of your file explorer for quick access.",
  "repo": "你的用户名/obsidian-pinned-items"
}
```

3. 创建 Pull Request
4. 等待 Obsidian 团队审核（通常需要几天到几周）

## 📦 发布文件清单

确保以下文件在发布中：

- [x] `main.js` (构建产物)
- [x] `manifest.json` 
- [x] `styles.css`
- [x] `README.md` (在仓库中)
- [x] `versions.json` (在仓库中)
- [x] `LICENSE` (建议添加，如果还没有)

## 🎉 完成！

完成以上步骤后，你的插件就正式发布了！

用户可以通过以下方式安装：
1. 从你的 GitHub Release 页面手动下载
2. 如果提交到社区，从 Obsidian 的社区插件列表安装

## 📊 后续维护

当你需要发布新版本时：

1. 更新代码
2. 修改 `manifest.json` 中的 `version`
3. 更新 `versions.json` 添加新版本
4. 运行 `npm run build`
5. 创建新的 GitHub Release
6. 上传新的 `main.js`, `manifest.json`, `styles.css`

