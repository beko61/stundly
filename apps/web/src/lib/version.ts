/**
 * Stundly Versiyon — Tek Doğruluk Kaynağı
 *
 * Format: MAJOR.MINOR.PATCH (Semver)
 *
 * Bump kuralları:
 *   PATCH (0.2.0 → 0.2.1)  Bug fix, yorum cleanup, log-only değişiklik, internal
 *                          refactor (kullanıcıya yansımayan).
 *   MINOR (0.2.1 → 0.3.0)  Yeni kullanıcı-görünür özellik / UI / alan.
 *   MAJOR (0.3.0 → 1.0.0)  Breaking change, public launch.
 *
 * Her commit'ten önce burada bump yap, commit mesajında referansla.
 * Kullanıldığı yerler: Sidebar footer, Settings (Abmelden altı), PDF dosyaları.
 */

export const STUNDLY_VERSION = "0.56.0";
export const STUNDLY_VERSION_LABEL = `Stundly v${STUNDLY_VERSION}`;
