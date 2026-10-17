# -*- coding: utf-8 -*-
"""
Stundly geri yükleme — scripts/yedek.py'nin zip'ini BOŞ/TEST bir Supabase projesine yükler.

ASLA canlı projeye yüklemez: hedefin adresi apps/web/.env.local'daki (canlı) ile aynıysa durur.
Felakette yol: Supabase'de yeni proje aç → SQL Editor'de supabase/test_setup.sql → hedef dosyaya
yeni projenin URL + service_role anahtarını yaz → bu script → uygulamanın env'ini yeni projeye çevir.

Kullanım (workly klasöründe):
    python scripts/geri_yukle.py                      # en yeni yedek → .env.test.local'daki proje
    python scripts/geri_yukle.py yedekler/X.zip       # belirli yedek
    python scripts/geri_yukle.py --temizle            # hedef projeyi boşalt (tablolar + hesaplar)
    python scripts/geri_yukle.py --hedef dosya.env    # başka hedef (E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY)

UYARI: Hedef projedeki tüm veriler ve hesaplar silinir, yerine yedek gelir.
Şifreler yedekte yoktur (Supabase vermez) → kullanıcılar "Passwort vergessen" ile yeni şifre alır.
"""
import glob
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE_ENV = os.path.join(ROOT, "apps", "web", ".env.local")
DEFAULT_TARGET = os.path.join(ROOT, "apps", "web", ".env.test.local")
BATCH_BYTES = 4_000_000


def parse_env(path):
    env = {}
    if os.path.exists(path):
        with io.open(path, encoding="utf-8") as f:
            for line in f:
                m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*\"?([^\"\n]*)", line)
                if m:
                    env[m.group(1)] = m.group(2).strip()
    return env


def host(u):
    return urllib.parse.urlparse(u).netloc


class Api:
    def __init__(self, url, key):
        self.url, self.key = url.rstrip("/"), key

    def call(self, method, path, body=None, prefer=None):
        h = {"apikey": self.key, "Authorization": "Bearer " + self.key, "Content-Type": "application/json"}
        if prefer:
            h["Prefer"] = prefer
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(self.url + path, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else None), r.headers
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")[:300], e.headers

    def count(self, table):
        st, _, h = self.call("GET", "/rest/v1/%s?select=*&limit=1" % table, prefer="count=exact")
        return int(h.get("Content-Range", "*/0").split("/")[-1]) if st in (200, 206) else None

    def wipe(self, table):
        st, rows, _ = self.call("GET", "/rest/v1/%s?select=*&limit=1" % table)
        if st != 200 or not rows:
            return True
        col = next(iter(rows[0]))
        st, msg, _ = self.call("DELETE", "/rest/v1/%s?or=(%s.is.null,%s.not.is.null)" % (table, col, col))
        return st in (200, 204)

    def users(self):
        out, page = [], 1
        while True:
            _, data, _ = self.call("GET", "/auth/v1/admin/users?page=%d&per_page=200" % page)
            batch = (data or {}).get("users", [])
            out += batch
            if len(batch) < 200:
                return out
            page += 1


def tables_of(api):
    _, spec, _ = api.call("GET", "/rest/v1/")
    return sorted(p.strip("/") for p in spec.get("paths", {}) if p.strip("/") and not p.startswith("/rpc/"))


def wipe_all(api, tables):
    """Mehrere Durchgänge, weil Fremdschlüssel die Reihenfolge vorgeben."""
    left = list(tables)
    for _ in range(len(tables) + 1):
        left = [t for t in left if not api.wipe(t)]
        if not left:
            return []
    return left


def batches(rows):
    cur, size = [], 0
    for r in rows:
        n = len(json.dumps(r))
        if cur and size + n > BATCH_BYTES:
            yield cur
            cur, size = [], 0
        cur.append(r)
        size += n
    if cur:
        yield cur


