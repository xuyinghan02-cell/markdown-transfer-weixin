/**
 * 主应用逻辑
 */

// ── 示例内容 ────────────────────────────────────────────────
const DEMO_MARKDOWN = `# 标题：用 Markdown 写公众号

## 一、为什么需要这个工具

日常写作习惯用 **Markdown**，但微信公众号编辑器不支持直接渲染。手动排版费时费力，而且样式不统一。

本工具将 Markdown 转换为带 **内联样式** 的富文本，直接粘贴到公众号编辑器即可使用。

## 二、支持的格式

### 文字样式

普通文字、**加粗文字**、*斜体文字*、~~删除线~~，以及行内代码 \`const x = 42\`。

### 代码块

\`\`\`javascript
function greet(name) {
  return \`你好，\${name}！\`;
}

console.log(greet('世界'));
\`\`\`

### 引用块

> 工具的价值在于让创作者专注于内容本身，而非排版细节。

### 列表

**无序列表：**

- 支持 H1 - H6 标题
- 支持加粗、斜体、删除线
- 支持代码块（含语言标注）
- 支持引用、分隔线、表格

**有序列表：**

1. 在左侧编辑 Markdown
2. 右侧实时预览效果
3. 点击「复制富文本」
4. 粘贴到微信公众号编辑器

## 三、表格示例

| 功能 | 支持情况 | 备注 |
|------|----------|------|
| 标题 | ✅ | H1 - H6 |
| 列表 | ✅ | 有序 / 无序 |
| 代码 | ✅ | 含语言标注 |
| 表格 | ✅ | GFM 语法 |
| 图片 | ✅ | 需公网地址 |

---

*感谢使用！如有问题欢迎反馈。*
`;

// ── DOM 引用 ────────────────────────────────────────────────
const editor      = document.getElementById('editor');
const preview     = document.getElementById('preview');
const themeSelect = document.getElementById('theme-select');
const fontSizeInput   = document.getElementById('font-size');
const fontSizeVal     = document.getElementById('font-size-val');
const lineHeightInput = document.getElementById('line-height');
const lineHeightVal   = document.getElementById('line-height-val');
const accentColorInput = document.getElementById('accent-color');
const copyRichBtn = document.getElementById('copy-rich-btn');
const copyHtmlBtn = document.getElementById('copy-html-btn');
const fileInput   = document.getElementById('file-input');
const toast       = document.getElementById('toast');
const charCount   = document.getElementById('char-count');
const wordCount   = document.getElementById('word-count');

// ── 状态 ────────────────────────────────────────────────────
let currentTheme = THEMES.default;
let overrides = {};
let toastTimer = null;

// ── 渲染 ────────────────────────────────────────────────────
function render() {
  const md = editor.value;
  preview.innerHTML = convertMarkdown(md, currentTheme, overrides);
  updateStats(md);
}

function updateStats(md) {
  const chars = md.length;
  // 按中文字符 + 英文单词统计
  const chinese = (md.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words   = (md.match(/[a-zA-Z]+/g) || []).length;
  charCount.textContent = `${chars} 字符`;
  wordCount.textContent = `中文 ${chinese} 字`;
}

// ── Toast 提示 ───────────────────────────────────────────────
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast toast--${type} show`;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// ── 复制富文本 ───────────────────────────────────────────────
async function copyRichText() {
  const html = preview.innerHTML;
  if (!html) { showToast('没有内容可复制', 'warn'); return; }

  // 优先使用 ClipboardItem（现代浏览器）
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
    try {
      const blob = new Blob([html], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      showToast('✓ 富文本已复制，可直接粘贴到微信公众号编辑器');
      return;
    } catch (e) {
      // 降级处理
    }
  }

  // 降级：用 Selection + execCommand
  const tmpDiv = document.createElement('div');
  tmpDiv.innerHTML = html;
  tmpDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(tmpDiv);
  try {
    const range = document.createRange();
    range.selectNodeContents(tmpDiv);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    sel.removeAllRanges();
    showToast('✓ 富文本已复制（兼容模式）');
  } catch (e) {
    showToast('复制失败，请手动全选预览区域复制', 'warn');
  } finally {
    document.body.removeChild(tmpDiv);
  }
}

// ── 复制 HTML 源码 ───────────────────────────────────────────
async function copyHtmlSource() {
  const html = preview.innerHTML;
  if (!html) { showToast('没有内容可复制', 'warn'); return; }
  try {
    await navigator.clipboard.writeText(html);
    showToast('✓ HTML 源码已复制');
  } catch (e) {
    showToast('复制失败', 'warn');
  }
}

// ── 主题切换 ─────────────────────────────────────────────────
function applyTheme(themeKey) {
  currentTheme = THEMES[themeKey];
  overrides = {};
  // 同步控件到新主题默认值
  const v = currentTheme.vars;
  fontSizeInput.value    = v.fontSize;
  fontSizeVal.textContent = v.fontSize + 'px';
  lineHeightInput.value  = v.lineHeight;
  lineHeightVal.textContent = parseFloat(v.lineHeight).toFixed(2);
  accentColorInput.value = v.accentColor;
  render();
}

// ── 事件绑定 ─────────────────────────────────────────────────
editor.addEventListener('input', render);

themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

fontSizeInput.addEventListener('input', () => {
  const val = parseInt(fontSizeInput.value);
  fontSizeVal.textContent = val + 'px';
  overrides.fontSize = val;
  render();
});

lineHeightInput.addEventListener('input', () => {
  const val = parseFloat(lineHeightInput.value).toFixed(2);
  lineHeightVal.textContent = val;
  overrides.lineHeight = parseFloat(val);
  render();
});

accentColorInput.addEventListener('input', () => {
  overrides.accentColor = accentColorInput.value;
  render();
});

copyRichBtn.addEventListener('click', copyRichText);
copyHtmlBtn.addEventListener('click', copyHtmlSource);

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) { // 1MB 限制
    showToast('文件过大（最大 1MB）', 'warn');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    editor.value = ev.target.result;
    render();
    showToast(`✓ 已加载：${file.name}`);
  };
  reader.readAsText(file, 'UTF-8');
  fileInput.value = '';
});

// 支持拖拽文件到编辑区
editor.addEventListener('dragover', (e) => e.preventDefault());
editor.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    editor.value = ev.target.result;
    render();
    showToast(`✓ 已加载：${file.name}`);
  };
  reader.readAsText(file, 'UTF-8');
});

// Tab 键缩进
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end   = editor.selectionEnd;
    editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = start + 2;
  }
});

// ── 初始化 ───────────────────────────────────────────────────
editor.value = DEMO_MARKDOWN;
render();
