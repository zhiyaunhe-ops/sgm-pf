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
    setAttribute(k, v) { n[k] = v; },
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
 'filters', 'cat-table', 'checked', 'levels', 'pending', 'pairs', 'elems', 'q', 'q-count',
 'notices', 'notices-hint', 'notices-list']
  .forEach(id => { registry['#' + id] = makeNode('div'); registry['#' + id].id = id; });
/* renderDays 找的是 '#day-table tbody'；renderCatalog 找的是 '#cat-table tbody' */
registry['#day-table tbody'] = makeNode('tbody');
registry['#day-table tbody'].id = 'day-table tbody';
registry['#day-table'].appendChild(registry['#day-table tbody']);
registry['#cat-table tbody'] = makeNode('tbody');
registry['#cat-table tbody'].id = 'cat-table tbody';
registry['#cat-table'].appendChild(registry['#cat-table tbody']);

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

  /* 金币场断言一律**按数据驱动**：只实测过 `rotation.gold_windows` 覆盖的日子，
   * 断言必须跟着那些窗口走。以前把 10/21、10/28 写死在这里，窗口滚出 14 天视图后
   * 整组断言就恒红 —— 那不是回归，是断言过期。 */
  const gdata = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'arenas.json'), 'utf8'));
  const wins = ((gdata.rotation || {}).gold_windows) || [];
  const fmtDM = s => String(s || '').slice(5).replace('-', '/');
  const today = (registry['#m-day'].textContent.match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
  const todayWin = wins.find(w => w.from <= today && today <= w.to) || null;

  if (todayWin) {
    check(cardText.includes(todayWin.arena), '今日卡片出现实测场名 ' + todayWin.arena);
    if (todayWin.variant) check(cardText.includes(todayWin.variant), '今日卡片出现实测变体 ' + todayWin.variant);
    check(cardText.includes('sgmnow'), '今日卡片给出 sgmnow 依据串');
    check(!cardText.includes('场名轮换顺序未确认'), '已实测时不再显示「场名轮换顺序未确认」');
  } else {
    console.log('SKIP  今日（' + (today || '?') + '）没有已实测的金币场窗口，跳过今日卡片金币断言');
  }

  console.log('--- 排期表 ---');
  const tb = registry['#day-table tbody'];
  check(tb.children.length === 14, '排期表 14 行（' + tb.children.length + '）');

  const rows = tb.children.map(tr => textOf(tr) + ' ' + htmlOf(tr));   // 表格列用 innerHTML 写入，两种都读
  const findRow = d => rows.find(r => r.includes(d + ' 周'));

  let hit = 0;
  wins.forEach(w => {
    const label = fmtDM(w.from);
    const row = findRow(label);
    if (!row) return;                     // 窗口不在本次 14 天视图内 ⇒ 不适用，不是失败
    hit++;
    check(row.includes(w.arena), label + '（实测窗口）显示场名 ' + w.arena);
    if (w.variant) check(row.includes(w.variant), label + ' 显示实测变体 ' + w.variant);
  });
  if (!hit) {
    console.log('SKIP  本次 14 天视图内没有已实测的金币场窗口（gold_windows 起于 ' +
      (wins.length ? wins.map(w => fmtDM(w.from)).join(' / ') : '空') + '）');
  }

  /* 反向断言：视图里出现的占位行**不得**被外推填上场名。
   * 这一条不依赖具体日期，所以永远有效。 */
  const ph = rows.filter(r => r.includes('Medici（场名轮换）'));
  if (ph.length) {
    const leaked = ph.filter(r => wins.some(w => r.includes(w.arena)));
    check(leaked.length === 0, '未实测日仍为占位文案，未被外推填名（占位 ' + ph.length + ' 行）');
  } else {
    console.log('SKIP  本次 14 天视图内没有金币场占位行（可能整段都被实测覆盖或当天不开）');
  }

  console.log('--- 版本公告 ---');
  const nv = registry['#notices-list'];
  const nvText = textOf(nv);
  check(nv.children.length === 5, '版本公告 5 条（' + nv.children.length + '）');
  check(nvText.includes('连招盛宴') && nvText.includes('暗黑丰收'), '公告渲染出 11 月两个月场名');
  check(nvText.includes('本项目判断'), '原文与判断分列');
  check(nvText.includes('待核实'), '待核实标记出现');
  check(registry['#notices-hint'].textContent.includes('8.12.0'), '标题回显公告版本号');

  console.log(fail.length ? `\n${fail.length} 项未通过` : '\n全部通过');
  process.exit(fail.length ? 1 : 0);
}, 300);
