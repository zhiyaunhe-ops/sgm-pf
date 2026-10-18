/* 站点冒烟测试: 用 jsdom 真跑一遍 app.js, 断言渲染结果。
 * 用法: node smoke.js <baseUrl>   (需先启动静态服务)
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://127.0.0.1:8899/';

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: base,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = async (u) => {
        const rel = new URL(u, base).pathname.replace(/^\//, '') || 'index.html';
        const body = fs.readFileSync(path.join(__dirname, rel), 'utf8');
        return { ok: true, status: 200, json: async () => JSON.parse(body) };
      };
      w.console = console;
    },
  });
  const w = dom.window;
  // 手动注入 app.js（resources:usable 对相对 src 不总是可靠）
  await new Promise(r => w.addEventListener('load', r, { once: true }));
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  w.document.body.appendChild(s);

  await new Promise(r => setTimeout(r, 1200));

  const $ = q => w.document.querySelectorAll(q);
  const err = [];
  const check = (cond, msg) => { if (!cond) err.push(msg); };

  const cards = $('.card');
  const rows = $('#day-table tbody tr');
  const cat = $('#cat-table tbody tr');
  const pending = $('ul.pending li');

  console.log('当前开放卡片:', cards.length, cards.length ? [...cards].map(c => c.querySelector('.name').textContent).join(' | ') : '');
  console.log('逐日排期行:', rows.length);
  [...rows].slice(0, 7).forEach(r => {
    console.log('  ' + [...r.children].map(td => td.textContent.replace(/\s+/g, ' ') || '—').join(' | '));
  });
  console.log('目录行:', cat.length);
  console.log('待核实:', pending.length);
  console.log('数据版本:', w.document.querySelector('#m-ver').textContent);
  console.log('游戏日:', w.document.querySelector('#m-day').textContent);

  check(cards.length >= 1, '当前开放没有卡片');
  check(rows.length === 14, '逐日排期行数不是 14 (实际 ' + rows.length + ')');
  check(cat.length === 44, '目录行数不是 44 (实际 ' + cat.length + ')');
  check(pending.length >= 3, '待核实条目过少');
  /* ⚠️ 别查 body.textContent: app.js 是当 inline <script> 注入的, 它的源码也算 textContent
   *    ⇒ 会命中 catch 分支里的那句文案 (假阳性)。只查渲染出来的容器。 */
  check(!w.document.querySelector('#now-cards').textContent.includes('数据读取失败'),
        '页面报了读取失败');

  if (err.length) {
    console.error('FAIL:\n - ' + err.join('\n - '));
    process.exit(1);
  }
  console.log('OK');
  process.exit(0);
})().catch(e => { console.error('EXC', e); process.exit(1); });
