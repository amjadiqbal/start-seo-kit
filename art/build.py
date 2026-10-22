#!/usr/bin/env python3
"""Generate the start-seo-kit art SVGs (TanStack-channel family template)."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
FONT = "Helvetica, Arial, sans-serif"
TITLE = "Start SEO Kit"
SUB = "Meta, sitemaps, JSON-LD and OG images for TanStack Start"
CHIPS = ["typed head()", "sitemap + robots", "JSON-LD", "OG image route"]
REPO = "amjadiqbal/start-seo-kit"

THEMES = {
    "dark": dict(bg1="#0B1220", bg2="#111C33", title="#F8FAFC", accent="#34D399",
                 chip="#16213A", chipst="#24324F", chiptx="#CBD5E1", foot="#64748B",
                 node="#1E293B", nodetx="#94A3B8", line="#334155"),
    "light": dict(bg1="#F8FAFC", bg2="#EEF2F7", title="#0F172A", accent="#059669",
                  chip="#FFFFFF", chipst="#CBD5E1", chiptx="#334155", foot="#64748B",
                  node="#FFFFFF", nodetx="#475569", line="#CBD5E1"),
}

# Icon: a search-result card (URL, green title, snippet) under a magnifier,
# with a small sitemap tree in the corner. Always on its dark tile.
ICON_BODY = """
    <rect width="512" height="512" rx="112" fill="url(#iconbg)"/>
    <rect x="56" y="96" width="400" height="236" rx="32" fill="#1E293B"/>
    <circle cx="96" cy="140" r="14" fill="#34D399"/>
    <rect x="122" y="132" width="150" height="16" rx="8" fill="#64748B"/>
    <rect x="84" y="178" width="300" height="30" rx="15" fill="#34D399"/>
    <rect x="84" y="230" width="336" height="14" rx="7" fill="#475569"/>
    <rect x="84" y="262" width="250" height="14" rx="7" fill="#475569"/>
    <circle cx="346" cy="352" r="78" fill="#0B1220" fill-opacity="0.55" stroke="#F8FAFC" stroke-width="22"/>
    <path d="M318 352 l20 20 l36 -40" fill="none" stroke="#34D399" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M402 410 L446 454" stroke="#F8FAFC" stroke-width="30" stroke-linecap="round"/>
    <g stroke="#34D399" stroke-width="6" fill="none" stroke-linecap="round">
      <path d="M110 372 V430 M110 400 H150 M110 430 H150"/>
    </g>
    <rect x="94" y="352" width="32" height="24" rx="6" fill="#34D399"/>
    <rect x="150" y="390" width="56" height="20" rx="6" fill="#334155"/>
    <rect x="150" y="420" width="56" height="20" rx="6" fill="#334155"/>
"""

ICON_DEFS = """
    <linearGradient id="iconbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#0E2A2A"/>
    </linearGradient>"""


def bg_defs(t):
    return f"""
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{t['bg1']}"/>
      <stop offset="100%" stop-color="{t['bg2']}"/>
    </linearGradient>"""


def chips(t, x, y, h, size, widths, gap):
    out = [f'<g font-family="{FONT}" font-size="{size}" font-weight="600" fill="{t["chiptx"]}" text-anchor="middle">']
    for label, w in zip(CHIPS, widths):
        out.append(f'<g transform="translate({x},{y})"><rect width="{w}" height="{h}" rx="{h/2}" '
                   f'fill="{t["chip"]}" stroke="{t["chipst"]}"/><text x="{w/2}" y="{h*0.66:.2f}">{label}</text></g>')
        x += w + gap
    out.append("</g>")
    return "".join(out)


def sitemap_motif(t, ox, oy):
    """Root '/' fanning out to three routes, one with a dynamic child: the sitemap."""
    a, n, nt, ln = t["accent"], t["node"], t["nodetx"], t["line"]
    p = [f'<g transform="translate({ox},{oy})" font-family="{FONT}" font-weight="700" text-anchor="middle">']
    p.append(f'<path d="M60 40 V70 H170 M60 70 H-50 M60 70 V100 M170 70 V100 M-50 70 V100 M170 140 V170" '
             f'fill="none" stroke="{ln}" stroke-width="3"/>')
    p.append(f'<rect x="30" y="10" width="60" height="32" rx="10" fill="{a}"/>'
             f'<text x="60" y="32" font-size="17" fill="#0B1220">/</text>')
    for cx, label in [(-50, "/blog"), (60, "/docs"), (170, "/shop")]:
        p.append(f'<rect x="{cx-48}" y="100" width="96" height="40" rx="10" fill="{n}" stroke="{ln}"/>'
                 f'<text x="{cx}" y="126" font-size="16" fill="{nt}">{label}</text>')
    p.append(f'<rect x="112" y="170" width="116" height="36" rx="10" fill="none" stroke="{a}" stroke-width="2.5" stroke-dasharray="6 5"/>'
             f'<text x="170" y="194" font-size="15" fill="{a}">$productId</text>')
    p.append("</g>")
    return "".join(p)


def banner(name, t):
    svg = f"""<svg width="1200" height="300" viewBox="0 0 1200 300" xmlns="http://www.w3.org/2000/svg">
  <defs>{bg_defs(t)}{ICON_DEFS}
  </defs>
  <rect width="1200" height="300" fill="url(#bg)"/>
  <g transform="translate(60,75) scale(0.29297)">{ICON_BODY}</g>
  <text x="235" y="150" font-family="{FONT}" font-size="72" font-weight="700" fill="{t['title']}">{TITLE}</text>
  <text x="238" y="192" font-family="{FONT}" font-size="22" font-weight="600" fill="{t['accent']}" letter-spacing="0.2">{SUB}</text>
  {chips(t, 238, 220, 32, 15, [128, 156, 96, 150], 10)}
  {sitemap_motif(t, 950, 30)}
  <text x="1170" y="282" text-anchor="end" font-family="{FONT}" font-size="15" fill="{t['foot']}">{REPO}</text>
</svg>
"""
    (OUT / name).write_text(svg)


def social():
    t = THEMES["dark"]
    svg = f"""<svg width="1280" height="640" viewBox="0 0 1280 640" xmlns="http://www.w3.org/2000/svg">
  <defs>{bg_defs(t)}{ICON_DEFS}
  </defs>
  <rect width="1280" height="640" fill="url(#bg)"/>
  <g transform="translate(530,64) scale(0.42969)">{ICON_BODY}</g>
  <text x="640" y="380" text-anchor="middle" font-family="{FONT}" font-size="92" font-weight="700" fill="{t['title']}">{TITLE}</text>
  <text x="640" y="432" text-anchor="middle" font-family="{FONT}" font-size="30" font-weight="600" fill="{t['accent']}" letter-spacing="0.2">{SUB}</text>
  {chips(t, 290, 478, 40, 18, [158, 192, 118, 184], 16)}
  <text x="640" y="600" text-anchor="middle" font-family="{FONT}" font-size="20" fill="{t['foot']}">github.com/{REPO}</text>
</svg>
"""
    (OUT / "social-preview.svg").write_text(svg)


def icon():
    svg = f"""<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>{ICON_DEFS}
  </defs>{ICON_BODY}</svg>
"""
    (OUT / "icon.svg").write_text(svg)


if __name__ == "__main__":
    banner("banner-dark.svg", THEMES["dark"])
    banner("banner-light.svg", THEMES["light"])
    social()
    icon()
