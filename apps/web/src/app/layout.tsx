import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { SupportButton } from "@/components/ui/SupportButton";
import { RegisterSW } from "@/components/ui/RegisterSW";
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
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Stundly" }],
  },
  twitter: {
    card: "summary",
    title: "Stundly – Arbeitszeiterfassung",
    description: "Arbeitszeit, Urlaub und Notdienst einfach erfassen.",
    images: ["/icons/icon-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#7c6af7" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f13" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          {children}
          <SupportButton />
          <CookieBanner />
          <RegisterSW />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
