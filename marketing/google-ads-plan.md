# Google Ads planı — Stundly (17.11.2026)

Reklam metinleri Almanca (Google'a aynen kopyala), açıklamalar Türkçe.
Ölçüm: her reklamın linkinde `utm_…` var → Süper admin → Kokpit → **"Reklam / kampanya (utm)"** (v0.99.4).

> ⚠️ Metinler beta dönemine göre yazıldı ("Kostenlos in der Beta", "50 % weniger").
> **01.04.2027'de bu reklamları durdur/değiştir** — yoksa reklam yanlış vaat eder.

---

## 0. Hesap ayarları (bir kere)

1. ads.google.com → yeni hesap. Google "Smart Mode / Akıllı kampanya" önerirse **"Expert Mode"a geç**
   (alt kısımda küçük link). Performance Max **kullanma**.
2. Kampanya türü: **Search (Suche)**, hedef: "Website-Zugriffe".
3. **Displaynetzwerk ve Suchnetzwerk-Partner kutularını kaldır** (yoksa para alakasız sitelere gider).
4. Konum: **Deutschland**, seçenek "Personen an diesem Ort" (ilgi duyanlar değil). Dil: **Deutsch**.
5. Bütçe: kampanya başına günlük (aşağıda). Teklif: **"Klicks maximieren"** + **max. CPC 1,50 €** sınırı.
   (Dönüşüm takibi Google'da yok — çerez gerektirir; ölçümü kendi utm kartımızdan yapıyoruz.)
6. Fatura: Steuerberater'a §13b (Reverse Charge) sorusunu sor, hesabı ona göre "geschäftlich" aç.

## Hangi gruplarla başla?

10 €/gün için **sadece 1 ve 2** (Notdienst + Firma) — en net ihtiyaç ve en değerli kullanıcı (firma).
3 (Rechner) ucuz trafik getirir ama "sadece hesaplamak isteyen" çok; para kalırsa 2. ayda ekle.

| Kampanya | Günlük | Hedef sayfa |
|---|---|---|
| 1 Notdienst & Rufbereitschaft | 6 € | /notdienst-verwaltung |
| 2 Betriebe | 4 € | /firma |
| 3 Rechner (sonra) | 3 € | /ueberstundenrechner, /zuschlagsrechner |

---

## Kampanya 1 — Notdienst & Rufbereitschaft

**Final URL:**
`https://stundly.de/notdienst-verwaltung?utm_source=google&utm_medium=cpc&utm_campaign=notdienst`

**Anahtar kelimeler** (Google'a tırnak/köşeli parantezle gir: `"…"` = Phrase, `[…]` = Exact):
```
"notdienst app"
"notdienst erfassen"
"notdienst stunden aufschreiben"
"notdienst abrechnung handwerker"
"notdienst pauschale"
"rufbereitschaft app"
"rufbereitschaft erfassen"
"bereitschaftsdienst erfassen"
"bereitschaft stunden app"
[notdienst handwerker app]
```
❗ Sadece `notdienst` kelimesini **asla** ekleme: bunu arayanların çoğu acil tesisatçı/eczane arayan müşteri.

**Başlıklar** (max. 30 karakter, en az 8 tane gir):
- H: Notdienste einfach erfassen
- H: Stundly – die Notdienst-App
- H: Kostenlos in der Beta
- H: Keine Kreditkarte nötig
- H: Wochen-Regel automatisch
- H: Bonus wird berechnet
- H: PDF-Bericht für den Chef
- H: Rufbereitschaft im Griff
- H: Für Handwerker gemacht
- H: Bezahlt-Status im Blick
- H: Schluss mit Zettelwirtschaft
- H: Auch ohne Netz im Keller

**Açıklamalar** (max. 90 karakter, 4 tane):
- D: Notdienste, Stunden und Überstunden am Handy eintragen – der Bonus wird berechnet.
- D: In der Beta komplett kostenlos, ohne Kreditkarte. Grundfunktionen für immer gratis.
- D: Wer jetzt startet, zahlt nach der Beta dauerhaft 50 % weniger. Jetzt kostenlos starten.
- D: Notdienst-Bericht als PDF per Mail oder WhatsApp an den Chef – fertig, ohne Abtippen.

---

## Kampanya 2 — Betriebe (Chef)

**Final URL:**
`https://stundly.de/firma?utm_source=google&utm_medium=cpc&utm_campaign=firma`

**Anahtar kelimeler:**
```
"stundenzettel app"
"stundenzettel handwerk"
"stundenzettel digital"
"zeiterfassung handwerk app"
"zeiterfassung handwerker"
"zeiterfassung monteure"
"arbeitszeiterfassung kleiner betrieb"
"rufbereitschaft planen"
"notdienstplan erstellen"
```

**Başlıklar:**
- H: Stundenzettel ohne Abtippen
- H: Zeiterfassung fürs Handwerk
- H: Für kleine Betriebe
- H: Mitarbeiter erfassen am Handy
- H: Notdienst-Zentrale für Chefs
- H: Lohnbüro bekommt alles fertig
- H: Kostenlos in der Beta
- H: Keine Kreditkarte nötig
- H: Rufbereitschaft automatisch
- H: Stundly für Betriebe
- H: Du prüfst nur das Auffällige

**Açıklamalar:**
- D: Mitarbeiter tragen Stunden und Notdienste am Handy ein – du prüfst nur das Auffällige.
- D: Am Monatsende ist alles fertig fürs Lohnbüro: als CSV und PDF. In der Beta kostenlos.
- D: Rufbereitschaft reihum planen, Einsätze mit Fotos und Unterschrift, Bezahlt-Status.
- D: Ohne Kreditkarte starten. Beta-Betriebe zahlen später dauerhaft 50 % weniger.

---

## Kampanya 3 — Rechner (2. ay, isteğe bağlı)

**Final URL'ler** (iki reklam grubu):
- `https://stundly.de/ueberstundenrechner?utm_source=google&utm_medium=cpc&utm_campaign=rechner-ueberstunden`
- `https://stundly.de/zuschlagsrechner?utm_source=google&utm_medium=cpc&utm_campaign=rechner-zuschlag`

**Anahtar kelimeler:**
```
"überstunden berechnen"
"überstundenrechner"
"zuschlagsrechner"
"nachtzuschlag berechnen"
"sonntagszuschlag berechnen"
"feiertagszuschlag berechnen"
```

**Başlıklar:**
- H: Überstundenrechner kostenlos
- H: Zuschläge steuerfrei rechnen
- H: Nacht- & Sonntagszuschlag
- H: Kostenlos, ohne Anmeldung
- H: Überstunden in Euro sehen
- H: Stundly – Stunden im Griff
- H: Kostenlos in der Beta
- H: Jeden Monat automatisch

**Açıklamalar:**
- D: Überstunden und Zuschläge kostenlos berechnen – direkt im Browser, ohne Anmeldung.
- D: Stundly zählt deine Stunden, Überstunden und Zuschläge jeden Monat automatisch mit.
- D: In der Beta komplett kostenlos, ohne Kreditkarte. Grundfunktionen für immer gratis.

---

## Negatif anahtar kelimeler (hesap düzeyinde, hepsine)

```
apotheke
arzt
zahnarzt
tierarzt
ärztlicher
schlüsseldienst
in der nähe
telefonnummer
nummer
heute geöffnet
anfahrt
kosten notdienst
job
jobs
stellenangebote
stelle
ausbildung
gehaltsrechner
excel
vorlage
```
(`excel`/`vorlage`: şablon arayan uygulama istemiyor. Kampanya 3 açılırsa bu ikisini oradan çıkar.)

**İlk 2 hafta her 2–3 günde bir:** Google Ads → "Suchbegriffe" ekranı → alakasız aramaları negatif listeye ekle.
Bu, bütçeyi korumanın en etkili yolu.

---

## Değerlendirme (14. gün ve 30. gün)

| Bakılacak yer | Ne |
|---|---|
| Google Ads | Tıklama, ortalama CPC, harcama |
| Süper admin → Kokpit "Reklam / kampanya" | kayıt sayısı + "kullandı" |

- 14. günde bir kampanyadan **3'ten az kayıt** → durdur veya metni/kelimeyi değiştir.
- Kayıt başına maliyet = harcama ÷ kayıt. Hedef: **< 20 €**, "kullandı" başına **< 40 €**.
- İyi giden kampanyaya bütçe kaydır; kötü gideni kapat.

## Kurallar (yasal/dürüstlük)

- "Pflicht", "gesetzlich vorgeschrieben" gibi doğrulanmamış iddialar **yok**.
- Fiyat yazmıyoruz (landing'de de yok); "kostenlos" ve "50 % weniger" doğru (`lib/pricing.ts`, `lib/beta.ts`).
- Rakip marka adlarını (Personio, Clockodo …) anahtar kelime veya metinde **kullanma**.
