# Stundly — Outreach Templates

> r/Selbststaendig + LinkedIn DM playbooks. Almanca, ban-safe, value-first.
>
> Bağlam: r/Hannover'de v0.8.2 launch'unda permaban yedik (self-promo). Bu sefer farklı oynayacağız.

---

## 1) r/Selbststaendig — STRATEJİ

### Kurallar (ihlal = ban):
- **Açık self-promo yasak.** "Schaut mein Tool an" → ban.
- Rule 5: "Werbung nur in Wochen-Mega-Threads (z.B. Werbe-Mittwoch)."
- Username + post history shadow-check var. Yeni hesap + tek post = otomatik filter.

### Üç güvenli post tipi:

#### A) "Build in public" hikaye postu — EN GÜVENLİ
> Format: kendi yolculuğunu anlat, ürünün adı sadece bir kez geçsin, en sonda link OPSIYONEL (yorumda).

```
Titel:  Nach 5 Jahren Excel-Zeiterfassung — ich habe aufgegeben und meine eigene Web-App gebaut

Body:
Hallo zusammen,

5 Jahre lang habe ich meine Arbeitszeit (Notdienste, Überstunden, Urlaub) in
einer 2.000-zeiligen Excel-Tabelle erfasst. Jeden Monat: copy-paste in einen
Brutto-Netto-Rechner, danach die Notdienste manuell auf die richtige Woche
umrechnen. 30 Minuten pro Abrechnung — und immer noch Fehler.

Letzten Monat habe ich aufgegeben und drei Wochen lang am Wochenende eine
eigene Web-App gebaut. Was ich gelernt habe (vielleicht hilft's jemandem
hier):

1. **Sollstunden zwischen Bundesländern unterschiedlich** — Feiertage müssen
   pro Land berechnet werden, sonst rechnet man bis zu 8h pro Monat falsch.
2. **Notdienste, die ein Monat überspannen** (z.B. Mo 30.06 → So 06.07)
   gehören in *einen* Monat — die Zuordnung „Pazartesi-basiert" ist die
   einzige, die sauber bleibt.
3. **Brutto → Netto** kann man in Code abbilden, wenn man EStG §32a + SV-
   Beiträge sauber trennt. Die Tabellen ändern sich aber jedes Jahr.
4. **PWA reicht** für 95% der Nutzer — kein App-Store-Aufwand nötig.

Falls jemand auch mit Excel kämpft: ich teile gern mein Repo / Logik /
Erfahrung. Keine Werbung — fragt einfach.

Cheers, Yusuf (Handwerk, NI)
```

→ Kimse linkı sormuyorsa yorumda **`Falls jemand mal reinschauen will: stundly.de/demo — kein Login, eigene Daten eingeben, beim Anmelden werden sie automatisch übernommen`** yaz. Çok kişi sorarsa profile bio'na koy.

### Shareable Demo URLs (FAZ 2 v0.26+)

Her demo tab'i artık ayrı link:
- **Tüm demo (default Zeit)**: `https://stundly.de/demo`
- **Brutto-Netto vurgusu**: `https://stundly.de/demo?tab=lohn` ← LinkedIn DM'lerde "schau dir die Lohnberechnung an"
- **Dashboard hero**: `https://stundly.de/demo?tab=uebersicht`
- **Urlaubsantrag**: `https://stundly.de/demo?tab=urlaub`

