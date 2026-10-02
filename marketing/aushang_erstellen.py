from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

URL = "https://stundly.de/register?ref=85044a3b"
OUT = r"C:\Users\bktas\Desktop\masa\Claude\workly\marketing\stundly-aushang-a4.pdf"
ACC = HexColor("#6b5cdb"); DARK = HexColor("#16151d"); MUTED = HexColor("#5b5970"); LIGHT = HexColor("#f1effd")

W, H = A4
c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle("Stundly – Aushang"); c.setAuthor("Stundly")

# Kopfband
c.setFillColor(ACC); c.rect(0, H - 34*mm, W, 34*mm, stroke=0, fill=1)
c.setFillColor(white); c.setFont("Helvetica-Bold", 22); c.drawString(18*mm, H - 21*mm, "STUNDLY")
c.setFont("Helvetica", 11); c.drawRightString(W - 18*mm, H - 21*mm, "Arbeitszeit-App für Handwerker")

# Headline
y = H - 58*mm
c.setFillColor(DARK); c.setFont("Helvetica-Bold", 30)
c.drawString(18*mm, y, "Notdienst um 3 Uhr nachts?"); y -= 12*mm
c.drawString(18*mm, y, "Einmal eintragen –"); y -= 12*mm
c.setFillColor(ACC); c.drawString(18*mm, y, "nie wieder Stunden verlieren."); y -= 12*mm
c.setFillColor(MUTED); c.setFont("Helvetica", 13)
c.drawString(18*mm, y, "Arbeitszeit, Überstunden, Urlaub und Notdienst-Einsätze am Handy –"); y -= 6.5*mm
c.drawString(18*mm, y, "am Monatsende ein fertiges PDF für den Chef.")

# Vorteile
y -= 16*mm
items = [
    ("In 10 Sekunden eingetragen", "Auch ohne Netz im Keller – wird später synchronisiert."),
    ("Notdienst mit Fotos & Kundenunterschrift", "Einsatzbericht als PDF direkt beim Kunden."),
    ("Überstunden-Konto immer aktuell", "Du siehst jederzeit, was dir zusteht."),
]
for t, d in items:
    c.setFillColor(ACC); c.circle(22*mm, y + 1.6*mm, 3.6*mm, stroke=0, fill=1)
    c.setStrokeColor(white); c.setLineWidth(1.6); c.setLineCap(1); c.setLineJoin(1)
    pth = c.beginPath(); pth.moveTo(20.2*mm, y + 1.7*mm); pth.lineTo(21.6*mm, y + 0.3*mm); pth.lineTo(24*mm, y + 3*mm)
    c.drawPath(pth, stroke=1, fill=0)
    c.setFillColor(DARK); c.setFont("Helvetica-Bold", 14); c.drawString(30*mm, y + 2*mm, t)
    c.setFillColor(MUTED); c.setFont("Helvetica", 11); c.drawString(30*mm, y - 4*mm, d)
    y -= 17*mm

# QR-Box
box_h = 92*mm; box_y = 30*mm
c.setFillColor(LIGHT); c.roundRect(14*mm, box_y, W - 28*mm, box_h, 6*mm, stroke=0, fill=1)
qs = 74*mm
w = QrCodeWidget(URL, barLevel="M"); b = w.getBounds(); bw, bh = b[2]-b[0], b[3]-b[1]
d = Drawing(qs, qs, transform=[qs/bw, 0, 0, qs/bh, 0, 0]); d.add(w)
c.setFillColor(white); c.roundRect(22*mm, box_y + 9*mm, qs, qs, 3*mm, stroke=0, fill=1)
renderPDF.draw(d, c, 22*mm, box_y + 9*mm)
tx = 22*mm + qs + 10*mm
c.setFillColor(DARK); c.setFont("Helvetica-Bold", 22)
c.drawString(tx, box_y + 68*mm, "Kostenlos")
c.drawString(tx, box_y + 59*mm, "testen")
c.setFont("Helvetica", 12); c.setFillColor(MUTED)
c.drawString(tx, box_y + 47*mm, "Handykamera auf den")
c.drawString(tx, box_y + 41*mm, "QR-Code halten –")
c.drawString(tx, box_y + 35*mm, "in 1 Minute startklar.")
c.setFillColor(ACC); c.setFont("Helvetica-Bold", 12)
c.drawString(tx, box_y + 22*mm, "Bis 31.03.2027 gratis")
c.setFillColor(MUTED); c.setFont("Helvetica", 11)
c.drawString(tx, box_y + 16*mm, "Keine Kreditkarte nötig.")
c.drawString(tx, box_y + 10*mm, "Beta-Tester: dauerhaft -50 %.")

# Fuß
c.setFillColor(MUTED); c.setFont("Helvetica", 10)
c.drawString(18*mm, 18*mm, "stundly.de")
c.drawRightString(W - 18*mm, 18*mm, "Für Betriebe: stundly.de/firma")
c.setFont("Helvetica", 8); c.drawCentredString(W/2, 10*mm, "Server in Deutschland · DSGVO-konform · kein GPS-Tracking")
c.save()

import pypdfium2 as pdfium
pdf = pdfium.PdfDocument(OUT)
pdf[0].render(scale=1.2).to_pil().save(OUT.replace(".pdf", "-vorschau.png"))
pdf[0].render(scale=3).to_pil().save(OUT.replace(".pdf","-hi.png"))
print("ok")
