#!/usr/bin/env python3
"""Draw the app icons (a calendar on a purple tile) as PNG files, without dependencies.

Usage: python3 scripts/make_icons.py
"""

import struct
import zlib
from pathlib import Path

ICONS = Path(__file__).resolve().parent.parent / "icons"

# Uni Hub palette
BG = (118, 80, 255)  # --purple
PAPER = (255, 255, 255)
HEADER = (20, 184, 166)  # --teal
CELL = (230, 222, 253)  # --purple-icon-bg
TODAY = (245, 158, 11)  # --orange
SS = 4  # supersampling per axis


def rounded(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def shapes(maskable):
    """Shapes in unit coordinates (0..1), painted in order."""
    out = []
    if maskable:
        out.append(((0, 0, 1, 1, 0), BG))
        s, o = 0.62, 0.19  # keep the drawing inside the maskable safe zone
    else:
        out.append(((0.0, 0.0, 1.0, 1.0, 0.22), BG))
        s, o = 0.70, 0.15

    def box(x0, y0, x1, y1, r):
        return (o + x0 * s, o + y0 * s, o + x1 * s, o + y1 * s, r * s)

    out.append((box(0.0, 0.08, 1.0, 1.0, 0.12), PAPER))
    out.append((box(0.0, 0.08, 1.0, 0.30, 0.12), HEADER))
    out.append((box(0.0, 0.20, 1.0, 0.30, 0.0), HEADER))
    for ring in (0.25, 0.75):
        out.append((box(ring - 0.05, 0.0, ring + 0.05, 0.18, 0.05), BG if not maskable else PAPER))
    for row in range(3):
        for col in range(4):
            x0 = 0.09 + col * 0.215
            y0 = 0.40 + row * 0.19
            color = TODAY if (row, col) == (1, 2) else CELL
            out.append((box(x0, y0, x0 + 0.16, y0 + 0.13, 0.03), color))
    return out


def render(size, maskable=False):
    rows = []
    paint = shapes(maskable)
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    x = (px + (sx + 0.5) / SS) / size
                    y = (py + (sy + 0.5) / SS) / size
                    color = None
                    for (x0, y0, x1, y1, r), c in paint:
                        if rounded(x, y, x0, y0, x1, y1, r):
                            color = c
                    if color:
                        acc[0] += color[0]
                        acc[1] += color[1]
                        acc[2] += color[2]
                        acc[3] += 255
            n = SS * SS
            a = acc[3] // n
            if a:
                cov = acc[3] / 255
                row += bytes([round(acc[0] / cov), round(acc[1] / cov), round(acc[2] / cov), a])
            else:
                row += b"\0\0\0\0"
        rows.append(bytes(row))
    return png(size, size, b"".join(rows))


def png(w, h, raw):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    ICONS.mkdir(exist_ok=True)
    for name, size, maskable in [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, True),
        ("favicon-32.png", 32, False),
    ]:
        (ICONS / name).write_bytes(render(size, maskable))
        print(f"icons/{name}")


if __name__ == "__main__":
    main()
