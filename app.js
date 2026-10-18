/* SGM Prize Fight 场次表 — 纯前端渲染。
 * 数据源: data/arenas.json (目录) + data/schedule.json (排期)。没有硬编码排期。 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const TYPE_ORDER = ['character', 'element', 'gold', 'assist', 'move', 'misc',
                      'monthly_element', 'monthly_character', 'monthly_misc', 'unknown'];
  const TYPE_LABEL = {
    character: '角色场', element: '元素场', gold: '金币场', assist: '星助手场',
    move: '招式场', misc: '其他场', monthly_element: '元素月场',
    monthly_character: '角色月场', monthly_misc: '月场', unknown: '未识别',
  };
  const CONF_LABEL = { A: '官方', U: '用户口径', B: '社区', C: '本机参考', D: '推定' };
  const ELEM_ZH = { water: '水', fire: '火', wind: '风', light: '光', dark: '暗' };

  const fmtDay = s => (s || '').slice(5).replace('-', '/');
  const fmtScore = v => (v == null ? '无上限' : (v / 1e7) + 'kw');

  function groupOf(tag) {
    if (tag === 'monthly_element' || tag === 'monthly_character' || tag === 'monthly_misc') return 'monthly';
    return tag;
  }

  function conditionText(p) {
    if (!p) return '—';
    const bits = [`${p.energy} 钉`];
    bits.push(p.score_target == null ? '无上限' : `目标 ${fmtScore(p.score_target)}`);
    if (p.rule) bits.push(p.rule);
    return bits.join(' · ');
  }

  function restrictionText(o) {
    if (!o || !o.restriction || o.restriction === '无') return '无';
    return o.restriction;
  }

  function badge(conf) {
    const b = el('span', 'badge ' + (conf || 'D'), conf || 'D');
    b.title = CONF_LABEL[conf] || conf;
    return b;
  }

  function card(a, when) {
    const c = el('div', 'card');
    const r1 = el('div', 'row1');
    r1.append(el('span', 'name', a.name));
    r1.append(el('span', 'kind', TYPE_LABEL[a.tag] || a.tag));
    c.append(r1);
    c.append(el('div', 'when', when));

    const facts = el('div', 'facts');
    if (a.official && a.official.restriction && a.official.restriction !== '无') {
      facts.append(el('span', 'chip warn', '官方限制：' + a.official.restriction));
    } else {
      facts.append(el('span', 'chip ok', '官方限制：无'));
    }
    if (a.official && a.official.modifier) facts.append(el('span', 'chip', a.official.modifier));
    facts.append(el('span', 'chip', '本项目：' + conditionText(a.project)));
    c.append(facts);

    const src = el('div', 'src');
    const first = (a.src || []).find(s => s && s.length > 6) || '来源见 arenas.json';
    src.textContent = '依据：' + (first.length > 96 ? first.slice(0, 96) + '…' : first);
    const b = badge(a.conf);
    b.style.marginLeft = '6px';
    src.append(b);
    c.append(src);
    return c;
  }

  function openNow(data, sched) {
    const day = data.game_day;
    const out = [];
    const week = (sched.weeks || []).find(w => w.monday <= day && day <= addDays(w.monday, 6));
    if (week) {
      (week.character || []).forEach(c => {
        if (day >= c.from && day <= c.to) {
          const a = find(data, c.name);
          out.push(card(a || fallback(c.name, 'character', c.char, c),
                        `${fmtDay(c.from)} – ${fmtDay(c.to)} · ${c.char} 角色场`));
        }
      });
      const e = week.element;
      if (e && day >= e.from && day <= e.to) {
        const a = find(data, e.name);
        out.push(card(a || fallback(e.name, 'element', null, e, e.element),
                      `${fmtDay(e.from)} – ${fmtDay(e.to)} · ${ELEM_ZH[e.element] || e.element}元素场`));
      }
      const g = week.gold;
      if (g && day >= g.from && day <= g.to) {
        const c = el('div', 'card');
        c.append(row1('金币场（Medici）', '金币场'));
        c.append(el('div', 'when', `${fmtDay(g.from)} 起 · 持续 1–2 天`));
        const f = el('div', 'facts');
        f.append(el('span', 'chip ok', '官方限制：无'));
        f.append(el('span', 'chip', '本项目：4 钉 · 目标 4kw'));
        f.append(el('span', 'chip warn', '场名轮换顺序未确认'));
        c.append(f);
        c.append(el('div', 'src', '依据：SGM Wiki 金币场段（周三开）+ 排期公式'));
        out.push(c);
      }
      const s = week.assist;
      if (s && day >= s.from && day <= s.to) {
        const a = find(data, s.name);
        out.push(card(a || fallback(s.name, 'assist', null, s), `${fmtDay(s.from)} – ${fmtDay(s.to)} · 每周`));
      }
      const m = week.move;
      if (m && day >= m.from && day <= m.to) {
        const a = find(data, m.name);
        const c = card(a || fallback(m.name, 'move', null, m),
                       `${fmtDay(m.from)} – ${fmtDay(m.to)} · 隔周（相位未确认）`);
        c.querySelector('.facts').append(el('span', 'chip warn', '相位待核实'));
        out.push(c);
      }
    }
    (week && week.monthly ? week.monthly : []).forEach(mm => {
      const a = find(data, mm.name);
      if (!a) return;
      out.push(card(a, `${fmtDay(a.from || '')} – ${fmtDay(a.until || '')} · 整月`));
    });
    return out;
  }

  const addDays = (iso, n) => {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  function row1(name, kind) {
    const r = el('div', 'row1');
    r.append(el('span', 'name', name));
    r.append(el('span', 'kind', kind));
    return r;
  }

  function find(data, name) {
    if (!name) return null;
    const k = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return data.arenas[k] || null;
  }

  function fallback(name, tag, char, win, element) {
    return {
      name, tag, char: char || null, element: element || null,
      official: { restriction: '无' }, project: null, conf: 'D',
      src: ['排期公式生成的条目，目录里还没有对应记录'],
    };
  }

  function renderWeeks(sched, data) {
    const tb = $('#week-table tbody');
    const todayWeek = (sched.weeks || []).find(w => w.monday <= data.game_day && data.game_day <= addDays(w.monday, 6));
    (sched.weeks || []).forEach(w => {
      const tr = el('tr');
      if (todayWeek && w.monday === todayWeek.monday) tr.className = 'today';
      const c = w.character || [];
      tr.append(el('td', 'wk', `${fmtDay(w.monday)} 周`));
      tr.append(el('td', null, `${c[0].char} · ${c[0].name || '—'}`));
      tr.append(el('td', null, `${c[1].char} · ${c[1].name || '—'}`));
      const e = w.element || {};
      tr.append(el('td', null, `${ELEM_ZH[e.element] || e.element} · ${e.name || '—'}`));
      tr.append(el('td', 'muted', '周三起（场名轮换）'));
      tr.append(el('td', 'muted', 'Seeing Stars'));
      tr.append(el('td', 'muted', '隔周（相位未确认）'));
      tb.append(tr);
    });
  }

  function renderCatalog(data) {
    const groups = [['all', '全部']].concat(
      ['character', 'element', 'gold', 'assist', 'move', 'monthly', 'misc', 'unknown']
        .map(g => [g, g === 'monthly' ? '月场' : TYPE_LABEL[g] || g]));
    let cur = 'all', q = '';
    const filters = $('#filters');
    groups.forEach(([g, label]) => {
      const b = el('button', null, label);
      b.setAttribute('aria-pressed', String(g === 'all'));
      b.onclick = () => {
        cur = g;
        [...filters.children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        paint();
      };
      filters.append(b);
    });
    $('#q').oninput = ev => { q = ev.target.value.trim().toUpperCase(); paint(); };

    function paint() {
      const tb = $('#cat-table tbody');
      tb.innerHTML = '';
      const rows = Object.values(data.arenas).filter(a => {
        if (cur !== 'all' && groupOf(a.tag) !== cur) return false;
        if (!q) return true;
        const hay = [a.name, a.char, a.element, a.kind, a.tag].filter(Boolean).join(' ').toUpperCase();
        return hay.includes(q);
      }).sort((x, y) => {
        const ix = TYPE_ORDER.indexOf(x.tag), iy = TYPE_ORDER.indexOf(y.tag);
        return ix - iy || x.name.localeCompare(y.name);
      });
      $('#q-count').textContent = rows.length + ' 条';
      rows.forEach(a => {
        const tr = el('tr');
        tr.append(el('td', 'cat-name', a.name + (a.monthly ? '（月场）' : '')));
        tr.append(el('td', null, (TYPE_LABEL[a.tag] || a.tag) +
          (a.element ? ' · ' + (ELEM_ZH[a.element] || a.element) : '') +
          (a.char ? ' · ' + a.char : '')));
        const o = tr.appendChild(el('td'));
        o.append(restrictionText(a.official));
        if (a.official && a.official.modifier) {
          o.append(el('div', 'muted', a.official.modifier));
        }
        tr.append(el('td', null, conditionText(a.project)));
        tr.append(el('td', 'muted', a.window ? a.window.desc : '—'));
        const c = tr.appendChild(el('td'));
        c.append(badge(a.conf));
        c.title = (a.src || []).join('\n');
        tb.append(tr);
      });
    }
    paint();
  }

  function renderRotation(data) {
    const r = data.rotation || {};
    const pairs = $('#pairs');
    (r.pair_order || []).forEach(p => {
      const li = el('li');
      li.append(el('b', null, p[0] + ' / ' + p[1]));
      pairs.append(li);
    });
    const elems = $('#elems');
    (r.element_order || []).forEach((e, i) => {
      const li = el('li');
      li.append(el('b', null, (ELEM_ZH[e] || e) + '（' + e + '）'));
      li.append(document.createTextNode(' · 第 ' + (i + 1) + ' 周'));
      elems.append(li);
    });
    const box = $('#checked');
    if (!r.checked_against) return;
    box.append(el('h3', null, '项目内参考性校验'));
    const ul = el('ul', 'pending');
    r.checked_against.forEach(c => {
      const li = el('li');
      li.append(el('b', null, c.day));
      li.append(document.createTextNode(' → ' + (c.char || c.element || '') + '（与公式一致）'));
      ul.append(li);
    });
    box.append(ul);
    if (r.checked_disclaimer) box.append(el('p', 'note', r.checked_disclaimer));
  }

  function renderSources(data) {
    const box = $('#levels');
    const names = { A: 'A · 官方', U: 'U · 用户口径', B: 'B · 社区 wiki', C: 'C · 本机（仅参考）', D: 'D · 推定' };
    Object.keys(data.provenance || {}).forEach(k => {
      const d = el('div', 'level');
      const h = el('h4');
      h.append(badge(k));
      h.append(document.createTextNode(names[k] || k));
      d.append(h);
      d.append(el('p', null, data.provenance[k]));
      box.append(d);
    });
    const ul = $('#pending');
    (data.pending || []).forEach(p => {
      const li = el('li');
      li.append(el('b', null, p.item));
      li.append(document.createTextNode(' — ' + p.why));
      const b = badge(p.level || 'C');
      b.style.marginLeft = '6px';
      li.append(b);
      ul.append(li);
    });
  }

  async function main() {
    try {
      const [aRes, sRes] = await Promise.all([
        fetch('data/arenas.json', { cache: 'no-cache' }),
        fetch('data/schedule.json', { cache: 'no-cache' }),
      ]);
      if (!aRes.ok || !sRes.ok) throw new Error('HTTP ' + aRes.status + '/' + sRes.status);
      const data = await aRes.json();
      const sched = await sRes.json();

      $('#m-ver').textContent = '数据版本 ' + (data.updated_at || '—');
      $('#m-day').textContent = '游戏日 ' + (data.game_day || '—');
      $('#m-count').textContent = Object.keys(data.arenas || {}).length + ' 条场次';

      const now = openNow(data, sched);
      const box = $('#now-cards');
      box.innerHTML = '';
      if (!now.length) {
        box.append(el('div', 'empty', '按排期此刻没有开放场次（周日是角色场空档）。下一场见下方排期表。'));
      } else {
        now.forEach(c => box.append(c));
      }
      $('#now-hint').textContent = '按游戏日 ' + data.game_day + ' 计算';

      renderWeeks(sched, data);
      renderCatalog(data);
      renderRotation(data);
      renderSources(data);
    } catch (e) {
      $('#now-cards').innerHTML = '';
      const d = el('div', 'empty', '数据读取失败：' + e.message +
        '。请确认 data/arenas.json 与 data/schedule.json 存在（本地直接双击打开 index.html 时浏览器会拦 fetch，请用 http 访问）。');
      $('#now-cards').append(d);
    }
  }

  main();
})();
