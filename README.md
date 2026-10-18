# SGM Prize Fight 场次表

Skullgirls Mobile 场次（Prize Fight）轮换与出战条件的公开数据集，配套一个静态页面：

- 站点：<https://zhiyaunhe-ops.github.io/sgm-pf/>
- 数据：`data/arenas.json`（场次目录）、`data/schedule.json`（未来 8 周排期）

存在的原因：`sgmnow`（Score Cutoffs）只给得出「当期名字」，给不出类别、出战条件与轮换依据，
而且月场、月元素这类信息经常滞后。本站把**规则**和**数据**分开：排期由公式算，条件逐条带来源。

## 图标

`icon.svg` 是主图（64 单位网格），位图由 `tools/mk_icon.py` 用同一套坐标生成：
`favicon-32.png`（老浏览器）、`apple-touch-icon.png`（180，iOS 只吃 PNG）、`icon-512.png`（分享预览）。

图形是**自绘**的骷髅心（SGM 的视觉母题），不是官方素材，只作站点标识用。
改形状要 `icon.svg` 与 `tools/mk_icon.py` 里的 `SEGS` 一起改，否则两版不一致。

## 数据文件

### `data/arenas.json`

| 字段 | 含义 |
|---|---|
| `schema` | 数据格式版本（当前 `2`，与手机端 `PfArenaTable` 兼容） |
| `updated_at` / `game_day` | 数据生成日 / 生成时的游戏日（10:00 PT 换日） |
| `monthly_slots` | hub 上月场固定占前几张卡（当前 `2`） |
| `rotation` | 锚点、角色九对顺序、元素顺序、参考性校验点 |
| `provenance` | `A/U/B/C/D` 五级来源说明 |
| `pending` | 待核实清单 |
| `arenas` | 键 = 场次名去非字母数字后的形式（`HIGH TIDE` → `HIGHTIDE`） |

每个场次：

```jsonc
{
  "name": "HIGH TIDE",
  "tag": "element",              // character / element / gold / move / assist / misc / monthly_*
  "element": "water",
  "char": null,
  "monthly": false,
  "kind": "元素场·水",
  "window": { "type": "weekend", "days": 2, "desc": "周六–周日" },
  "official": {                  // 官方口径：只写官方明文的限制
    "restriction": "无",
    "applies_to": null,
    "modifier": "PERMAFROST"
  },
  "project": {                   // 本项目（挂机脚本）用的参数，不是官方规则
    "energy": 4,
    "score_target": 50000000,
    "rule": "element:water"
  },
  "conf": "B",
  "src": ["SGM Wiki『Prize Fight』(2026-10-18 抓取)", "…"]
}
```

`from` / `until` 只出现在月场条目上（`YYYY-MM-DD`）。**两端都缺的月场不会被算进「当前开放」** ——
宁可空着，也不拿旧场地冒充当期。

### `data/schedule.json`

未来 8 周，每周一条：两段角色场、元素场、金币场、星场、招式场、当周月场。

⚠️ 页面**不直接用它**：页面按 `rotation` 里的锚点与顺序在当前时刻重算（否则过八周整表就过期了）。
这份文件仍然发布，给 APK / 其他消费者用；只在 `rotation` 缺失时页面才回退到它。

## 轮换规则

```
周序号 = ⌊(周一 − 2024-06-03) / 7⌋
角色对 = 九对[ 周序号 mod 9 ]
元素   = [水, 火, 风, 光, 暗][ 周序号 mod 5 ]
```

- 锚点 2024-06-03（周一）= Double/Squigly + Water，来自官方论坛日历帖。
- 角色场 3 天：周一–周三前者、周四–周六后者，周日空档。
- 元素场 2 天：周六–周日。
- 金币场周三开（1–2 天）；星场周五–周六；招式场周六–周日隔周（相位未确认）；月场 1 日开、整月。

## 来源分级

| 等级 | 含义 |
|---|---|
| A | 官方公告 / 官方论坛 |
| U | 用户口径（本项目内最高，对外仍非官方） |
| B | 社区 wiki |
| C | 本机实测 —— **仅作参考性校验**：场次识别链路较新，可能误识别，也可能被 hub 上残留的旧卡带偏 |
| D | 语义推定（只用于命名，不作约束依据） |

本机记录**不是权威**。权威只认官方公告；查不到就写「待核实」，不猜。

主要来源：

- 官方更新公告 <https://hub.skullgirlsmobile.com/en/updates>
- 官方论坛日历帖 <https://forum.skullgirlsmobile.com/threads/prize-fight-calendar.22233>
- Skullgirls Mobile Wiki「Prize Fight」<https://skullgirlsmobilewiki.miraheze.org/wiki/Prize_Fight>

## 更新方式

数据由挂机脚本仓库的 `tools/pf_site_export.py` 生成，不手写排期：

```bash
python tools/pf_site_export.py --out <本仓库目录> --weeks 8
git add data && git commit -m "data: 刷新场次表" && git push
```

改判定口径请改生成脚本或它的输入表（`tools/data/{arena_manual,monthly_manual,arena_rules}.json`），
不要直接改 `data/*.json` —— 下次重新生成会把手工改动覆盖掉。

## 本地预览

```bash
python -m http.server 8080
# 打开 http://127.0.0.1:8080/
```

直接双击 `index.html` 会因浏览器拦 `fetch` 而读不到数据（页面会给出提示）。

渲染冒烟测试（需要 jsdom）：`node smoke.js http://127.0.0.1:8080/`，断言当前卡片、8 行排期、
44 行目录与待核实条目都渲染出来了。

## 免责

非官方资料站，与 Autumn Games / Hidden Variable 无关。游戏内数值以客户端为准；本站只保证「来源可查」。
