/**
 * MCP Server — Markdown → 微信公众号
 *
 * 暴露一个 MCP tool: convert_markdown_to_weixin
 * 将 Markdown 转换为带内联样式的 HTML，并通过临时页面自动写入系统剪切板（富文本）。
 *
 * 配置方式（openclaw / claude desktop / 任何支持 MCP 的客户端）：
 * {
 *   "mcpServers": {
 *     "markdown-to-weixin": {
 *       "command": "node",
 *       "args": ["/path/to/mcp/server.js"]
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { marked } from 'marked';
import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/* ═══════════════════════════════════════════════════════════
   Themes  (与 standalone.html 保持一致)
═══════════════════════════════════════════════════════════ */
const THEMES = {
  default: {
    name: '默认简洁',
    vars: {
      accentColor: '#07c160',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      fontSize: 15,
      lineHeight: 1.75,
      textColor: '#333333',
      mutedColor: '#666666',
    },
    styles(v) {
      return {
        wrapper:     `font-family: ${v.fontFamily}; font-size: ${v.fontSize}px; color: ${v.textColor}; line-height: ${v.lineHeight}; word-wrap: break-word; -webkit-text-size-adjust: 100%;`,
        h1:          `display: block; font-size: 22px; font-weight: bold; color: #1a1a1a; margin: 28px 0 14px 0; line-height: 1.4; text-align: center; letter-spacing: 1px;`,
        h2:          `display: block; font-size: 18px; font-weight: bold; color: #1a1a1a; margin: 24px 0 12px 0; line-height: 1.4; border-bottom: 2px solid ${v.accentColor}; padding-bottom: 6px;`,
        h3:          `display: block; font-size: ${v.fontSize + 2}px; font-weight: bold; color: #1a1a1a; margin: 20px 0 10px 0; line-height: 1.4; padding-left: 10px; border-left: 3px solid ${v.accentColor};`,
        h4:          `display: block; font-size: ${v.fontSize + 1}px; font-weight: bold; color: #1a1a1a; margin: 16px 0 8px 0; line-height: 1.4;`,
        h5:          `display: block; font-size: ${v.fontSize}px; font-weight: bold; color: #555; margin: 14px 0 7px 0; line-height: 1.4;`,
        h6:          `display: block; font-size: ${v.fontSize - 1}px; font-weight: bold; color: #777; margin: 12px 0 6px 0; line-height: 1.4;`,
        p:           `display: block; margin: 12px 0; line-height: ${v.lineHeight}; color: ${v.textColor}; font-size: ${v.fontSize}px;`,
        strong:      `font-weight: bold; color: #1a1a1a;`,
        em:          `font-style: italic;`,
        del:         `text-decoration: line-through; color: #999;`,
        inlineCode:  `background-color: #f5f5f5; padding: 2px 5px; border-radius: 3px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 87%; color: #e83e8c;`,
        pre:         `display: block; background-color: #f8f8f8; border-radius: 6px; padding: 16px; margin: 16px 0; overflow-x: auto;`,
        preCode:     `background-color: transparent; padding: 0; font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; line-height: 1.6; color: #333; white-space: pre;`,
        blockquote:  `display: block; border-left: 4px solid ${v.accentColor}; padding: 10px 16px; margin: 16px 0; background-color: #f9f9f9; color: ${v.mutedColor};`,
        ul:          `display: block; padding-left: 24px; margin: 12px 0;`,
        ol:          `display: block; padding-left: 24px; margin: 12px 0;`,
        li:          `display: list-item; margin: 6px 0; line-height: ${v.lineHeight}; font-size: ${v.fontSize}px; color: ${v.textColor};`,
        a:           `color: ${v.accentColor}; text-decoration: none;`,
        img:         `display: block; max-width: 100%; height: auto; margin: 16px auto;`,
        hr:          `display: block; border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;`,
        table:       `border-collapse: collapse; width: 100%; margin: 16px 0; font-size: ${v.fontSize - 1}px;`,
        th:          `background-color: #f5f5f5; border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: bold; color: #1a1a1a;`,
        td:          `border: 1px solid #e5e7eb; padding: 8px 12px; color: ${v.textColor};`,
      };
    },
  },

  tech: {
    name: '科技感',
    vars: {
      accentColor: '#4f9cf9',
      fontFamily: '"PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, Arial, sans-serif',
      fontSize: 15,
      lineHeight: 1.8,
      textColor: '#2d3748',
      mutedColor: '#718096',
    },
    styles(v) {
      return {
        wrapper:     `font-family: ${v.fontFamily}; font-size: ${v.fontSize}px; color: ${v.textColor}; line-height: ${v.lineHeight}; word-wrap: break-word;`,
        h1:          `display: block; font-size: 24px; font-weight: 700; color: ${v.accentColor}; margin: 28px 0 14px 0; line-height: 1.3; text-align: center; letter-spacing: 2px;`,
        h2:          `display: block; font-size: 19px; font-weight: 700; color: #1a202c; margin: 24px 0 12px 0; line-height: 1.4; background-color: #ebf4ff; padding: 8px 14px; border-left: 4px solid ${v.accentColor};`,
        h3:          `display: block; font-size: ${v.fontSize + 2}px; font-weight: 600; color: ${v.accentColor}; margin: 20px 0 10px 0; line-height: 1.4;`,
        h4:          `display: block; font-size: ${v.fontSize + 1}px; font-weight: 600; color: #2d3748; margin: 16px 0 8px 0; line-height: 1.4;`,
        h5:          `display: block; font-size: ${v.fontSize}px; font-weight: 600; color: #4a5568; margin: 14px 0 7px 0; line-height: 1.4;`,
        h6:          `display: block; font-size: ${v.fontSize - 1}px; font-weight: 600; color: #718096; margin: 12px 0 6px 0; line-height: 1.4;`,
        p:           `display: block; margin: 12px 0; line-height: ${v.lineHeight}; color: ${v.textColor}; font-size: ${v.fontSize}px;`,
        strong:      `font-weight: bold; color: #1a202c;`,
        em:          `font-style: italic; color: #4a5568;`,
        del:         `text-decoration: line-through; color: #a0aec0;`,
        inlineCode:  `background-color: #1a202c; padding: 2px 6px; border-radius: 3px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 87%; color: #68d391;`,
        pre:         `display: block; background-color: #1a202c; border-radius: 8px; padding: 18px; margin: 16px 0; overflow-x: auto;`,
        preCode:     `background-color: transparent; padding: 0; font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; line-height: 1.6; color: #e2e8f0; white-space: pre;`,
        blockquote:  `display: block; border-left: 4px solid ${v.accentColor}; padding: 12px 16px; margin: 16px 0; background-color: #ebf4ff; color: #2b6cb0; border-radius: 0 6px 6px 0;`,
        ul:          `display: block; padding-left: 24px; margin: 12px 0;`,
        ol:          `display: block; padding-left: 24px; margin: 12px 0;`,
        li:          `display: list-item; margin: 6px 0; line-height: ${v.lineHeight}; font-size: ${v.fontSize}px; color: ${v.textColor};`,
        a:           `color: ${v.accentColor}; text-decoration: none;`,
        img:         `display: block; max-width: 100%; height: auto; margin: 16px auto; border-radius: 6px;`,
        hr:          `display: block; border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;`,
        table:       `border-collapse: collapse; width: 100%; margin: 16px 0; font-size: ${v.fontSize - 1}px;`,
        th:          `background-color: ${v.accentColor}; border: 1px solid #bee3f8; padding: 10px 14px; text-align: left; font-weight: bold; color: #fff;`,
        td:          `border: 1px solid #e2e8f0; padding: 8px 14px; color: ${v.textColor};`,
      };
    },
  },

  literary: {
    name: '文艺清新',
    vars: {
      accentColor: '#8b1a1a',
      fontFamily: 'Georgia, "Times New Roman", "Songti SC", "SimSun", serif',
      fontSize: 16,
      lineHeight: 2.0,
      textColor: '#2d1010',
      mutedColor: '#7a4040',
    },
    styles(v) {
      return {
        wrapper:     `font-family: ${v.fontFamily}; font-size: ${v.fontSize}px; color: ${v.textColor}; line-height: ${v.lineHeight}; word-wrap: break-word;`,
        h1:          `display: block; font-size: 26px; font-weight: bold; color: #1a0808; margin: 32px 0 16px 0; line-height: 1.4; text-align: center; letter-spacing: 3px;`,
        h2:          `display: block; font-size: 20px; font-weight: bold; color: #1a0808; margin: 28px 0 14px 0; line-height: 1.4; border-left: 4px solid ${v.accentColor}; padding-left: 12px;`,
        h3:          `display: block; font-size: ${v.fontSize + 2}px; font-weight: bold; color: ${v.accentColor}; margin: 22px 0 11px 0; line-height: 1.4;`,
        h4:          `display: block; font-size: ${v.fontSize + 1}px; font-weight: bold; color: #2d1010; margin: 18px 0 9px 0; line-height: 1.4;`,
        h5:          `display: block; font-size: ${v.fontSize}px; font-weight: bold; color: #5a2020; margin: 14px 0 7px 0; line-height: 1.4;`,
        h6:          `display: block; font-size: ${v.fontSize - 1}px; font-weight: bold; color: #7a4040; margin: 12px 0 6px 0; line-height: 1.4;`,
        p:           `display: block; margin: 14px 0; line-height: ${v.lineHeight}; color: ${v.textColor}; font-size: ${v.fontSize}px; text-indent: 2em;`,
        strong:      `font-weight: bold; color: #1a0808;`,
        em:          `font-style: italic; color: ${v.accentColor};`,
        del:         `text-decoration: line-through; color: #b07070;`,
        inlineCode:  `background-color: #fdf2f2; padding: 2px 5px; border-radius: 3px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 87%; color: ${v.accentColor};`,
        pre:         `display: block; background-color: #fdf2f2; border-radius: 6px; padding: 16px; margin: 16px 0; border-left: 4px solid ${v.accentColor}; overflow-x: auto;`,
        preCode:     `background-color: transparent; padding: 0; font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; line-height: 1.6; color: #5a2020; white-space: pre;`,
        blockquote:  `display: block; border-left: 4px solid ${v.accentColor}; padding: 12px 20px; margin: 20px 0; background-color: #fdf2f2; color: ${v.mutedColor}; font-style: italic;`,
        ul:          `display: block; padding-left: 24px; margin: 14px 0;`,
        ol:          `display: block; padding-left: 24px; margin: 14px 0;`,
        li:          `display: list-item; margin: 8px 0; line-height: ${v.lineHeight}; font-size: ${v.fontSize}px; color: ${v.textColor};`,
        a:           `color: ${v.accentColor}; text-decoration: underline; text-underline-offset: 3px;`,
        img:         `display: block; max-width: 100%; height: auto; margin: 20px auto; border-radius: 4px;`,
        hr:          `display: block; border: none; border-top: 1px dashed #c8a0a0; margin: 32px 0;`,
        table:       `border-collapse: collapse; width: 100%; margin: 16px 0; font-size: ${v.fontSize - 1}px;`,
        th:          `background-color: #fdf2f2; border: 1px solid #e0c0c0; padding: 8px 12px; text-align: left; font-weight: bold; color: #2d1010;`,
        td:          `border: 1px solid #e0c0c0; padding: 8px 12px; color: ${v.textColor};`,
      };
    },
  },

  magazine: {
    name: '现代杂志',
    vars: {
      accentColor: '#c0392b',
      fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: 15,
      lineHeight: 1.85,
      textColor: '#4a4a4a',
      mutedColor: '#888888',
    },
    styles(v) {
      return {
        wrapper:     `font-family: ${v.fontFamily}; font-size: ${v.fontSize}px; color: ${v.textColor}; line-height: ${v.lineHeight}; word-wrap: break-word; -webkit-text-size-adjust: 100%;`,
        h1:          `display: block; font-family: "Noto Serif SC", "Songti SC", Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 44px 0 16px 0; line-height: 1.4; padding-bottom: 10px; border-bottom: 2px solid ${v.accentColor};`,
        h2:          `display: block; font-family: "Noto Serif SC", "Songti SC", Georgia, serif; font-size: 19px; font-weight: 600; color: #1a1a1a; margin: 36px 0 12px 0; line-height: 1.45; border-left: 4px solid ${v.accentColor}; padding-left: 12px;`,
        h3:          `display: block; font-size: 15px; font-weight: 600; color: #1a1a1a; margin: 28px 0 10px 0; line-height: 1.4; letter-spacing: 0.03em;`,
        h4:          `display: block; font-size: ${v.fontSize}px; font-weight: 600; color: #1a1a1a; margin: 20px 0 8px 0; line-height: 1.4;`,
        h5:          `display: block; font-size: ${v.fontSize - 1}px; font-weight: 600; color: #4a4a4a; margin: 16px 0 6px 0; line-height: 1.4;`,
        h6:          `display: block; font-size: ${v.fontSize - 1}px; font-weight: 600; color: #888888; margin: 14px 0 6px 0; line-height: 1.4;`,
        p:           `display: block; font-size: 15.5px; line-height: 1.85; color: ${v.textColor}; margin-bottom: 20px;`,
        strong:      `font-weight: 700; color: #1a1a1a;`,
        em:          `font-style: italic; color: ${v.accentColor};`,
        del:         `text-decoration: line-through; color: #aaaaaa;`,
        inlineCode:  `font-family: "JetBrains Mono", "Fira Code", Consolas, monospace; font-size: 13px; background-color: #f4f3f0; color: ${v.accentColor}; padding: 1px 6px; border-radius: 3px; border: 1px solid #d8d5d0;`,
        pre:         `display: block; background-color: #1e1e1e; border-radius: 8px; padding: 20px; margin: 28px 0; overflow-x: auto;`,
        preCode:     `background-color: transparent; padding: 0; font-family: "JetBrains Mono", "Fira Code", Consolas, monospace; font-size: 13.5px; line-height: 1.7; color: #d4d4d4; white-space: pre;`,
        blockquote:  `display: block; border-left: 3px solid ${v.accentColor}; padding: 18px 22px; margin: 28px 0; background-color: #f6f4f1; color: #555555; font-style: italic; border-radius: 0 4px 4px 0;`,
        ul:          `display: block; padding-left: 22px; margin: 20px 0;`,
        ol:          `display: block; padding-left: 24px; margin: 20px 0;`,
        li:          `display: list-item; margin: 6px 0; line-height: 1.8; font-size: ${v.fontSize}px; color: ${v.textColor};`,
        a:           `color: ${v.accentColor}; text-decoration: underline; text-underline-offset: 3px;`,
        img:         `display: block; max-width: 100%; height: auto; margin: 20px auto; border-radius: 6px;`,
        hr:          `display: block; border: none; border-top: 1px solid #e0ddd8; margin: 36px 0;`,
        table:       `border-collapse: collapse; width: 100%; margin: 28px 0; font-size: 14px;`,
        th:          `background-color: #1a1a1a; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #ffffff; letter-spacing: 0.05em;`,
        td:          `padding: 11px 16px; color: ${v.textColor}; border-top: 1px solid #e0ddd8; line-height: 1.5;`,
      };
    },
  },
};

