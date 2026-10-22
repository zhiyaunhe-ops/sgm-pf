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

  /* ---------------- 图形标识 ----------------
   * 全部来自 icons.js 的 window.PFIcons（内联 SVG / 缩写圆牌）。这里是唯一的拼装点，
   * 别在别处再拼一遍 HTML。icons.js 没载入时降级为纯文字，不报错。 */
  const ICONS = window.PFIcons || null;
  /* ⚠️ 必须当场调用，不能写成 `const esc = s => (ICONS && ICONS.esc) || ...`
   *    —— 那样返回的是函数本身，塞进模板串会渲染成源码。 */
  const esc = s => (ICONS ? ICONS.esc(s) : String(s == null ? '' : s));
  const ico = html => {
    const s = el('span', 'ico');
    s.innerHTML = html || '';
    return s;
  };
  const charBadge = n => (ICONS ? ICONS.char(n) : '');
  const elemIcon = e => (ICONS ? ICONS.element(e) : '');
  const kindIcon = t => (ICONS ? ICONS.kind(t) : '');

  /** 这张场次属于「谁」：角色场给角色牌，元素场给元素图标，其余空。 */
  function whoBadge(a) {
    if (a.tag === 'character' || a.tag === 'monthly_character') return charBadge(a.char);
    if (a.tag === 'element' || a.tag === 'monthly_element') return elemIcon(a.element);
    return '';
  }

  function card(a, when) {
    const c = el('div', 'card');
    const r1 = el('div', 'row1');
    const nm = el('span', 'nm');
    const wb = whoBadge(a);
    if (wb) nm.append(ico(wb));
    nm.append(el('span', 'name', a.name));
    r1.append(nm);
    const kd = el('span', 'kind');
    const ki = ico(kindIcon(a.tag));
    if (ki.innerHTML) kd.append(ki);
    kd.append(document.createTextNode(TYPE_LABEL[a.tag] || a.tag));
    r1.append(kd);
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


  /* ---------------- 排期：前端按公式算 ----------------
   * 为什么不在页面里直接用 schedule.json：那份是**生成时**算的 8 周快照，
   * 过几周就整表过期（页面显示一堆过去的日期）。轮换公式是稳定的，放前端算，
   * 页面就永远不会「因为没重新生成而看起来坏掉」。
   * schedule.json 仍发布（给 APK / 别的消费者），这里只在缺 rotation 时兜底。 */

  /** 当前游戏日 (YYYY-MM-DD)：太平洋时间 - 10 小时。10:00 PT 换日。 */
  function currentGameDay() {
    try {
      const pt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const d = new Date(pt.getTime() - 10 * 3600 * 1000);
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    } catch (e) {
      return new Date().toISOString().slice(0, 10);   // 拿不到时区就退 UTC（只是高亮错一天）
    }
  }

  const DAY = 86400000;
  const toUTC = iso => new Date(iso + 'T00:00:00Z').getTime();
  const toISO = ms => new Date(ms).toISOString().slice(0, 10);

  /**
   * 金币场实测窗口查表。
   *
   * rotation.gold_windows 只装**实测过**的窗口（由 sgmnow 当日快照产出），
   * 没测到的周查不到 ⇒ 场名留空，宁可空着也不拿别周的场名顶替。
   */
  function goldWindow(data, iso) {
    const ws = (data.rotation && data.rotation.gold_windows) || [];
    return ws.find(w => w.from <= iso && iso <= w.to) || null;
  }

  /**
   * 逐日排期（**按天算，不是按周算**）。
   *
   * 一周里每天开放的场次并不一样：角色场周一–周三一个角色、周四–周六换一个，
   * 周日空档；元素场只在周六日；金币场周三起；星场周五–周六。所以这里以「天」为单位。
   * 全部由 rotation 里的锚点与顺序推出来，不读任何快照 —— 页面自然不会过期。
   */
  function buildDays(data, day, n) {
    const rot = data.rotation;
    if (!rot || !rot.anchor || !(rot.pair_order || []).length) return null;
    const anchor = toUTC(rot.anchor);
    const pairs = rot.pair_order, elems = rot.element_order;
    const arenas = Object.values(data.arenas);
    const charArena = c => {
      const h = arenas.find(a => a.tag === 'character' && a.char === c);
      return h ? h.name : '';
    };
    const elemArena = e => {
      const h = arenas.find(a => a.tag === 'element' && a.element === e);
      return h ? h.name : '';
    };
    const monthlies = arenas.filter(a => a.monthly && a.from && a.until);
    const wdName = '一二三四五六日';

    const start = toUTC(day);
    const out = [];
    for (let i = 0; i < n; i++) {
      const ms = start + i * DAY;
      const iso = toISO(ms);
      const wd = (new Date(ms).getUTCDay() + 6) % 7;          // 0 = 周一
      const mon = ms - wd * DAY;
      const w = Math.round((mon - anchor) / (7 * DAY));
      const pair = pairs[((w % pairs.length) + pairs.length) % pairs.length];
      const elem = elems[((w % elems.length) + elems.length) % elems.length];
      const open = [];
      if (wd <= 2) open.push({ type: 'character', char: pair[0], name: charArena(pair[0]), slot: '周一–周三' });
      else if (wd <= 5) open.push({ type: 'character', char: pair[1], name: charArena(pair[1]), slot: '周四–周六' });
      if (wd >= 5) open.push({ type: 'element', element: elem, name: elemArena(elem) });
      if (wd === 2 || wd === 3) {
        const gw = goldWindow(data, iso);
        open.push({ type: 'gold', name: gw ? gw.arena : null,
                    variant: gw ? gw.variant : null, basis: gw ? gw.basis : null });
      }
      if (wd === 4 || wd === 5) open.push({ type: 'assist', name: 'SEEING STARS' });
      /* 招式场：官方写「隔周、周六–周日」。相位没有长期记录，用 rotation.move_off_weekend
       * （实测没开的那个周末）当锚点推隔周 —— 标「候选」而不是「开放」：
       * 用户 2026-10-18 口径「算错了说明下周可能会出现」，所以要留在表里，但必须说清是推算。 */
      if (wd >= 5 && rot.move_off_weekend) {
        const sat = ms - (wd - 5) * DAY;
        const weeks = Math.round((sat - toUTC(rot.move_off_weekend)) / (7 * DAY));
        if (((weeks % 2) + 2) % 2 === 1) {
          open.push({ type: 'move', name: 'SHOW ME YOUR MOVES', candidate: true });
        }
      }
      monthlies.filter(m => m.from <= iso && iso < m.until)
        .forEach(m => open.push({ type: m.tag, name: m.name, element: m.element, until: m.until }));
      out.push({ date: iso, weekday: wdName[wd], open });
    }
    return out;
  }

  /** 缺 rotation 时的兜底：用生成时导出的逐日快照（只在 >= 今天 的部分）。 */
  function daysFromJson(daily, today, n) {
    if (!daily || !daily.length) return [];
    return daily.filter(d => d.date >= today).slice(0, n);
  }

  function openNow(data, days) {
    const today = days.find(d => d.date === data.game_day) || days[0];
    if (!today) return [];
    return today.open.map(o => {
      if (o.type === 'gold') {
        const c = el('div', 'card');
        c.append(row1(o.name ? `金币场 · ${o.name}` : '金币场（Medici）', '金币场', 'gold'));
        c.append(el('div', 'when', '周三–周四 · 持续 2 天'));
        const f = el('div', 'facts');
        f.append(el('span', 'chip ok', '官方限制：无'));
        f.append(el('span', 'chip', '本项目：4 钉 · 目标 4kw'));
        if (o.name) {
          f.append(el('span', 'chip ok', '实测变体：' + (o.variant || '—')));
        } else {
          f.append(el('span', 'chip warn', '场名轮换顺序未确认'));
        }
        c.append(f);
        c.append(el('div', 'src', o.basis
          || '依据：SGM Wiki 金币场段（周三开）+ 轮换公式'));
        return c;
      }
      const a = find(data, o.name) || fallback(o.name, o.type, o.char, null, o.element);
      let when = o.slot ? `今日在窗口内 · ${o.slot}` : '今日在窗口内';
      if (o.candidate) when = '隔周候选 · 按上一周末未开推算（非官方确认）';
      if (o.until) when = `${fmtDay(a.from || '')} – ${fmtDay(o.until)} · 整月`;
      const c = card(a, when);
      if (o.candidate) c.querySelector('.facts').append(el('span', 'chip warn', '候选：相位按推算，未必开'));
      return c;
    });
  }

  const addDays = (iso, n) => {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  function row1(name, kindLabel, tag) {
    const r = el('div', 'row1');
    const nm = el('span', 'nm');
    if (tag) nm.append(ico(kindIcon(tag)));
    nm.append(el('span', 'name', name));
    r.append(nm);
    r.append(el('span', 'kind', kindLabel));
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

  /** 逐日表：一行 = 一天，空格 = 当天不开。 */
  function renderDays(days, data) {
    const tb = $('#day-table tbody');
    days.forEach(d => {
      const tr = el('tr');
      if (d.date === data.game_day) tr.className = 'today';
      tr.append(el('td', 'wk', `${fmtDay(d.date)} 周${d.weekday}`));

      const bucket = { character: [], element: [], gold: [], assist: [], move: [], monthly: [] };
      d.open.forEach(o => {
        const k = o.type.indexOf('monthly') === 0 ? 'monthly' : o.type;
        (bucket[k] || (bucket[k] = [])).push(o);
      });
      /* fmt 返回 HTML（图标 + 文字），由这里塞进去 —— 所以 fmt 里每个动态值都要 esc()。
       * ⚠️ 不能用 el('div', cls, fmt(o))：el 的第三个参数走 textContent，HTML 会被转义成
       *    源码文本（这一版就踩过，表格里显示一堆 <span class="cb">）。 */
      const put = (key, fmt) => {
        const td = tr.appendChild(el('td'));
        if (!bucket[key].length) { td.className = 'muted'; td.textContent = '—'; return; }
        bucket[key].forEach(o => {
          const line = el('div', o.candidate ? 'muted' : null);
          line.innerHTML = fmt(o);
          td.append(line);
        });
      };
      put('character', o => charBadge(o.char) + `<span class="nmx">${esc(o.name || '—')}</span>`);
      put('element', o => elemIcon(o.element) +
        `<span class="nmx">${esc(o.name || '—')}</span>`);
      put('gold', o => o.name
        ? `${esc(o.name)}<span class="muted"> · ${esc(o.variant || '变体未知')}</span>`
        : 'Medici（场名轮换）');
      put('assist', () => 'Seeing Stars');
      put('move', o => (o.candidate ? '隔周候选（推算）' : 'Show Me Your Moves'));
      put('monthly', o => (o.element ? elemIcon(o.element) : '') +
        `<span class="nmx">${esc(o.name)}</span>`);
      tb.append(tr);
    });
  }

  /** 图例：元素五色圆标 + 角色缩写牌说明（图标含义只在这里讲一次）。 */
  function renderLegend() {
    const box = $('#legend');
    if (!box) return;
    if (!ICONS) { box.remove(); return; }
    box.append(el('span', 'lg-label', '元素'));
    ['water', 'fire', 'wind', 'light', 'dark'].forEach(k => {
      const it = el('span', 'lg-item');
      it.append(ico(elemIcon(k)));
      it.append(el('span', null, ELEM_ZH[k] || k));
      box.append(it);
    });
    box.append(el('span', 'lg-sep'));
    box.append(el('span', 'lg-label', '角色'));
    const demo = el('span', 'lg-item');
    demo.append(ico(charBadge('Parasoul')));
    demo.append(el('span', null, '缩写牌（悬停看全名，九对循环见「轮换规则」）'));
    box.append(demo);
  }

  function renderCatalog(data) {
    const groups = [['all', '全部']].concat(
      ['character', 'element', 'gold', 'assist', 'move', 'monthly', 'misc', 'unknown']
        .map(g => [g, g === 'monthly' ? '月场' : TYPE_LABEL[g] || g]));
    let cur = 'all', q = '';
    const filters = $('#filters');
    groups.forEach(([g, label]) => {
      const b = el('button');
      if (g !== 'all') b.innerHTML = kindIcon(g);
      b.append(document.createTextNode(label));
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
        const info = tr.appendChild(el('td'));
        info.innerHTML = kindIcon(a.tag) +
          `<span class="kl">${esc(TYPE_LABEL[a.tag] || a.tag)}</span>` +
          (a.element ? elemIcon(a.element) +
            `<span class="kl">${esc(ELEM_ZH[a.element] || a.element)}</span>` : '') +
          (a.char ? charBadge(a.char) + `<span class="kl">${esc(a.char)}</span>` : '');
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
      /* 这里是图标的「字典」：徽章 + 全名并排，后面表格里只出现缩写牌时能回来对。 */
      p.forEach((c, i) => {
        if (i) li.append(document.createTextNode(' / '));
        li.append(ico(charBadge(c)));
        li.append(el('span', 'kl', c));
      });
      pairs.append(li);
    });
    const elems = $('#elems');
    (r.element_order || []).forEach((e, i) => {
      const li = el('li');
      li.append(ico(elemIcon(e)));
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
      const fallback = await sRes.json();

      /* 排期以「此刻按公式算」为准；只有缺 rotation 时才退回生成时的那份快照。 */
      const today = currentGameDay();
      /* 逐日：优先按公式现算；缺 rotation 才退回导出的快照。 */
      const days = buildDays(data, today, 14) || daysFromJson(fallback.daily, today, 14);
      data.game_day = today;

      $('#m-ver').textContent = '数据版本 ' + (data.updated_at || '—');
      $('#m-day').textContent = '游戏日 ' + today;
      $('#m-count').textContent = Object.keys(data.arenas || {}).length + ' 条场次';

      const now = openNow(data, days);
      const box = $('#now-cards');
      box.innerHTML = '';
      if (!now.length) {
        box.append(el('div', 'empty', '按排期此刻没有开放场次（周日是角色场空档）。下一场见下方排期表。'));
      } else {
        now.forEach(c => box.append(c));
      }
      $('#now-hint').textContent = '按游戏日 ' + data.game_day + ' 计算';

      renderDays(days, data);
      renderLegend();
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
