import { useMemo } from 'react';
import { cx } from './ui.jsx';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function safeUrl(u) {
  const url = u.trim();
  if (/^(https?:|mailto:|\/)/i.test(url)) return url;
  return '#';
}

function inline(s) {
  const codes = [];
  let out = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  out = out
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${safeUrl(u)}" target="_blank" rel="noopener noreferrer">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

/** Minimal, safe Markdown → HTML (input is HTML-escaped first). */
export function toHtml(md = '') {
  const lines = esc(md.replace(/\r\n/g, '\n')).split('\n');
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html.push(`<pre><code>${buf.join('\n')}</code></pre>`);
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      const level = Math.min(4, line.match(/^#+/)[0].length + 1);
      html.push(`<h${level}>${inline(line.replace(/^#+\s/, ''))}</h${level}>`);
      i++;
      continue;
    }
    if (/^\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().slice(1, -1).split('|').map((c) => inline(c.trim()));
      const body = rows.filter((r, idx) => !(idx === 1 && /^\|[\s:|-]+\|$/.test(r.trim())));
      const [head, ...rest] = body;
      html.push(`<table><thead><tr>${cells(head).map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rest.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (/^&gt;\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) buf.push(lines[i++].replace(/^&gt;\s?/, ''));
      html.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s/, ''));
      html.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s/, ''));
      html.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</ol>`);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|&gt;|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])) buf.push(lines[i++]);
    html.push(`<p>${inline(buf.join('<br/>'))}</p>`);
  }
  return html.join('\n');
}

export default function Markdown({ children, className }) {
  const html = useMemo(() => toHtml(children || ''), [children]);
  return <div className={cx('prose-isup', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
