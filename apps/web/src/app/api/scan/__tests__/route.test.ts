import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/scan', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_BODY = {
  image: 'data:image/jpeg;base64,/9j/abc123',
  mediaType: 'image/jpeg',
};

const ANTHROPIC_SUCCESS = {
  content: [{ type: 'text', text: '{"eintraege":[],"hinweis":"Keine Arbeitszeiten erkannt"}' }],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/scan', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ANTHROPIC_API_KEY: 'test-key',
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    };
    // Default: authenticated user
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockAnthropicCreate.mockResolvedValue(ANTHROPIC_SUCCESS);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Auth ──

  it('401 — kimlik doğrulama olmadan erişim reddedilmeli', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('authentifiziert');
  });

  // ── Environment ──

  it('500 — ANTHROPIC_API_KEY eksik olunca hata dönmeli', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('ANTHROPIC_API_KEY nicht konfiguriert.');
  });

  // ── Input validation ──

  it('400 — geçersiz JSON body gönderilince hata dönmeli', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    const req = new NextRequest('http://localhost/api/scan', {
      method: 'POST',
      body: 'bu-gecersiz-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('400 — desteklenmeyen medya tipi reddedilmeli', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    const res = await POST(makeRequest({ image: 'data:image/bmp;base64,abc', mediaType: 'image/bmp' }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('Bildtyp');
  });

  it('413 — 4 MB üzerindeki resim reddedilmeli', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    const bigImage = 'A'.repeat(4 * 1024 * 1024 + 1);
    const res = await POST(makeRequest({ image: bigImage, mediaType: 'image/jpeg' }));
    expect(res.status).toBe(413);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('3 MB');
  });

  // ── Rate limiting ──

  it('429 — aynı kullanıcıdan dakikada 5 üzeri istek reddedilmeli', async () => {
    const userId = `rate-limit-test-${Date.now()}`; // unique per test run
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
    mockAnthropicCreate.mockResolvedValue(ANTHROPIC_SUCCESS);

    // İlk 5 istek başarılı olmalı
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).not.toBe(429);
    }
    // 6. istek rate limit'e takılmalı
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('Anfragen');
  });

  // ── Anthropic API ──

  it('502 — Anthropic API hatası kullanıcıya anlamlı mesajla dönmeli', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: `anthropic-err-${Date.now()}` } } });
    mockAnthropicCreate.mockRejectedValue(new Error('Connection timeout'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('KI-Fehler');
  });

  // ── Başarılı akış ──

  it('200 — geçerli resim ile doğru JSON ayrıştırması yapılmalı', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: `success-${Date.now()}` } } });
    mockAnthropicCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '{"eintraege":[{"datum":"2026-04-01","beginn":"08:00","ende":"17:00","pause_minuten":60}],"hinweis":"1 Eintrag erkannt"}',
      }],
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as { parsed: { eintraege: unknown[] } };
    expect(json.parsed).not.toBeNull();
    expect(json.parsed.eintraege).toHaveLength(1);
  });

  it('200 — JSON olmayan Anthropic yanıtında parsed null dönmeli', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: `nojson-${Date.now()}` } } });
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Kein Bild erkennbar.' }],
    });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as { parsed: unknown };
    expect(json.parsed).toBeNull();
  });

  it('doğru model kullanılıyor (claude-haiku-4-5-20251001)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: `model-${Date.now()}` } } });
    mockAnthropicCreate.mockResolvedValue(ANTHROPIC_SUCCESS);
    await POST(makeRequest(VALID_BODY));
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' })
    );
  });
});