def insert_table(api, table, rows):
    # bigserial-IDs neu vergeben lassen (sonst stehen die Sequenzen danach falsch)
    rows = [{k: v for k, v in r.items() if not (k == "id" and isinstance(v, int))} for r in rows]
    for b in batches(rows):
        st, msg, _ = api.call("POST", "/rest/v1/%s" % table, b, prefer="return=minimal")
        if st not in (200, 201, 204):
            return msg
    return None


def main(argv):
    target_env = DEFAULT_TARGET
    if "--hedef" in argv:
        target_env = argv[argv.index("--hedef") + 1]
    t = parse_env(target_env)
    url, key = t.get("E2E_SUPABASE_URL", ""), t.get("E2E_SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        sys.exit("Hedef eksik: %s içinde E2E_SUPABASE_URL ve E2E_SUPABASE_SERVICE_ROLE_KEY olmalı." % target_env)
    live = parse_env(LIVE_ENV).get("NEXT_PUBLIC_SUPABASE_URL", "")
    if live and host(url) == host(live):
        sys.exit("DURDURULDU: hedef CANLI veritabanı. Geri yükleme sadece boş/test projesine yapılır.")
    api = Api(url, key)
    print("Hedef: %s" % host(url))

    tables = tables_of(api)
    if "--temizle" in argv:
        left = wipe_all(api, tables)
        for u in api.users():
            api.call("DELETE", "/auth/v1/admin/users/%s" % u["id"])
        print("Temizlendi. Silinemeyen tablo: %s" % (left or "yok"))
        return

    zips = [a for a in argv if a.endswith(".zip")]
    path = zips[0] if zips else max(glob.glob(os.path.join(ROOT, "yedekler", "stundly_yedek_*.zip")))
    print("Yedek: %s" % os.path.basename(path))
    z = zipfile.ZipFile(path)
    data = {n[len("tablolar/"):-5]: json.loads(z.read(n)) for n in z.namelist() if n.startswith("tablolar/")}
    users = json.loads(z.read("auth_users.json"))

    # 1) Ziel leeren (Tabellen + Konten)
    wipe_all(api, tables)
    for u in api.users():
        api.call("DELETE", "/auth/v1/admin/users/%s" % u["id"])

    # 2) Konten mit denselben IDs anlegen (ohne Passwort)
    bad_users = []
    for u in users:
        st, msg, _ = api.call("POST", "/auth/v1/admin/users", {
            "id": u["id"], "email": u["email"], "email_confirm": True, "user_metadata": u.get("user_metadata") or {},
        })
        if st not in (200, 201):
            bad_users.append("%s: %s" % (u["id"][:8], msg))

    # 3) Von Triggern erzeugte Zeilen (z.B. profiles) wieder entfernen, dann Tabellen in mehreren Durchgängen
    wipe_all(api, tables)
    pending = {t: rows for t, rows in data.items() if rows and t in tables}
    errors = {}
    for _ in range(len(pending) + 1):
        progressed = False
        for t in list(pending):
            err = insert_table(api, t, pending[t])
            if err is None:
                del pending[t]
                progressed = True
            else:
                errors[t] = err
        if not pending or not progressed:
            break

    # 4) Kontrolle
    print("\n%-24s %8s %8s" % ("tablo", "yedek", "hedef"))
    ok = True
    for name in sorted(data):
        want = len(data[name])
        got = api.count(name) if name in tables else None
        mark = "OK" if got == want else "FARK"
        ok &= got == want
        print("%-24s %8d %8s  %s" % (name, want, got, mark))
    got_users = len(api.users())
    print("%-24s %8d %8d  %s" % ("(giriş hesapları)", len(users), got_users, "OK" if got_users == len(users) else "FARK"))
    ok &= got_users == len(users)
    for t in pending:
        print("YÜKLENEMEDİ %s: %s" % (t, errors.get(t)))
    for b in bad_users:
        print("HESAP HATASI %s" % b)
    print("\nSONUÇ: %s" % ("geri yükleme TAM" if ok and not pending and not bad_users else "EKSİK — yukarıya bak"))


if __name__ == "__main__":
    main(sys.argv[1:])
