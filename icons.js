/* 场次/元素/角色 的图形标识。
 *
 * 为什么不用 emoji：emoji 在不同系统上长得完全不一样（Windows 的水滴是蓝、iOS 是浅蓝、
 * 某些安卓还带阴影），而且没法统一颜色。这里用内联 SVG + 固定色值，跨平台一致。
 *
 * 为什么角色用「缩写圆牌」而不是头像：18 个头像要么从游戏里抠图（版权 + 体积），
 * 要么画得不像反而更难认。缩写牌 + 每个角色一个固定色，认「FI / CE / PS」比认小图快，
 * 也不占带宽。鼠标悬停有全名。
 */
(() => {
  'use strict';

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  /* ---------------- 元素：5 色 + 符号 ---------------- */
  /* 配色与游戏里的元素色一致（水蓝 / 火红 / 风绿 / 光金 / 暗紫），
     底色淡、符号深，保证在白底页面上仍然分得清。 */
  const ELEM = {
    water: { zh: '水', fg: '#2f7fb5', bg: '#e7f1f9' },
    fire:  { zh: '火', fg: '#c1432c', bg: '#fcece8' },
    wind:  { zh: '风', fg: '#2b8464', bg: '#e7f5ef' },
    light: { zh: '光', fg: '#a8800c', bg: '#fbf4e0' },
    dark:  { zh: '暗', fg: '#5b3f96', bg: '#efeaf9' },
  };

  const ELEM_PATH = {
    // 水滴
    water: '<path d="M12 4.6c2.9 3.4 5 6.2 5 9a5 5 0 0 1-10 0c0-2.8 2.1-5.6 5-9z"/>',
    // 火焰
    fire:  '<path d="M12 4.4c2.3 2.7 4.6 4.9 4.6 8.3a4.6 4.6 0 1 1-9.2 0c0-2 .9-3.3 1.9-4.6.3 1.4 1 2.2 2 2.5-.5-2.3.3-4.4.7-6.2z"/>',
    // 风：三道气流
    wind:  '<g fill="none" stroke-width="2" stroke-linecap="round">' +
           '<path d="M5 9h8.5a2.4 2.4 0 1 0-2.4-2.4"/>' +
           '<path d="M5 13.4h10.6"/>' +
           '<path d="M5 17.6h7a2.4 2.4 0 1 1-2.4 2.4"/></g>',
    // 星芒
    light: '<path d="M12 4.2l1.9 5.1 5.1 1.9-5.1 1.9L12 18.2l-1.9-5.1L5 11.2l5.1-1.9z"/>',
    // 月牙 + 星
    dark:  '<path d="M14.6 4.6a7.6 7.6 0 1 0 0 14.8 6.2 6.2 0 0 1 0-14.8z"/>' +
           '<path d="M17.6 6.2l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  };

  /** 元素小图标（1em 见方，跟随字号缩放）。 */
  function element(key) {
    const k = String(key || '').toLowerCase();
    const c = ELEM[k];
    if (!c) return '';
    const isLine = k === 'wind';
    return `<svg class="ei ei-${k}" viewBox="0 0 24 24" role="img" aria-label="${c.zh}元素">` +
      `<circle cx="12" cy="12" r="11" fill="${c.bg}"/>` +
      `<g fill="${isLine ? 'none' : c.fg}" stroke="${isLine ? c.fg : 'none'}">${ELEM_PATH[k]}</g>` +
      `</svg>`;
  }

  /* ---------------- 角色：18 个缩写圆牌 ---------------- */
  /* 颜色只求「彼此能分开 + 白字可读」，不代表角色的官方配色语义。 */
  const CHAR = {
    FILIA:          ['FI', '#8b5a2b'],
    CEREBELLA:      ['CE', '#b83a2b'],
    PEACOCK:        ['PE', '#a1740d'],
    PARASOUL:       ['PS', '#a33030'],
    MSFORTUNE:      ['MF', '#2f7f66'],
    PAINWHEEL:      ['PW', '#6d4a86'],
    VALENTINE:      ['VA', '#b03f63'],
    DOUBLE:         ['DO', '#3f3f47'],
    SQUIGLY:        ['SQ', '#2c7280'],
    BIGBAND:        ['BB', '#8a6320'],
    ELIZA:          ['EL', '#8e1b2e'],
    BEOWULF:        ['BW', '#6b4226'],
    ROBOFORTUNE:    ['RF', '#47688c'],
    FUKUA:          ['FU', '#5f3a94'],
    BLACKDAHLIA:    ['BD', '#2b2b33'],
    ANNIE:          ['AN', '#b8541f'],
    MARIE:          ['MA', '#6a4489'],
    UMBRELLA:       ['UM', '#a8546f'],
  };

  const ckey = n => String(n || '').toUpperCase().replace(/[^A-Z]/g, '');

  /** 角色圆牌；未知角色退回「首字母」灰牌，不要空白。 */
  function char(name) {
    if (!name) return '';
    const hit = CHAR[ckey(name)];
    const ab = hit ? hit[0] : ckey(name).slice(0, 2);
    const color = hit ? hit[1] : '#6b7280';
    return `<span class="cb" style="--c:${color}" title="${esc(name)}">${esc(ab)}</span>`;
  }

  /* ---------------- 场次类别：线性小图标 ---------------- */
  const KIND = {
    character: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6"/>',
    element:   '<path d="M12 4.5l6.5 7.5-6.5 7.5L5.5 12z"/>',
    gold:      '<circle cx="12" cy="12" r="7.2"/><path d="M12 8v1.6M12 14.4V16M10.2 10.2h3.2M10.2 13.8h3.2"/>',
    assist:    '<path d="M12 4.6l2.2 4.6 5 .7-3.6 3.6.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.9l5-.7z"/>',
    move:      '<path d="M4.8 6.2h6.4v13H4.8zM12.8 6.2h6.4v13h-6.4z"/>',
    misc:      '<circle cx="12" cy="12" r="7.2"/><path d="M12 8.4v4.2l2.8 1.8"/>',
    monthly:   '<rect x="4.6" y="6" width="14.8" height="13.2" rx="2"/><path d="M4.6 10.4h14.8M8.6 4.4v3.2M15.4 4.4v3.2"/>',
  };

  /** 类别图标：月场（不论元素/角色）统一用日历，靠后面的文字区分。 */
  function kind(tag) {
    const t = String(tag || '');
    const k = t.indexOf('monthly') === 0 ? 'monthly' : (KIND[t] ? t : 'misc');
    return `<svg class="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
      `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `${KIND[k]}</svg>`;
  }

  window.PFIcons = { element, char, kind, ELEM, CHAR, esc };
})();
