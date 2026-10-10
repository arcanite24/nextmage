#!/usr/bin/env python3
"""Cut a generated grid into one fixed-size transparent WebP per cell.

    python3 art/slice.py GRID.png --cols 4 --rows 4 --ids a,b,c,... --out public/career-art/icon \
        --size 256x256 [--pad 0.06] [--align center|bottom] [--bg #ff00ff] [--sheet contact.png]

The grid is asked for with a transparent background, so each subject is a set of opaque pixels. The cell lines are
found where the subjects leave the most room (a model rarely spaces its rows exactly evenly), and every connected blob
is given to the cell its centre falls in, so a subject that strays a little over a line stays whole and a neighbour's
stray bit never ends up in the wrong icon; a blob spanning cells (two subjects drawn touching) is split along the
lines. A cell's subject is trimmed to its bounds, scaled to fit the output box less the padding, and placed centred (or
standing on the bottom edge, for busts), so every asset of a type has the same size and the same margin whatever the
model drew. An id of "-" skips that cell (a spare).

If a grid comes back opaque, the flat background (--bg, or the corner colour) is keyed out first.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def parse_size(text):
    width, height = text.lower().split('x')
    return int(width), int(height)


def hex_rgb(text):
    text = text.lstrip('#')
    return np.array([int(text[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def ensure_alpha(image, bg):
    """RGBA with a real alpha channel: the model's own, or the flat background keyed out."""
    rgba = np.array(image.convert('RGBA'), dtype=np.float32)
    alpha = rgba[..., 3]
    if (alpha < 8).mean() > 0.05:
        return rgba, False
    rgb = rgba[..., :3]
    corners = np.median(np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)]), axis=0)
    # the asked-for key colour if the corners show it, else whatever flat colour the corners are
    key = hex_rgb(bg) if bg and np.linalg.norm(corners - hex_rgb(bg)) < 60 else corners
    distance = np.linalg.norm(rgb - key, axis=-1)
    alpha = np.clip((distance - 18) / 50, 0, 1)
    # despill: edge pixels lose the key colour mixed into them
    mix = (1 - alpha)[..., None]
    rgba[..., :3] = np.clip((rgb - key * mix) / np.maximum(alpha[..., None], 0.05), 0, 255)
    rgba[..., 3] = alpha * 255
    return rgba, True


def cuts(coverage, count):
    """Where to cut between cells along one axis: near each even split, the line the subjects cover least (a model
    rarely spaces its rows exactly evenly)."""
    length = len(coverage)
    lines = [0]
    for index in range(1, count):
        expected = round(length * index / count)
        window = round(length / count * 0.18)
        low, high = max(lines[-1] + 1, expected - window), min(length - 1, expected + window)
        lines.append(low + int(np.argmin(coverage[low:high + 1])))
    lines.append(length)
    return lines


def cell_masks(alpha, cols, rows):
    """Each cell's pixels: the blobs whose centre lies in it. A blob that spans several cells (two subjects drawn
    touching) is split along the cut lines instead."""
    height, width = alpha.shape
    opaque = alpha > 24
    x_cuts, y_cuts = cuts(opaque.sum(axis=0), cols), cuts(opaque.sum(axis=1), rows)
    col_of = np.searchsorted(x_cuts, np.arange(width), side='right') - 1
    row_of = np.searchsorted(y_cuts, np.arange(height), side='right') - 1
    grid_cell = np.minimum(rows - 1, row_of)[:, None] * cols + np.minimum(cols - 1, col_of)[None, :]
    cell_w, cell_h = width / cols, height / rows
    labels, count = ndimage.label(ndimage.binary_dilation(opaque, iterations=1))
    masks = [np.zeros(alpha.shape, dtype=bool) for _ in range(cols * rows)]
    for label, box in enumerate(ndimage.find_objects(labels), start=1):
        blob = labels[box] == label
        if blob.sum() < 40:
            continue
        cells = grid_cell[box]
        span_y, span_x = box[0].stop - box[0].start, box[1].stop - box[1].start
        if span_x > cell_w * 1.25 or span_y > cell_h * 1.25:
            for index in np.unique(cells[blob]):
                masks[index][box] |= blob & (cells == index)
            continue
        cy, cx = (round(value) for value in ndimage.center_of_mass(blob))
        masks[cells[cy, cx]][box] |= blob
    return masks


def place(rgba, mask, size, pad, align):
    """The masked subject, trimmed, scaled to fit, on a transparent canvas of `size`."""
    width, height = size
    ys, xs = np.nonzero(mask & (rgba[..., 3] > 4))
    if len(xs) == 0:
        return None, None
    top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = rgba[top:bottom, left:right].copy()
    crop[..., 3] *= mask[top:bottom, left:right]
    subject = Image.fromarray(crop.clip(0, 255).astype(np.uint8), 'RGBA')
    inner_w, inner_h = width * (1 - 2 * pad), height * (1 - 2 * pad)
    scale = min(inner_w / subject.width, inner_h / subject.height)
    scaled = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', size, (0, 0, 0, 0))
    x = (width - scaled.width) // 2
    y = height - scaled.height - round(height * pad) if align == 'bottom' else (height - scaled.height) // 2
    canvas.alpha_composite(scaled, (x, y))
    edge = {
        'left': left <= 2, 'top': top <= 2, 'right': right >= rgba.shape[1] - 2, 'bottom': bottom >= rgba.shape[0] - 2,
    }
    return canvas, [side for side, hit in edge.items() if hit]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('grid')
    parser.add_argument('--cols', type=int, required=True)
    parser.add_argument('--rows', type=int, required=True)
    parser.add_argument('--ids', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--size', type=parse_size, required=True)
    parser.add_argument('--pad', type=float, default=0.06)
    parser.add_argument('--align', choices=['center', 'bottom'], default='center')
    parser.add_argument('--bg')
    parser.add_argument('--quality', type=int, default=88)
    parser.add_argument('--sheet', help='also write a contact sheet of the cut assets, on light and dark, for review')
    args = parser.parse_args()

    ids = args.ids.split(',')
    if len(ids) > args.cols * args.rows:
        sys.exit(f'{len(ids)} ids for {args.cols * args.rows} cells')
    rgba, keyed = ensure_alpha(Image.open(args.grid), args.bg)
    if keyed:
        print(f'warning: {args.grid} had no transparency; keyed out its background', file=sys.stderr)
    masks = cell_masks(rgba[..., 3], args.cols, args.rows)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    cut = []
    for index, asset_id in enumerate(ids):
        if asset_id == '-':
            continue
        image, edges = place(rgba, masks[index], args.size, args.pad, args.align)
        if image is None:
            print(f'error: cell {index + 1} ({asset_id}) is empty', file=sys.stderr)
            continue
        if edges:
            print(f'warning: {asset_id} touches the grid edge ({", ".join(edges)}); it may be cropped', file=sys.stderr)
        image.save(out / f'{asset_id}.webp', 'WEBP', quality=args.quality, method=6)
        cut.append((asset_id, image))
        print(f'{out / asset_id}.webp')
    if args.sheet and cut:
        width, height = args.size
        sheet = Image.new('RGBA', (width * len(cut), height * 2), (236, 230, 216, 255))
        sheet.paste((20, 30, 26, 255), (0, height, width * len(cut), height * 2))
        for index, (_, image) in enumerate(cut):
            sheet.alpha_composite(image, (index * width, 0))
            sheet.alpha_composite(image, (index * width, height))
        sheet.convert('RGB').save(args.sheet, quality=85)


if __name__ == '__main__':
    main()
