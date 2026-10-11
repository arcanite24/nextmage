#!/usr/bin/env python3
"""Fit sliced card pictures (card backs, art/specs/cardback.json) to their card: crop to the card, fill the exact
output size, give the edge the frame's ivory (no key-colour fringe from a keyed grid) and cut clean rounded corners,
so every back sits the same in a card slot.

    python3 art/fit_cards.py public/card-back/*.webp [--radius 0.045] [--ink #e9e4d6]
"""
import argparse
import numpy as np
from PIL import Image, ImageDraw


def fit(path, radius, ink):
    image = Image.open(path).convert('RGBA')
    width, height = image.size
    pixels = np.array(image)
    ys, xs = np.where(pixels[..., 3] > 128)
    card = image.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).resize((width, height), Image.LANCZOS)
    pixels = np.array(card)
    edge = pixels[..., 3] < 250
    pixels[edge, :3] = ink
    pixels[..., 3] = 255
    mask = Image.new('L', (width * 4, height * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width * 4 - 1, height * 4 - 1), radius=round(width * 4 * radius), fill=255)
    out = Image.fromarray(pixels)
    out.putalpha(mask.resize((width, height), Image.LANCZOS))
    out.save(path, 'WEBP', quality=90, method=6)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('files', nargs='+')
    parser.add_argument('--radius', type=float, default=0.045, help='corner radius as a share of the width')
    parser.add_argument('--ink', default='#e9e4d6', help="the frame's colour, given to the edge")
    args = parser.parse_args()
    ink = [int(args.ink[i:i + 2], 16) for i in (1, 3, 5)]
    for path in args.files:
        fit(path, args.radius, ink)
        print(path)


if __name__ == '__main__':
    main()
