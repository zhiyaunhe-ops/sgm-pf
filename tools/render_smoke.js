/* 站点渲染冒烟测试：用最小 DOM 打桩跑**真实的 app.js**，
 * 断言金币场卡片/表格确实出现实测场名，且未实测的周仍为空。
 * 用法: node tools/render_smoke.js        （在 sgm-pf-data 仓库根执行）
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---------- 最小 DOM ---------- */
function makeNode(tag) {
  const n = {
    tagName: String(tag).toUpperCase(),
    className: '',
    textContent: '',
    innerHTML: '',
    title: '',
    style: {},
    children: [],
    appendChild(c) { n.children.push(c); return c; },
    append(...cs) { cs.forEach(c => n.appendChild(c)); },
    remove() {},
    querySelector(sel) { return find(n, sel); },
    querySelectorAll(sel) { return [find(n, sel)].filter(Boolean); },
  };
  Object.defineProperty(n, 'firstChild', { get: () => n.children[0] || null });
  return n;
}
function find(root, sel) {
  const want = sel.replace(/^#/, '');
  const stack = root.children.slice();
  while (stack.length) {
    const c = stack.shift();
    if (c.id === want) return c;
    stack.push(...c.children);
  }
  return null;
}
const registry = {};
['now-cards', 'now-hint', 'm-ver', 'm-day', 'm-count', 'day-table', 'legend',
 'filters', 'catalog', 'checked', 'levels', 'pending', 'pairs', 'elems', 'q', 'q-count']
  .forEach(id => { registry['#' + id] = makeNode('div'); registry['#' + id].id = id; });
/* renderDays 找的是 '#day-table tbody' */
registry['#day-table tbody'] = makeNode('tbody');
registry['#day-table tbody'].id = 'day-table tbody';
registry['#day-table'].appendChild(registry['#day-table tbody']);

global.document = {
  createElement: makeNode,
  createTextNode: t => ({ nodeType: 3, textContent: String(t), children: [] }),
  querySelector: sel => registry[sel] || null,
  addEventListener() {},
};
global.window = {
  PFIcons: {
    esc: s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    char: n => `<span class="cb">${n}</span>`,
    element: e => `<span class="eb">${e}</span>`,
    kind: t => `<span class="kb">${t}</span>`,
  },
};
global.fetch = async url => {
  const p = path.join(__dirname, '..', url.replace(/^\.\//, ''));
  const body = fs.readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};

function textOf(node) {
  let s = node.textContent || '';
  (node.children || []).forEach(c => { s += ' ' + textOf(c); });
  return s;
}
function htmlOf(node) {
  let s = node.innerHTML || '';
  (node.children || []).forEach(c => { s += ' ' + htmlOf(c); });
  return s;
}

require(path.join(__dirname, '..', 'app.js'));

setTimeout(() => {
  const cards = registry['#now-cards'];
  const cardText = textOf(cards);

  const fail = [];
  const check = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) fail.push(msg); };

  console.log('--- 今日卡片 ---');
  console.log(cardText.replace(/\s+/g, ' ').trim().slice(0, 400));
  console.log('--- 金币场相关片段 ---');
  (cardText.match(/[^ ]*MEDICI[^ ]*/g) || []).forEach(s => console.log('  ', s));

  check(cardText.includes('MEDICI SHAKEDOWN'), '今日卡片出现实测场名 MEDICI SHAKEDOWN');
  check(cardText.includes('实测变体'), '今日卡片出现实测变体标记');
  check(cardText.includes('sgmnow'), '今日卡片给出 sgmnow 依据串');
  check(!cardText.includes('场名轮换顺序未确认'), '已实测时不再显示「场名轮换顺序未确认」');

  console.log('--- 排期表 ---');
  const tb = registry['#day-table tbody'];
  const dayText = textOf(tb) + ' ' + htmlOf(tb);   // 表格列用 innerHTML 写入，两种都读
  check(dayText.includes('MEDICI SHAKEDOWN'), '排期表出现实测场名');
  check(dayText.includes('Hemofilia'), '排期表出现实测变体');
  check(tb.children.length === 14, '排期表 14 行（' + tb.children.length + '）');

  /* 按行断言：实测过的两行显示场名；未实测的那两行**必须**仍是占位文案
   * （实测只覆盖已观测窗口，不许外推到下周）。 */
  const rowText = tr => textOf(tr) + ' ' + htmlOf(tr);
  const rows = tb.children.map(rowText);
  const findRow = d => rows.find(r => r.includes(d + ' 周'));
  const r21 = findRow('10/21') || '', r22 = findRow('10/22') || '';
  const r28 = findRow('10/28') || '', r29 = findRow('10/29') || '';
  check(r21.includes('MEDICI SHAKEDOWN') && !r21.includes('Medici（场名轮换）'),
    '10/21（实测窗口）显示场名、不显示占位文案');
  check(r22.includes('MEDICI SHAKEDOWN'), '10/22（同窗口次日）显示场名');
  check(r28.includes('Medici（场名轮换）') && !r28.includes('MEDICI'),
    '10/28（未实测）保留占位文案，未被外推填名');
  check(r29.includes('Medici（场名轮换）'), '10/29（未实测）保留占位文案');

  console.log(fail.length ? `\n${fail.length} 项未通过` : '\n全部通过');
  process.exit(fail.length ? 1 : 0);
}, 300);