/* ═══════════════════════════════════════════════════════════
   Markdown → inline-style HTML  (与 standalone.html 保持一致)
═══════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function createRenderer(styles) {
  const renderer = new marked.Renderer();

  renderer.heading = (text, level) => {
    const s = styles[`h${level}`] || styles.h6;
    return `<h${level} style="${s}">${text}</h${level}>\n`;
  };
  renderer.paragraph = (text) => {
    const isOnlyImg = /^<img[^>]*>$/.test(text.trim());
    if (isOnlyImg) return `<p style="text-align:center;margin:16px 0;">${text}</p>\n`;
    return `<p style="${styles.p}">${text}</p>\n`;
  };
  renderer.strong      = (text) => `<strong style="${styles.strong}">${text}</strong>`;
  renderer.em          = (text) => `<em style="${styles.em}">${text}</em>`;
  renderer.del         = (text) => `<del style="${styles.del}">${text}</del>`;
  renderer.codespan    = (code) => `<code style="${styles.inlineCode}">${code}</code>`;
  renderer.code        = (code, info) => {
    const lang = info ? info.split(/\s+/)[0] : '';
    const label = lang
      ? `<span style="display:block;font-size:11px;color:#999;margin-bottom:8px;font-family:sans-serif;">${lang}</span>`
      : '';
    return `<pre style="${styles.pre}">${label}<code style="${styles.preCode}">${escapeHtml(code)}</code></pre>\n`;
  };
  renderer.blockquote  = (q) => `<blockquote style="${styles.blockquote}">${q}</blockquote>\n`;
  renderer.list        = (body, ordered, start) => {
    const tag = ordered ? 'ol' : 'ul';
    const s   = ordered ? styles.ol : styles.ul;
    const sa  = (ordered && start !== 1) ? ` start="${start}"` : '';
    return `<${tag}${sa} style="${s}">${body}</${tag}>\n`;
  };
  renderer.listitem    = (text) => `<li style="${styles.li}">${text}</li>\n`;
  renderer.link        = (href, title, text) => {
    const ta = title ? ` title="${escapeHtml(title)}"` : '';
    return `<a href="${href}"${ta} style="${styles.a}">${text}</a>`;
  };
  renderer.image       = (href, title, text) => {
    const aa = text  ? ` alt="${escapeHtml(text)}"` : '';
    const ta = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${href}"${aa}${ta} style="${styles.img}">`;
  };
  renderer.hr          = () => `<hr style="${styles.hr}">\n`;
  renderer.table       = (header, body) =>
    `<table style="${styles.table}"><thead>${header}</thead><tbody>${body}</tbody></table>\n`;
  renderer.tablerow    = (content) => `<tr>${content}</tr>\n`;
  renderer.tablecell   = (content, flags) => {
    const tag  = flags.header ? 'th' : 'td';
    const base = flags.header ? styles.th : styles.td;
    const align = flags.align ? ` text-align:${flags.align};` : '';
    return `<${tag} style="${base}${align}">${content}</${tag}>`;
  };
  renderer.br = () => '<br>';
  return renderer;
}

function convertMarkdown(markdown, themeName = 'default', overrides = {}) {
  if (!markdown || !markdown.trim()) return '';
  const theme = THEMES[themeName] || THEMES.default;
  const vars  = Object.assign({}, theme.vars, overrides);
  const styles = theme.styles(vars);

  marked.setOptions({
    renderer: createRenderer(styles),
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false,
  });

  const body = marked.parse(markdown);
  return `<section style="${styles.wrapper}">${body}</section>`;
}

/* ═══════════════════════════════════════════════════════════
   剪切板写入
   策略：生成一个含自动复制脚本的临时 HTML 页面，用系统默认浏览器打开。
   浏览器会通过 Clipboard API 将富文本（text/html）写入剪切板，
   之后用户可直接粘贴到微信公众号编辑器。
═══════════════════════════════════════════════════════════ */
function buildAutoClipPage(contentHtml) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>微信公众号 — 正在写入剪切板</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: #f4f4f5; min-height: 100vh; }
  .banner {
    position: sticky; top: 0; z-index: 99;
    padding: 14px 24px; font-size: 14px; font-weight: 500;
    display: flex; align-items: center; gap: 10px;
    background: #ecfdf5; color: #065f46; border-bottom: 1px solid #a7f3d0;
  }
  .banner.err { background: #fff7ed; color: #9a3412; border-color: #fdba74; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: currentColor;
         animation: pulse 1s infinite; flex-shrink: 0; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .card { max-width: 720px; margin: 32px auto; background: #fff;
          border-radius: 6px; padding: 36px 40px 52px;
          box-shadow: 0 2px 12px rgba(0,0,0,.08); }
</style>
</head>
<body>
<div class="banner" id="banner">
  <div class="dot" id="dot"></div>
  <span id="msg">正在将富文本写入剪切板，请稍候…</span>
</div>
<div class="card" id="content">${contentHtml}</div>
<script>
(async function () {
  const banner = document.getElementById('banner');
  const dot    = document.getElementById('dot');
  const msg    = document.getElementById('msg');
  const el     = document.getElementById('content');

  function ok(text) {
    dot.style.animation = 'none';
    banner.style.background = '#ecfdf5'; banner.style.color = '#065f46';
    msg.textContent = text;
  }
  function fail(text) {
    dot.style.animation = 'none';
    banner.classList.add('err');
    msg.textContent = text;
  }

  try {
    const html = el.innerHTML;
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      const blob = new Blob([html], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      ok('✓ 富文本已写入剪切板，可直接粘贴到微信公众号编辑器。');
      return;
    }
    // Fallback: selection + execCommand
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const res = document.execCommand('copy');
    sel.removeAllRanges();
    if (res) { ok('✓ 已复制（兼容模式）。'); }
    else { fail('execCommand 复制失败，请手动全选内容区域后复制 (Ctrl+A, Ctrl+C)。'); }
  } catch (e) {
    fail('自动复制失败（' + e.message + '），请手动全选内容区域后复制 (Ctrl+A, Ctrl+C)。');
  }
})();
</script>
</body>
</html>`;
}

function openInBrowser(filepath) {
  const url = 'file://' + filepath;
  const plat = process.platform;
  const cmd  = plat === 'darwin' ? `open "${url}"`
             : plat === 'win32'  ? `start "" "${url}"`
             : `xdg-open "${url}"`;
  exec(cmd, (err) => { if (err) process.stderr.write('open browser error: ' + err.message + '\n'); });
}

/* ═══════════════════════════════════════════════════════════
   MCP Server
═══════════════════════════════════════════════════════════ */
const server = new Server(
  { name: 'markdown-to-weixin', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ── List tools ───────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'convert_markdown_to_weixin',
      description:
        '将 Markdown 转换为适合微信公众号的内联样式 HTML，并自动打开预览页面将富文本写入系统剪切板。'
        + '写入完成后可直接粘贴（Ctrl+V / Cmd+V）到微信公众号编辑器。',
      inputSchema: {
        type: 'object',
        required: ['markdown'],
        properties: {
          markdown: {
            type: 'string',
            description: '要转换的 Markdown 内容',
          },
          theme: {
            type: 'string',
            enum: ['default', 'tech', 'literary', 'magazine'],
            description: '排版主题：literary（文艺清新，默认）| default（默认简洁）| tech（科技感）| magazine（现代杂志）',
            default: 'literary',
          },
          accent_color: {
            type: 'string',
            description: '覆盖主色，十六进制格式，如 #07c160',
          },
          font_size: {
            type: 'number',
            description: '覆盖基础字号（px），建议 13–19',
          },
          line_height: {
            type: 'number',
            description: '覆盖行高倍数，建议 1.4–2.2',
          },
          open_browser: {
            type: 'boolean',
            description: '是否打开浏览器自动写入剪切板（默认 true）',
            default: true,
          },
        },
      },
    },
  ],
}));

// ── Call tool ────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name !== 'convert_markdown_to_weixin') {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }

  const {
    markdown,
    theme = 'literary',
    accent_color,
    font_size,
    line_height,
    open_browser = true,
  } = args;

  if (!markdown || !markdown.trim()) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'markdown 参数不能为空' }],
    };
  }

  // Build overrides
  const overrides = {};
  if (accent_color) overrides.accentColor = accent_color;
  if (font_size)    overrides.fontSize    = Number(font_size);
  if (line_height)  overrides.lineHeight  = Number(line_height);

  // Convert
  const html = convertMarkdown(markdown, theme, overrides);
  const charCount = html.length;
  const mdLines   = markdown.split('\n').length;

  let clipboardNote = '';

  if (open_browser) {
    // Write temp file and open in browser
    const tmpPath = join(tmpdir(), `weixin-${Date.now()}.html`);
    writeFileSync(tmpPath, buildAutoClipPage(html), 'utf8');
    openInBrowser(tmpPath);
    clipboardNote = '\n\n已在浏览器中打开预览页面，富文本正在自动写入剪切板。页面加载后即可粘贴到微信公众号编辑器。';
  }

  return {
    content: [
      {
        type: 'text',
        text:
          `转换完成。\n` +
          `• 主题：${THEMES[theme]?.name || theme}\n` +
          `• 输入：${mdLines} 行 / ${markdown.length} 字符\n` +
          `• 输出：${charCount} 字符（带内联样式 HTML）` +
          clipboardNote,
      },
      {
        type: 'text',
        text: html,
      },
    ],
  };
});

// ── Start ────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
