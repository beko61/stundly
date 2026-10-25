# -*- coding: utf-8 -*-
"""
Stundly yedek scripti — canlı veritabanını SADECE OKUR, hiçbir şey değiştirmez.

Ne yapar:
  • Tüm tabloları (Supabase REST şemasından otomatik bulur) sayfa sayfa indirir
  • Giriş hesaplarını (auth.users: id, e-posta, oluşturma/son giriş tarihi) indirir
  • Hepsini tek bir zip'e koyar:  workly/yedekler/stundly_yedek_YYYY-MM-DD_HHMM.zip
  • En yeni 8 yedeği tutar, eskileri siler; her çalışmayı yedekler/yedek.log'a yazar

Otomatik: Windows Görev Zamanlayıcı → "Stundly Yedek": her pazar 20:00 + her Windows girişinde
`--gerekirse` ile (son yedek 6 günden yeniyse hiçbir şey yapmaz) — pazar kaçarsa sonraki açılışta alınır.

Çalıştırma (workly klasöründe):
    python scripts/yedek.py

Anahtar apps/web/.env.local içinden okunur ve ekrana yazılmaz.
yedekler/ klasörü .gitignore'da — yedekler asla GitHub'a gitmez.
"""
import datetime
import io
import json
import os
import re
import sys
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, "apps", "web", ".env.local")
OUT_DIR = os.path.join(ROOT, "yedekler")
PAGE = 1000
KEEP = 8  # en yeni 8 yedek kalır
DUE_DAYS = 6  # --gerekirse: son yedek bundan yeniyse atla
LOG = os.path.join(OUT_DIR, "yedek.log")


def load_env():
    env = {}
    with io.open(ENV, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"\s*([A-Z_]+)\s*=\s*\"?([^\"\n]*)", line)
            if m:
                env[m.group(1)] = m.group(2).strip()
    return env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"), env["SUPABASE_SERVICE_ROLE_KEY"]


def get(url, key, path):
    req = urllib.request.Request(url + path, headers={"apikey": key, "Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def tables(url, key):
    spec = get(url, key, "/rest/v1/")
    names = []
    for p in spec.get("paths", {}):
        n = p.strip("/")
        if n and not n.startswith("rpc/"):
            names.append(n)
    return sorted(names)


def dump_table(url, key, name):
    rows, offset = [], 0
    while True:
        page = get(url, key, "/rest/v1/%s?select=*&offset=%d&limit=%d" % (name, offset, PAGE))
        rows += page
        if len(page) < PAGE:
            return rows
        offset += PAGE


def dump_users(url, key):
    users, page = [], 1
    while True:
        data = get(url, key, "/auth/v1/admin/users?page=%d&per_page=200" % page)
        batch = data.get("users", [])
        users += [{k: u.get(k) for k in ("id", "email", "created_at", "last_sign_in_at", "user_metadata")} for u in batch]
        if len(batch) < 200:
            return users
        page += 1


def last_backup_age_days():
    import glob
    zips = glob.glob(os.path.join(OUT_DIR, "stundly_yedek_*.zip"))
    if not zips:
        return None
    newest = max(os.path.getmtime(z) for z in zips)
    return (datetime.datetime.now().timestamp() - newest) / 86400


def main():
    if "--gerekirse" in sys.argv:
        age = last_backup_age_days()
        if age is not None and age < DUE_DAYS:
            print("Son yedek %.1f gün önce — gerek yok." % age)
            return
    url, key = load_env()
    os.makedirs(OUT_DIR, exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
    target = os.path.join(OUT_DIR, "stundly_yedek_%s.zip" % stamp)

    summary = {}
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for name in tables(url, key):
            try:
                rows = dump_table(url, key, name)
            except Exception as e:  # z.B. View ohne Rechte
                summary[name] = "HATA: %s" % e
                continue
            z.writestr("tablolar/%s.json" % name, json.dumps(rows, ensure_ascii=False, indent=1))
            summary[name] = len(rows)
        users = dump_users(url, key)
        z.writestr("auth_users.json", json.dumps(users, ensure_ascii=False, indent=1))
        summary["(giriş hesapları)"] = len(users)
        z.writestr("ozet.json", json.dumps({"tarih": stamp, "kaynak": url, "satirlar": summary}, ensure_ascii=False, indent=1))

    width = max(len(k) for k in summary)
    for k, v in summary.items():
        print("  %s  %s" % (k.ljust(width), v))
    size = os.path.getsize(target) / 1024 / 1024
    print("\nYedek hazır: %s (%.1f MB)" % (target, size))

    old = sorted(f for f in os.listdir(OUT_DIR) if f.startswith("stundly_yedek_") and f.endswith(".zip"))[:-KEEP]
    for f in old:
        os.remove(os.path.join(OUT_DIR, f))
    errors = [k for k, v in summary.items() if isinstance(v, str)]
    log("OK %s %.1f MB, %d tablo%s, %d eski silindi" % (
        os.path.basename(target), size, len(summary) - 1,
        (" (HATALI: %s)" % ", ".join(errors)) if errors else "", len(old)))


def log(line):
    os.makedirs(OUT_DIR, exist_ok=True)
    with io.open(LOG, "a", encoding="utf-8") as f:
        f.write("%s  %s\n" % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), line))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Yedek alınamadı: %s" % e)
        log("HATA %s" % e)
        sys.exit(1)
