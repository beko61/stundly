import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { SupportButton } from "@/components/ui/SupportButton";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";
import { RegisterSW } from "@/components/ui/RegisterSW";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://stundly.de";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Stundly – Arbeitszeiterfassung für Deutschland",
    template: "%s · Stundly",
  },
  description: "Arbeitszeit, Urlaub und Notdienst einfach erfassen. DSGVO-konform, ArbZG-ready, mobil nutzbar.",
  manifest: "/manifest.json",
  applicationName: "Stundly",
  appleWebApp: {
    capable: true,
    title: "Stundly",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: APP_URL,
    siteName: "Stundly",
    title: "Stundly – Arbeitszeiterfassung für Deutschland",
    description: "Arbeitszeit, Urlaub und Notdienst einfach erfassen. DSGVO-konform.",
    // images: dynamic opengraph-image.tsx (app/) tarafından sağlanır
  },
  twitter: {
    card: "summary_large_image",
    title: "Stundly – Arbeitszeiterfassung für Deutschland",
    description: "Arbeitszeit, Urlaub und Notdienst einfach erfassen. DSGVO-konform, ArbZG-ready.",
    // images: opengraph-image.tsx fallback (large card için bu doğru davranış)
  },
};

const IOS_UA = /iPhone|iPad|iPod/i;

export async function generateViewport(): Promise<Viewport> {
  const ua = (await headers()).get("user-agent") ?? "";
  return {
    width: "device-width",
    initialScale: 1,
    // iOS zoomt beim Fokus auf Eingabefelder automatisch rein. maximum-scale=1
    // verhindert das; Pinch-Zoom bleibt auf iOS trotzdem möglich (Safari ignoriert
    // maximum-scale für Gesten). Android zoomt nicht automatisch → dort weglassen,
    // damit Pinch-Zoom erlaubt bleibt (WCAG 1.4.4 — Resize text).
    ...(IOS_UA.test(ua) ? { maximumScale: 1 } : {}),
    viewportFit: "cover",
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#7c6af7" },
      { media: "(prefers-color-scheme: dark)", color: "#0f0f13" },
    ],
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Theme FOUC-önlemi: React hydration'dan ÖNCE data-theme'i ayarla.
            localStorage öncelik, sonra prefers-color-scheme, fallback dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('stundly_theme');if(t!=='light'&&t!=='dark'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            {children}
            <SupportButton />
            <ScrollToTopButton />
            <CookieBanner />
            <InstallPrompt />
            <RegisterSW />
            <Analytics />
            <SpeedInsights />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
