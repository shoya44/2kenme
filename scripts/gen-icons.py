#!/usr/bin/env python3
"""PWAのアイコンを生成する。

    python3 scripts/gen-icons.py

デザインは差し色（--accent）の地に濃色（--bg）の「つ」。
ホーム画面のサイズで最も読めるため濃地ではなく差し色地にしている。

出力:
    public/icon-192.png            manifest用（角丸）
    public/icon-512.png            manifest用（角丸）
    public/icon-maskable-512.png   maskable用（全面・セーフゾーン内に文字）
    public/apple-touch-icon.png    iOS用（180px・角丸なし・不透明）

iOSはapple-touch-iconの透明部分を黒として描画し、角丸も自前でかけるため、
不透明かつ角丸なしの正方形で書き出す。
"""

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"
BG = (17, 18, 20)  # --bg #111214
ACCENT = (215, 194, 160)  # --accent #D7C2A0
GLYPH = "つ"


def draw_icon(size: int, *, radius_ratio: float, glyph_ratio: float) -> Image.Image:
    """不透明な正方形に「つ」を中央寄せで描く。"""
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)

    if radius_ratio > 0:
        d.rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=ACCENT
        )
    else:
        d.rectangle([0, 0, size, size], fill=ACCENT)

    font = ImageFont.truetype(FONT, int(size * glyph_ratio))
    box = d.textbbox((0, 0), GLYPH, font=font)
    x = (size - (box[2] - box[0])) / 2 - box[0]
    y = (size - (box[3] - box[1])) / 2 - box[1]
    d.text((x, y), GLYPH, font=font, fill=BG)

    return img


def main() -> None:
    # manifest用。マスクされない環境向けに自前で角を丸める
    draw_icon(192, radius_ratio=0.22, glyph_ratio=0.60).save("public/icon-192.png")
    draw_icon(512, radius_ratio=0.22, glyph_ratio=0.60).save("public/icon-512.png")

    # maskable。安全領域（内側80%の円）に収まるよう文字を小さめにする
    draw_icon(512, radius_ratio=0, glyph_ratio=0.46).save("public/icon-maskable-512.png")

    # iOS。角丸なし・不透明
    draw_icon(180, radius_ratio=0, glyph_ratio=0.60).save("public/apple-touch-icon.png")

    print("public/ にアイコンを書き出しました")


if __name__ == "__main__":
    main()