LinkedIn DM'inde branch-specific link gönder:
- Handwerk Inhaber → **`/demo?tab=lohn`** (Brutto-Netto en güçlü ürün)
- KOBİ admin → **`/demo?tab=uebersicht`** (KPI dashboard görsün)
- Pflegedienst → **`/demo?tab=zeit`** (default — Notdienst flow daha sonra demo'ya eklenecek)

#### B) "Frage stellen" — orta güvenli
> Sorunu paylaş, çözümünü kendin tartışma içinde söyle.

```
Titel:  Wie erfasst ihr Notdienste, die ein Monat überspannen?

Body:
Kurze Frage an die Handwerker / Selbstständigen hier:

Wie geht ihr mit Notdiensten um, die z.B. Mo 30.06. bis So 06.07. laufen?
- In welchen Monat fließt die Pauschale?
- Was sagt euer Steuerberater dazu?

Bei mir war es jahrelang ein Streitpunkt mit dem Steuerbüro. Ich habe es
mittlerweile so gelöst: ich teile die Woche dem Monat zu, in dem der Montag
liegt. Sauber bilanziert, kein Streit mehr.

Wer macht es anders?
```

→ Yorumlarda 3-4 cevap geldikten sonra ekle: "Ich habe das in mein Tool eingebaut, das ich mir selber gebaut habe — falls's jemand sehen will, DM."

#### C) Wöchentlicher Werbe-Thread (Mittwoch) — açık reklam, sadece BURADA
> Bu thread her Çarşamba pinlenir, açık reklam serbest. Format:

```
**Was:** Stundly — Web-App für Arbeitszeiterfassung, Lohnberechnung,
Notdienst-Verwaltung, Urlaubsanträge.

**Für wen:** Einzelpersonen (Handwerk, Pflege), kleine Betriebe bis 50 MA.

**Highlights:**
- DSGVO-konform (Server in Frankfurt)
- Brutto → Netto automatisch (EStG §32a + SV)
- Notdienst-Wochen sauber dem Monat zugeordnet
- Mobil + Desktop, kein App-Store-Login nötig
- 3 Monate Beta-Zugang gratis (ohne Kreditkarte)

**Demo ohne Anmeldung:** https://stundly.de/demo
**Account erstellen:** https://stundly.de

Made in Hannover · Solo-Indie · Feedback gerne!
```

### Posting Cadence:
- **Asla aynı hafta 2 post atma.**
- Önce 2-3 hafta sadece YORUM yap (yardımcı ol, link verme).
- 3. haftada Type A post at.
- 5. haftada Çarşamba thread'inde Type C.
- Type B her 2 ayda 1.

---

## 2) LinkedIn — Direct Outreach

### Hedef: Handwerk KOBİ sahipleri NRW + Niedersachsen + Hessen
**Arama filtreleri:**
- Position: "Geschäftsführer", "Inhaber", "Mitinhaber"
- Industry: Elektro, Sanitär, Heizung, Maler, Bauunternehmen, Pflege
- Company size: 2-50 employees
- Location: Niedersachsen, NRW, Hessen, Bayern

### DM #1 — İlk temas (cold)
> Personalized: ihr/du `{Vorname}`, business `{Branche}`, location `{Stadt}`.

```
Hallo {Vorname},

ich sehe, du leitest {Firma} in {Stadt} — kurze Frage:

Erfasst ihr die Arbeitszeit eurer {N} Mitarbeiter noch per Stundenzettel /
Excel? Falls ja: wie viel Zeit kostet euch die Monatsabrechnung (Überstunden,
Notdienst, Urlaub)?

Ich habe für genau diesen Fall ein Tool gebaut — DSGVO-konform,
ArbZG-Warnungen automatisch, Notdienst-Wochen sauber dem Monat zugeordnet.
3 Monate gratis testen, keine Kreditkarte.

Falls's interessiert, schick ich dir den Demo-Link (kein Login nötig, in
30 Sekunden siehst du, ob's für euch passt). Falls nicht: alles gut, kein
Follow-up.

Beste Grüße aus Hannover
Yusuf

PS: Solo-Indie, kein Sales-Team — du redest direkt mit dem Entwickler.
```

### DM #2 — Demo isteyene
```
Hi {Vorname},

cool, dass du reinschauen willst.

Demo (ohne Account): https://stundly.de/demo
→ zeigt Übersicht, Zeit, Lohn-Schätzung, Urlaub in 4 Tabs

Falls's klickt — Account erstellen dauert 30 Sek.:
https://stundly.de/register (3 Monate Beta = gratis)

Was bei dir/euch besonders wichtig wäre? Z.B.:
- Mehrere Mitarbeiter → Admin-Panel + Vacation-Approval
- Notdienst-Pauschale → automatisch in den richtigen Monat
- PDF Monatsberichte → für Steuerberater

Sag mir's, dann zeig ich's gezielt.

Yusuf
```

### DM #3 — 1 hafta sonra (sadece account oluşturduysa)
```
Hi {Vorname},

kurzer Check-in — Stundly seit einer Woche im Einsatz?

Falls was hakt / fehlt / nervt: schreib mir direkt. Bin Solo-Indie, ich kann
in 24h Bugs fixen oder Feature einbauen (im Rahmen).

Falls's nicht passt: auch gut — ich nehm gern Feedback, woran's gelegen hat.

Cheers,
Yusuf
```

### DM #3-alt — 1 hafta sonra (account YOK)
```
Hi {Vorname},

kein Druck, nur kurz: Tool noch nicht ausprobiert?

Falls Zeit fehlt: Demo dauert 30 Sek., kein Login.
Falls's nicht passt: kein Problem, ich entferne dich aus meiner Liste.

Falls du eine Frage hast, die dich abhält — schreib einfach.

Cheers,
Yusuf
```

### Compliance / Tone:
- **Maks. 3 mesaj.** Sonra silence. Spam yapma.
- **Du, nicht Sie.** Handwerk + indie tone.
- **Solo-Indie pozisyonu** = unique angle. Büyük SaaS şirketleri yapamaz.
- **PS satırı** önemli — kişiselleştirir, "robot mu?" şüphesini kaldırır.
- **Demo link her zaman /demo (login NO).** Friction = ölüm.

---

## 3) FAQ — yaygın itirazlar için cevaplar

### "Excel macht doch alles, was ich brauche."
> Klar, bis es nicht mehr klar ist. Drei typische Excel-Probleme, die wir lösen:
> 1. Feiertag-Bundesländer (du in NI rechnest 8 Tage anders als ein BY-Tarif)
> 2. Notdienst-Wochen, die zwei Monate überspannen
> 3. Brutto → Netto: bei jeder Steuer-Tabellen-Änderung musst du deine Formeln nachpflegen
>
> Wir machen das automatisch — und exportieren PDF, das dein Steuerberater akzeptiert.

### "Was kostet es danach?"
> Beta = 3 Monate gratis. Danach: €5,99/Monat Einzelperson, €19,99/Monat Team (bis 10 MA), €49,99/Monat Unternehmen (bis 50). Kein Setup-Gebühr, monatlich kündbar. Beta-Tester bekommen 50% lebenslang Rabatt.

### "DSGVO?"
> Server in Frankfurt (Supabase EU). Auftragsverarbeitungsvertrag (AVV) auf Anfrage. Recht auf Auskunft / Löschung / Datenportabilität eingebaut.

### "Funktioniert es mit unserem Lohnprogramm? (DATEV/Sage/...)"
> Direkt-Integration noch nicht. Aber: PDF Monatsbericht enthält alle Felder, die ein Lohnbüro braucht (Brutto, SV, Überstunden, Notdienst-Pauschale). API geplant — wenn du sie brauchst, sag's mir, ich priorisiere.

### "Wir haben schon Toggl / Clockodo / TimeTac / Personio."
> Kein Problem. Wir sind nicht "all-in-one HR" wie Personio. Wir sind klein, schnell, billig, für Solo + KOBİ. Wenn du Personio bezahlst und nutzt: bleib dabei. Wenn du Excel hasst und €5,99 zahlen willst: probier uns.

### "Mobile App im App Store?"
> Nein, PWA. Auf iPhone: Safari → Teilen → Zum Home-Bildschirm. Auf Android: Chrome → 3-Punkt-Menü → App installieren. 5 Sekunden, kein Apple-Account-Aufwand. Vorteil: Update sofort, kein App-Store-Approval.

### "Wer steckt dahinter?"
> Yusuf Bektas, Hannover. Solo-Indie, Vollzeit-Engineer. Stundly ist mein Side-Project, das ich vor ein paar Wochen live geschaltet habe. Du redest direkt mit dem Entwickler — keine Sales-Pipeline.

---

## 4) Metrics zum Verfolgen

Nach jedem Outreach-Batch (1 Reddit post / 50 LinkedIn DMs) tracken:

| Metric | Reddit | LinkedIn |
|--------|--------|----------|
| Impressions / Reach | post views | profile views |
| Engagement | upvotes + comments | DM replies |
| Demo visits (`/demo`) | (Vercel Analytics) | (Vercel Analytics) |
| Register clicks | conversion event | conversion event |
| Account creation | Supabase auth signup | Supabase auth signup |

**Reddit benchmark:** v0.8.2 r/Hannover (Type B'ye yakın) → 68 visitor, 28 referral, 2 register (3% of referrals). Target: 5%+ ile Type A.

**LinkedIn benchmark:** ilk batch 50 DM → hedef 10 reply (20%), 3 demo visit (6%), 1 account (2%).
