# weixin-mcp — 微信公众号 Markdown 转换（MCP 集成指南）

将用户提供的 Markdown 内容通过 `convert_markdown_to_weixin` MCP 工具完成转换，并给出完整的接入使用说明。

---

## 使用方式

当用户执行此 skill 时，请执行以下步骤：

### 1. 如果用户在消息中包含了 Markdown 内容

调用 MCP 工具 `convert_markdown_to_weixin`，参数如下：

- `markdown`：用户提供的 Markdown 文本（必填）
- `theme`：若用户未指定，默认使用 `magazine`
  - `magazine` — 现代杂志（衬线标题，H1 双色底线，H2 红色竖条，仿 macOS 代码块，引用斜体，**默认主题**）
  - `literary` — 文艺清新（衬线字体，深红色调，H2 左竖条装饰）
  - `default` — 默认简洁（绿色主色，清晰易读）
  - `tech` — 科技感（深色代码块、蓝色高亮）
- `accent_color`：可选，覆盖主色调，十六进制如 `#8b1a1a`
- `font_size`：可选，基础字号（px），建议 13–19
- `line_height`：可选，行高倍数，建议 1.4–2.2
- `open_browser`：默认 `true`，自动打开浏览器写入剪切板

调用完成后告知用户：
> 转换完成，浏览器已自动打开预览页面并将富文本写入剪切板。
> 请切换到**微信公众号编辑器**，直接按 Ctrl+V（或 Cmd+V）粘贴即可。

### 2. 如果用户想使用自定义主题或从公众号提取风格

告知用户使用独立网页（`standalone.html`）中的主题管理功能：

- **自定义主题**：点击「主题管理」→「新建主题」，可设置颜色、字号、字体，并对各标题/段落元素单独覆盖 CSS
- **从公众号提取**：点击「主题管理」→「从公众号提取」，粘贴文章 HTML 源码（浏览器 `Ctrl+U`），自动解析内联样式、CSS 类及 CSS 变量生成可编辑主题，可选择继承的基础主题

### 3. 如果用户没有提供内容，只是想了解如何接入

参照下方 **MCP 接入说明** 输出给用户。

---

## MCP 接入说明

此工具通过 **MCP（Model Context Protocol）** 协议暴露 Markdown → 微信公众号转换能力，支持 openclaw、Claude Desktop 等任何兼容 MCP 的智能体调用。

### 前置要求

- Node.js >= 18

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/xuyinghan02-cell/markdown-transfer-weixin
cd markdown-transfer-weixin/mcp

# 2. 安装依赖
npm install
```

### 在 MCP 客户端中注册

将以下配置添加到你的 MCP 客户端配置文件中：

**openclaw 配置**（`~/.openclaw/config.json` 或客户端设置界面）：
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

**Claude Desktop 配置**（`~/Library/Application Support/Claude/claude_desktop_config.json`）：
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

> 提示：将 `/绝对路径/markdown-transfer-weixin` 替换为实际克隆路径，例如 `/home/user/markdown-transfer-weixin`。

### 可用工具

注册后，智能体可以调用：

```
工具名：convert_markdown_to_weixin

参数：
  markdown     (string, 必填)  要转换的 Markdown 内容
  theme        (string, 可选)  magazine（默认）| literary | default | tech
  accent_color (string, 可选)  主色，如 #8b1a1a
  font_size    (number, 可选)  字号 px，如 16
  line_height  (number, 可选)  行高倍数，如 2.0
  open_browser (boolean, 可选) 是否打开浏览器写剪切板，默认 true
```

### 工作流程

```
openclaw                     MCP Server               浏览器
   │                             │                       │
   │  convert_markdown_to_weixin │                       │
   │ ──────────────────────────> │                       │
   │                             │  生成临时 HTML        │
   │                             │  打开文件             │
   │                             │ ─────────────────────>│
   │                             │                       │ Clipboard API
   │                             │                       │ 写入富文本
   │   返回转换后 HTML 字符串    │                       │
   │ <────────────────────────── │                       │
   │                                                     │
用户在微信公众号编辑器 Ctrl+V 粘贴 ◄────────────────────┘
```
