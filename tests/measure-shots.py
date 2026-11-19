#!/usr/bin/env python3
"""PELABUHAN SENJA — screenshot downscale + measure (part 4).

Usage:
  measure-shots.py <src.png> <dst.jpg> <quality>
      Downscale a 2560x1440 capture to 1280x720 JPEG and print JSON stats.
  measure-shots.py --report <dir>
      Print JSON stats for every .jpg in <dir> (no conversion).

Stats: bytes, dimensions, unique colours, mean brightness (0-255), vivid-pixel
fraction (saturated pixels — neon signs, sun glow, wanted stars) and warm-pixel
fraction (sun/sky oranges). A dusk shot should be bright (mean > 45) and
colourful (unique colours in the thousands); a black frame fails both.
"""
import json
import sys
from pathlib import Path

from PIL import Image


def stats(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    small = img.resize((320, 180))
    px = list(small.getdata())
    n = len(px)
    uniq = len(set(px))
    bright = sum(sum(p) / 3 for p in px) / n
    vivid = sum(1 for r, g, b in px if max(r, g, b) - min(r, g, b) > 90 and max(r, g, b) > 150) / n
    warm = sum(1 for r, g, b in px if r > 180 and 60 < g < 180 and b < 170) / n
    return {
        "file": Path(path).name,
        "bytes": Path(path).stat().st_size,
        "width": w,
        "height": h,
        "unique_colors_320": uniq,
        "mean_brightness": round(bright, 1),
        "vivid_fraction": round(vivid, 3),
        "warm_fraction": round(warm, 3),
    }


def main():
    args = sys.argv[1:]
    if len(args) == 1 and args[0] == "--report":
        print("usage: measure-shots.py --report <dir>", file=sys.stderr)
        return 2
    if len(args) == 2 and args[0] == "--report":
        out = [stats(p) for p in sorted(Path(args[1]).glob("*.jpg"))]
        print(json.dumps(out, indent=2))
        return 0
    if len(args) == 3:
        src, dst, quality = Path(args[0]), Path(args[1]), int(args[2])
        img = Image.open(src).convert("RGB")
        img = img.resize((1280, 720), Image.LANCZOS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        img.save(dst, "JPEG", quality=quality, optimize=True)
        print(json.dumps(stats(dst)))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
