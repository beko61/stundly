# Stundly SEO kontrolü — SEARCH_CONSOLE_KURULUM.md
#
#   .\scripts\seo-kontrol.ps1              # sadece kontrol (robots, sitemap, her URL, DNS)
#   .\scripts\seo-kontrol.ps1 -IndexNow    # kontrol + elle IndexNow gönderimi (normalde GitHub Actions yapar)
#   .\scripts\seo-kontrol.ps1 -Tarayici    # kontrol + Search Console / Bing sayfalarını tarayıcıda aç
#
# Giriş, "Indexierung beantragen" tıklamaları ve DNS değişiklikleri elle yapılır.

param(
  [switch]$IndexNow,
  [switch]$Tarayici
)

$ErrorActionPreference = "Stop"
$Site = "https://stundly.de"
$Domain = "stundly.de"
# Search Console'da "Indexierung beantragen" yapılacak sayfalar
$Onemli = @("/", "/rufbereitschaft-verguetung", "/zuschlagsrechner", "/ueberstundenrechner", "/stundenzettel-vorlage",
            "/stundenzettel-excel-vorlage", "/notdienst-verwaltung", "/handwerker", "/firma")

$hata = 0
function Yaz-Ok($m)   { Write-Host "  OK    $m" -ForegroundColor Green }
function Yaz-Hata($m) { Write-Host "  HATA  $m" -ForegroundColor Red; $script:hata++ }
function Yaz-Uyari($m){ Write-Host "  UYARI $m" -ForegroundColor Yellow }

function Get-Sayfa($url) {
  # 200 dışı durumlarda da durum kodunu döndür (PS 5.1 Invoke-WebRequest hata fırlatır)
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30
    return @{ Kod = [int]$r.StatusCode; Icerik = $r.Content; Baslik = $r.Headers }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) { return @{ Kod = [int]$resp.StatusCode; Icerik = ""; Baslik = @{} } }
    return @{ Kod = 0; Icerik = $_.Exception.Message; Baslik = @{} }
  }
}

function Normalize($u) { $u.TrimEnd("/") }

# --- robots.txt ---
Write-Host "`nrobots.txt" -ForegroundColor Cyan
$robots = Get-Sayfa "$Site/robots.txt"
if ($robots.Kod -ne 200) { Yaz-Hata "robots.txt -> $($robots.Kod)" }
else {
  Yaz-Ok "robots.txt -> 200"
  if ($robots.Icerik -match "(?m)^Sitemap:\s*$([regex]::Escape("$Site/sitemap.xml"))") { Yaz-Ok "Sitemap satırı var" }
  else { Yaz-Hata "robots.txt içinde 'Sitemap: $Site/sitemap.xml' yok" }
  if ($robots.Icerik -match "(?m)^Disallow:\s*/\s*$") { Yaz-Hata "robots.txt tüm siteyi engelliyor (Disallow: /)" }
}

# --- sitemap.xml ---
Write-Host "`nsitemap.xml" -ForegroundColor Cyan
$sm = Get-Sayfa "$Site/sitemap.xml"
$urls = @()
if ($sm.Kod -ne 200) { Yaz-Hata "sitemap.xml -> $($sm.Kod)" }
else {
  $urls = @(([xml]$sm.Icerik).urlset.url | ForEach-Object { $_.loc })
  Yaz-Ok "sitemap.xml -> 200, $($urls.Count) URL"
}

# --- Her URL: 200, noindex yok, canonical doğru ---
Write-Host "`nSitemap URL'leri" -ForegroundColor Cyan
foreach ($u in $urls) {
  $p = Get-Sayfa $u
  if ($p.Kod -ne 200) { Yaz-Hata "$u -> $($p.Kod)"; continue }
  $sorun = @()
  if ($p.Icerik -match '<meta[^>]+name="robots"[^>]+content="[^"]*noindex') { $sorun += "meta noindex" }
  if ("$($p.Baslik['X-Robots-Tag'])" -match "noindex") { $sorun += "X-Robots-Tag noindex" }
  $m = [regex]::Match($p.Icerik, '<link[^>]+rel="canonical"[^>]+href="([^"]+)"')
  if ($m.Success -and (Normalize $m.Groups[1].Value) -ne (Normalize $u)) { $sorun += "canonical -> $($m.Groups[1].Value)" }
  if ($sorun.Count) { Yaz-Hata "$u : $($sorun -join ', ')" }
  elseif (-not $m.Success) { Yaz-Uyari "$u : canonical yok (Google kendisi seçer)" }
  else { Yaz-Ok $u }
}

# --- DNS doğrulama kayıtları ---
Write-Host "`nDNS TXT ($Domain)" -ForegroundColor Cyan
$txt = @(Resolve-DnsName -Type TXT $Domain -ErrorAction SilentlyContinue | ForEach-Object { $_.Strings })
if ($txt -match "^google-site-verification=") { Yaz-Ok "Google doğrulama kaydı var" } else { Yaz-Uyari "Google doğrulama kaydı yok" }
if ($txt -match "^MS=|^msvalidate") { Yaz-Ok "Bing doğrulama kaydı var" } else { Yaz-Uyari "Bing doğrulama kaydı yok (Bing'de 'Import from Google Search Console' yeterli)" }

# --- IndexNow ---
if ($IndexNow) {
  # Normalde her deploy sonrası GitHub Actions (.github/workflows/seo.yml) gönderir
  Write-Host "`nIndexNow" -ForegroundColor Cyan
  node (Join-Path $PSScriptRoot "seo-otomatik.mjs") indexnow
  if ($LASTEXITCODE -ne 0) { Yaz-Hata "IndexNow gönderilemedi" }
}

# --- Tarayıcı ---
if ($Tarayici) {
  Write-Host "`nTarayıcıda açılıyor (Google hesabınla giriş yap)" -ForegroundColor Cyan
  $res = [uri]::EscapeDataString("sc-domain:$Domain")
  Start-Process "https://search.google.com/search-console/sitemaps?resource_id=$res"
  Start-Process "https://search.google.com/search-console/index?resource_id=$res"
  foreach ($s in $Onemli) {
    $id = [uri]::EscapeDataString((Normalize "$Site$s"))
    Start-Process "https://search.google.com/search-console/inspect?resource_id=$res&id=$id"
  }
  Start-Process "https://www.bing.com/webmasters/"
  Write-Host "  Sitemaps: 'sitemap.xml' gönder. Her URL-Prüfung sekmesinde: 'Indexierung beantragen'."
  Write-Host "  Bing: 'Import from Google Search Console'."
}

Write-Host ""
if ($hata) { Write-Host "$hata hata bulundu." -ForegroundColor Red; exit 1 }
Write-Host "Her şey yolunda." -ForegroundColor Green
