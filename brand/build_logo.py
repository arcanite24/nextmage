"""
Builds Playmat's logo files in this folder from the app's own typeface (Barlow Condensed ExtraBold, outlined so the
SVGs render the same everywhere, GitHub's README included). Run from the repository root after `npm ci` in
Mage.Web.Client:  python3 brand/build_logo.py
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).parent
# the website (site/, published to GitHub Pages) carries its own copies
SITE = HERE.parent / 'site/assets/brand'
FONT = HERE.parent / 'Mage.Web.Client/node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff'

INK = '#e9e4d6'
THREAD = '#d4ccb6'
DECISION = '#f0b13d'
MAT_950 = '#070c0a'
MAT_800 = '#0f1714'
MAT_700 = '#142019'
MAT_600 = '#1c2d27'

WORD = 'PLAYMAT'
TRACKING = 46  # font units added after every letter
# optical pairs: the open sides of L, A, Y and T leave holes once tracked
KERN = {('L', 'A'): -38, ('A', 'Y'): -30, ('Y', 'M'): -8, ('A', 'T'): -30}


def mark(scale: float = 1.0, ident: str = 'pm') -> str:
    """The badge: a stitched neoprene mat holding a fanned hand, the front card's corner marked in amber."""
    return f'''<g transform="scale({scale})">
    <defs>
      <linearGradient id="{ident}-felt" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="{MAT_600}"/>
        <stop offset="1" stop-color="{MAT_800}"/>
      </linearGradient>
      <radialGradient id="{ident}-light" cx="0.32" cy="0.22" r="0.9">
        <stop offset="0" stop-color="{INK}" stop-opacity="0.10"/>
        <stop offset="0.6" stop-color="{INK}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="124" height="124" rx="28" fill="url(#{ident}-felt)"/>
    <rect x="2" y="2" width="124" height="124" rx="28" fill="url(#{ident}-light)"/>
    <rect x="2.75" y="2.75" width="122.5" height="122.5" rx="27.25" fill="none" stroke="{MAT_950}" stroke-opacity="0.6" stroke-width="1.5"/>
    <rect x="11" y="11" width="106" height="106" rx="20" fill="none" stroke="{THREAD}" stroke-opacity="0.55"
          stroke-width="2" stroke-dasharray="5.2 4.4" stroke-linecap="round"/>
    <g stroke="{INK}" stroke-width="5" stroke-linejoin="round" transform="translate(5.5 1.5)">
      <rect x="27" y="38" width="38" height="54" rx="6" fill="{MAT_800}" transform="rotate(-17 46 65)"/>
      <rect x="39" y="34" width="38" height="54" rx="6" fill="{MAT_800}" transform="rotate(-6 58 61)"/>
      <g transform="rotate(8 70 59)">
        <rect x="50" y="30" width="40" height="58" rx="6" fill="{MAT_700}"/>
        <path d="M74 36.5 L83.5 36.5 L83.5 46 Z" fill="{DECISION}" stroke="{DECISION}" stroke-width="2"/>
      </g>
    </g>
  </g>'''


def wordmark(font: TTFont, cap_height: float) -> tuple[str, float]:
    """The word as outlines, its cap height in pixels; returns the paths and their width."""
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = cap_height / font['OS/2'].sCapHeight
    x = 0.0
    paths = []
    for index, letter in enumerate(WORD):
        name = cmap[ord(letter)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        paths.append(f'<path transform="translate({x * scale:.2f} {cap_height:.2f}) scale({scale:.5f} {-scale:.5f})" d="{pen.getCommands()}"/>')
        x += glyphs[name].width
        if index < len(WORD) - 1:
            x += TRACKING + KERN.get((letter, WORD[index + 1]), 0)
    return '\n    '.join(paths), x * scale


def svg(width: float, height: float, body: str, title: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" width="{width:.0f}" '
            f'height="{height:.0f}" role="img" aria-label="{title}">\n  <title>{title}</title>\n  {body}\n</svg>\n')


def write(name: str, content: str) -> None:
    for folder in (HERE, SITE):
        folder.mkdir(parents=True, exist_ok=True)
        (folder / name).write_text(content)


def main() -> None:
    font = TTFont(FONT)
    write('playmat-mark.svg', svg(128, 128, mark(), 'Playmat'))

    # horizontal lockup: badge, then the word with its caps centred on the badge
    badge = 128
    cap = 62
    words, word_width = wordmark(font, cap)
    gap = 30
    width = badge + gap + word_width + 4
    top = (badge - cap) / 2
    for name, color in (('playmat-logo.svg', INK), ('playmat-logo-light.svg', MAT_700)):
        body = (f'{mark()}\n  <g fill="{color}" transform="translate({badge + gap} {top:.2f})">\n    {words}\n  </g>')
        write(name, svg(width, badge, body, 'Playmat'))


if __name__ == '__main__':
    main()
