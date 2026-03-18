/**
 * Markdown → 微信公众号富文本转换器
 * 使用 marked.js 自定义渲染器，为每个元素注入 inline style
 */

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createRenderer(styles) {
  const renderer = new marked.Renderer();

  // 标题
  renderer.heading = function (text, level) {
    const style = styles[`h${level}`] || styles.h6;
    if (level === 1 && styles.h1Decoration) {
      return `<h1 style="${style}">${text}${styles.h1Decoration}</h1>\n`;
    }
    return `<h${level} style="${style}">${text}</h${level}>\n`;
  };

  // 段落 —— 图片单独处理，不加 text-indent
  renderer.paragraph = function (text) {
    const isOnlyImage = /^<img[^>]*>$/.test(text.trim());
    if (isOnlyImage) {
      return `<p style="text-align: center; margin: 16px 0;">${text}</p>\n`;
    }
    return `<p style="${styles.p}">${text}</p>\n`;
  };

  // 加粗
  renderer.strong = function (text) {
    return `<strong style="${styles.strong}">${text}</strong>`;
  };

  // 斜体
  renderer.em = function (text) {
    return `<em style="${styles.em}">${text}</em>`;
  };

  // 删除线
  renderer.del = function (text) {
    return `<del style="${styles.del}">${text}</del>`;
  };

  // 行内代码
  renderer.codespan = function (code) {
    return `<code style="${styles.inlineCode}">${code}</code>`;
  };

  // 代码块
  renderer.code = function (code, infostring) {
    const escaped = escapeHtml(code);
    const lang = infostring ? infostring.split(/\s+/)[0] : '';
    if (styles.codeHeader) {
      const dots = [
        `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff5f56;margin-right:5px;vertical-align:middle;"></span>`,
        `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ffbd2e;margin-right:5px;vertical-align:middle;"></span>`,
        `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#27c93f;vertical-align:middle;"></span>`,
      ].join('');
      const langLabel = lang ? `<span style="float:right;font-family:monospace;font-size:11px;color:#999;text-transform:uppercase;">${lang}</span>` : '';
      return `<section style="margin:28px 0;overflow:hidden;border-radius:8px;">\n<section style="${styles.codeHeader}">${langLabel}${dots}</section>\n<pre style="${styles.pre}"><code style="${styles.preCode}">${escaped}</code></pre>\n</section>\n`;
    }
    const langLabel = lang
      ? `<span style="display:block;font-size:11px;color:#999;margin-bottom:8px;font-family:sans-serif;">${lang}</span>`
      : '';
    return `<pre style="${styles.pre}">${langLabel}<code style="${styles.preCode}">${escaped}</code></pre>\n`;
  };

  // 引用块
  renderer.blockquote = function (quote) {
    const needsItalic = styles.blockquote && styles.blockquote.includes('font-style: italic');
    const processedQ = needsItalic
      ? quote.replace(/<p style="([^"]*)">/g, (_, s) => `<p style="${s}${s.endsWith(';') ? '' : ';'} font-style: italic;">`)
      : quote;
    return `<blockquote style="${styles.blockquote}">${processedQ}</blockquote>\n`;
  };

  // 列表
  renderer.list = function (body, ordered, start) {
    const tag = ordered ? 'ol' : 'ul';
    const style = ordered ? styles.ol : styles.ul;
    const startAttr = (ordered && start !== 1) ? ` start="${start}"` : '';
    return `<${tag}${startAttr} style="${style}">${body}</${tag}>\n`;
  };

  // 列表项
  renderer.listitem = function (text) {
    return `<li style="${styles.li}">${text}</li>\n`;
  };

  // 链接
  renderer.link = function (href, title, text) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<a href="${href}"${titleAttr} style="${styles.a}">${text}</a>`;
  };

  // 图片
  renderer.image = function (href, title, text) {
    const altAttr = text ? ` alt="${escapeHtml(text)}"` : '';
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${href}"${altAttr}${titleAttr} style="${styles.img}">`;
  };

  // 分隔线
  renderer.hr = function () {
    return `<hr style="${styles.hr}">\n`;
  };

  // 表格
  renderer.table = function (header, body) {
    return `<table style="${styles.table}"><thead>${header}</thead><tbody>${body}</tbody></table>\n`;
  };

  renderer.tablerow = function (content) {
    return `<tr>${content}</tr>\n`;
  };

  renderer.tablecell = function (content, flags) {
    const tag = flags.header ? 'th' : 'td';
    const baseStyle = flags.header ? styles.th : styles.td;
    const alignStyle = flags.align ? ` text-align: ${flags.align};` : '';
    return `<${tag} style="${baseStyle}${alignStyle}">${content}</${tag}>`;
  };

  // 换行
  renderer.br = function () {
    return '<br>';
  };

  return renderer;
}

/**
 * 将 Markdown 转换为适合微信公众号的内联样式 HTML
 * @param {string} markdown - 输入的 Markdown 文本
 * @param {object} theme - 主题对象（来自 themes.js）
 * @param {object} overrides - 覆盖变量（fontSize, lineHeight, accentColor 等）
 * @returns {string} 带内联样式的 HTML 字符串
 */
function convertMarkdown(markdown, theme, overrides = {}) {
  if (!markdown || !markdown.trim()) return '';

  // 合并变量：主题默认值 + 用户覆盖
  const vars = Object.assign({}, theme.vars, overrides);
  const styles = theme.styles(vars);

  const renderer = createRenderer(styles);

  marked.setOptions({
    renderer,
    breaks: true,    // 单个换行转为 <br>
    gfm: true,       // GitHub Flavored Markdown
    headerIds: false, // 不生成 id 属性（减少无用属性）
    mangle: false,
  });

  const body = marked.parse(markdown);

  // 用 section 包裹，赋予基础样式，section 在微信中更稳定
  return `<section style="${styles.wrapper}">${body}</section>`;
}
