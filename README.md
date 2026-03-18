# Markdown → 微信公众号转换工具

将 Markdown 文章一键转换为适合微信公众号编辑器粘贴的富文本，保留标题层级、代码高亮、表格、引用等完整排版。支持三套内置主题、自定义主题管理，以及从现有公众号文章自动提取排版风格。

提供两种使用方式：**独立网页**（无需安装）和 **MCP Server**（供 AI 智能体集成）。

---

## 独立网页使用

无需安装任何依赖，下载后直接用浏览器打开。

### 下载

```bash
git clone https://github.com/xuyinghan02-cell/markdown-transfer-weixin
```

或直接下载 `standalone.html` 单文件（包含所有依赖，离线可用）。

### 使用

1. 用浏览器打开 `standalone.html`
2. 在左侧输入 Markdown 内容
3. 右侧实时预览排版效果
4. 选择主题或自定义主题
5. 点击「复制富文本」
6. 切换到微信公众号编辑器，Ctrl+V 粘贴

### 内置主题

| 主题 | 适合场景 | 特点 |
|------|----------|------|
| 文艺清新（默认）| 人文内容 | 衬线字体，深红色调，左竖条标题 |
| 默认简洁 | 通用文章 | 绿色主色，清晰易读 |
| 科技感 | 技术教程 | 深色代码块，蓝色高亮 |

### 自定义主题

点击顶栏「**主题管理**」按钮可：

- **新建主题**：设置主色、正文色、字号、行高、字体，可选继承某个内置主题的排版结构；支持对 h1–h6、p、blockquote 等元素单独覆盖完整 CSS（JSON 格式）
- **从公众号文章提取**：粘贴任意公众号文章的 HTML 源码（浏览器 `Ctrl+U` 查看源码），自动解析内联样式生成匹配主题，再手动微调后保存
- **导入 / 导出**：以 JSON 文件分享或备份主题
- 自定义主题持久化保存在浏览器 localStorage

#### 从公众号提取主题步骤

1. 在浏览器打开你的历史公众号文章
2. 按 `Ctrl+U`（Mac: `⌘+U`）打开源码页面
3. 全选（`Ctrl+A`）并复制
4. 在主题管理 → 「从公众号提取」面板粘贴
5. 选择继承的基础主题（默认：默认简洁）
6. 点击「提取主题样式」，在编辑器中微调后保存

---

## MCP Server（供 AI 智能体集成）

将转换能力暴露为 MCP 工具，供 openclaw、Claude Desktop 等支持 MCP 协议的智能体调用。

### 前置要求

- Node.js >= 18

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/xuyinghan02-cell/markdown-transfer-weixin

# 2. 进入 mcp 目录安装依赖
cd markdown-transfer-weixin/mcp
npm install
```

### 注册到 MCP 客户端

将以下配置片段加入你的 MCP 客户端配置文件，**路径改为实际绝对路径**：

**openclaw**（配置文件路径参见 openclaw 文档）：

```json
{
  "mcpServers": {
    "markdown-to-weixin": {
      "command": "node",
      "args": ["/绝对路径/markdown-transfer-weixin/mcp/server.js"]
    }
  }
}
```

**Claude Desktop**（`~/Library/Application Support/Claude/claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "markdown-to-weixin": {
      "command": "node",
      "args": ["/绝对路径/markdown-transfer-weixin/mcp/server.js"]
    }
  }
}
```

修改配置后重启客户端即可生效。

### 工具参数

注册成功后，智能体可调用 `convert_markdown_to_weixin` 工具：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `markdown` | string | ✅ | 要转换的 Markdown 文本 |
| `theme` | string | — | `default` \| `tech` \| `literary`，默认 `literary` |
| `accent_color` | string | — | 覆盖主色，十六进制如 `#8b1a1a` |
| `font_size` | number | — | 基础字号（px），建议 13–19 |
| `line_height` | number | — | 行高倍数，建议 1.4–2.2 |
| `open_browser` | boolean | — | 是否打开浏览器写剪切板，默认 `true` |

### 工作流程

```
智能体（openclaw 等）
  │
  │  调用 convert_markdown_to_weixin(markdown, theme, ...)
  ▼
MCP Server（本地 Node.js 进程）
  │  转换 Markdown → 带内联样式的 HTML
  │  写入临时 HTML 文件
  │  用系统浏览器打开该文件
  ▼
浏览器自动执行
  │  Clipboard API 将富文本（text/html）写入系统剪切板
  ▼
用户在微信公众号编辑器 Ctrl+V 粘贴 ✓
```

### 在 openclaw 中通过 skill 一键接入

openclaw 支持通过 skill 文件扩展功能。只需将 `SKILL.md` 提供给 openclaw，它便会根据文件中的指引自动完成安装，并将该 skill 注册到自身以供后续直接调用，无需手动配置 MCP。

将以下内容发送给 openclaw：

```
请按照这份 skill 文件完成安装和注册：
[粘贴 SKILL.md 的全部内容]
```

openclaw 会自动执行安装步骤（克隆仓库、`npm install`、写入 MCP 配置），完成后即可直接对话触发转换。

### 在 Claude Code 中使用 skill

如果你在 Claude Code 中工作，可以使用内置 skill：

```
/weixin-mcp
```

直接粘贴 Markdown 内容即可触发转换，无需手动构造工具调用参数。

---

## 文件结构

```
markdown-transfer-weixin/
├── standalone.html          # 独立网页（单文件，无需安装，含自定义主题管理）
├── index.html               # 带外部依赖的完整版网页
├── css/                     # 样式文件
├── js/
│   ├── themes.js            # 内置主题定义
│   ├── converter.js         # Markdown → HTML 转换器
│   └── app.js               # 应用主逻辑
├── mcp/
│   ├── server.js            # MCP Server 主文件
│   └── package.json         # Node.js 依赖声明
└── SKILL.md                 # Claude Code skill 定义
```
