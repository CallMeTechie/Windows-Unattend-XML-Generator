#!/usr/bin/env python3
"""Erzeugt icon-source.png (1024x1024) als Quelle fuer `tauri icon`.

Rein geometrisch (kein Font noetig): ein abgerundetes Quadrat in Windows-Blau
mit einem weissen Dokument-Symbol (umgeknickte Ecke + Textzeilen). Einmalig
ausfuehren; `tauri icon icon-source.png` leitet daraus alle App-Icon-Groessen ab.
"""
from PIL import Image, ImageDraw

SIZE = 1024
BG = (0, 120, 212, 255)        # Windows-Blau #0078D4
BG_DARK = (0, 90, 158, 255)    # leichte Tiefe
DOC = (255, 255, 255, 255)
LINE = (0, 120, 212, 255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Abgerundetes Quadrat als Kachel.
margin = 64
d.rounded_rectangle([margin, margin, SIZE - margin, SIZE - margin],
                    radius=180, fill=BG)
# Dezenter unterer Streifen fuer etwas Tiefe.
d.rounded_rectangle([margin, SIZE - margin - 150, SIZE - margin, SIZE - margin],
                    radius=180, fill=BG_DARK)
d.rectangle([margin, margin + 180, SIZE - margin, SIZE - margin - 180], fill=BG)

# Weisses Dokument mit umgeknickter oberer rechter Ecke.
left, top, right, bottom = 340, 280, 684, 744
fold = 96
d.polygon([
    (left, top), (right - fold, top), (right, top + fold),
    (right, bottom), (left, bottom)
], fill=DOC)
# Umgeknickte Ecke (etwas dunkler).
d.polygon([(right - fold, top), (right, top + fold), (right - fold, top + fold)],
          fill=(214, 228, 246, 255))

# Textzeilen auf dem Dokument.
ly = top + 150
for i in range(4):
    w = 244 if i < 3 else 150
    d.rounded_rectangle([left + 50, ly, left + 50 + w, ly + 28], radius=14, fill=LINE)
    ly += 78

img.save("icon-source.png")
print("icon-source.png geschrieben (%dx%d)" % (SIZE, SIZE))
