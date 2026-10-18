#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成站点图标（骷髅心，SGM 风格）的位图版本。

为什么不整盘用 SVG：iOS 的 apple-touch-icon 只吃 PNG，老浏览器对 SVG favicon 也不稳。
这里用同一套坐标画 PNG，和 icon.svg 保持视觉一致（改形状要两边一起改）。

用法：  C:/Users/zhiya/anaconda3/python.exe tools/mk_icon.py
输出：  icon-512.png  apple-touch-icon.png(180)  favicon-32.png

⚠️ 描边不要用「沿多边形反复画 line」——闭合点会叠出毛刺（尖角上长出一根刺）。
   改成 mask 腐蚀：edge = mask − erode(mask)，边缘天然平滑。
"""
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

S = 512          # 输出尺寸
SS = 4           # 超采样倍数
W = S * SS
K = W / 64.0     # icon.svg 的 64 单位坐标 → 画布像素


def bez(p0, p1, p2, p3, n=200):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((
            u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
        ))
    return out


# 与 icon.svg 的 <path> 一一对应的绝对坐标段
SEGS = [
    ((32, 58.5),   (32, 58.5),   (5.2, 42.2),  (5.2, 23.9)),
    ((5.2, 23.9),  (5.2, 14.6),  (12.4, 7.8),  (20.6, 7.8)),
    ((20.6, 7.8),  (25.6, 7.8),  (29.9, 10.2), (32, 14)),
    ((32, 14),     (34.1, 10.2), (38.4, 7.8),  (43.4, 7.8)),
    ((43.4, 7.8),  (51.6, 7.8),  (58.8, 14.6), (58.8, 23.9)),
    ((58.8, 23.9), (58.8, 42.2), (32, 58.5),   (32, 58.5)),
]


def main():
    pts = []
    for s in SEGS:
        pts += bez(*s)[:-1]
    poly = [(x * K, y * K) for x, y in pts]

    # 心形遮罩
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)

    # 垂直渐变（#e04a52 → #c2252f → #8d141d）
    col = Image.new("RGB", (1, W))
    stops = [(0.0, (224, 74, 82)), (0.55, (194, 37, 47)), (1.0, (141, 20, 29))]
    for y in range(W):
        t = y / (W - 1)
        rgb = stops[-1][1]
        for i in range(len(stops) - 1):
            a, ca = stops[i]
            b, cb = stops[i + 1]
            if a <= t <= b:
                f = (t - a) / (b - a)
                rgb = tuple(int(ca[j] + (cb[j] - ca[j]) * f) for j in range(3))
                break
        col.putpixel((0, y), rgb)

    icon = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    icon.paste(col.resize((W, W)), (0, 0), mask)
    d = ImageDraw.Draw(icon)

    def ell(cx, cy, rx, ry, fill):
        d.ellipse([(cx - rx) * K, (cy - ry) * K, (cx + rx) * K, (cy + ry) * K], fill=fill)

    # 眼窝
    for cx in (23.2, 40.8):
        ell(cx, 26.8, 6.3, 7.6, (27, 6, 9, 255))
    # 鼻腔
    d.polygon([(x * K, y * K) for x, y in ((32, 33.6), (35.3, 39.2), (28.7, 39.2))],
              fill=(27, 6, 9, 255))
    # 下颌牙列
    for x, y, w, h in ((24.4, 42.4, 3.1, 6.4), (30.4, 43.2, 3.1, 6.4), (36.5, 42.4, 3.1, 6.4)):
        d.rounded_rectangle([x * K, y * K, (x + w) * K, (y + h) * K],
                            radius=1.5 * K, fill=(246, 233, 234, 242))
    # 眼窝高光（小尺寸下不至于糊成两块黑）
    for cx in (21.2, 38.8):
        ell(cx, 24.2, 1.7, 1.9, (255, 255, 255, 217))

    # 左上柔光，只落在心形内部
    glow = Image.new("L", (W, W), 0)
    ImageDraw.Draw(glow).ellipse(
        [(19 - 9) * K, (14.5 - 7) * K, (19 + 9) * K, (14.5 + 7) * K], fill=110)
    glow = Image.composite(glow.filter(ImageFilter.GaussianBlur(6 * K)),
                           Image.new("L", (W, W), 0), mask)
    icon = Image.composite(Image.new("RGBA", (W, W), (255, 255, 255, 255)), icon, glow)
    icon.putalpha(mask)

    # 描边：腐蚀取内侧环（别用反复画线，尖角会出毛刺）
    inner = mask
    for _ in range(4):
        inner = inner.filter(ImageFilter.MinFilter(21))
    edge = Image.composite(mask, Image.new("L", (W, W), 0),
                           inner.point(lambda v: 255 - v))
    icon = Image.composite(Image.new("RGBA", (W, W), (90, 12, 18, 255)), icon, edge)
    icon.putalpha(mask)

    for name, size in (("icon-512.png", 512), ("apple-touch-icon.png", 180),
                       ("favicon-32.png", 32)):
        icon.resize((size, size), Image.LANCZOS).save(os.path.join(HERE, name))
        print("wrote", name)


if __name__ == "__main__":
    main()
