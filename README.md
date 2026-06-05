# Stundly – Arbeitszeiterfassung

Smart Work & Time Tracking Platform

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand
- **Backend**: Supabase (Auth, Postgres, Storage, Edge Functions)
- **Monorepo**: Turborepo with `apps/web` + `packages/shared`
- **i18n**: German (primary), English (secondary)
- **Tests**: Vitest (unit), Playwright (E2E)

## Setup

### 1. Node.js kurulumu
[nodejs.org](https://nodejs.org) adresinden LTS sürümünü indirin.

### 2. Bağımlılıkları yükleyin
```bash
npm install
```

### 3. Supabase projesi oluşturun
1. [supabase.com](https://supabase.com) adresinde proje oluşturun
2. `.env.example` dosyasını `.env.local` olarak kopyalayın
3. Supabase URL ve anahtarlarını girin

```bash
cp apps/web/.env.example apps/web/.env.local
```

### 4. Veritabanı migrasyonlarını çalıştırın
SQL dosyalarını Supabase Dashboard > SQL Editor'a yapıştırın:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_time_entries.sql`
- `supabase/migrations/003_vacation_and_logs.sql`

### 5. Geliştirme sunucusunu başlatın
```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışır.

## Proje Yapısı

```
workly/
├── apps/
│   └── web/              # Next.js frontend
│       └── src/
│           ├── app/      # Pages (App Router)
│           ├── components/
│           ├── hooks/
│           ├── store/    # Zustand
│           └── lib/      # Supabase clients
├── packages/
│   └── shared/           # Types, utils (timeCalc, salaryCalc)
└── supabase/
    └── migrations/       # SQL migrations
```

## Tests

```bash
npm run test          # Unit tests (Vitest)
npm run test:watch    # Watch mode
```
