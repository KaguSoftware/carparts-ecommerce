import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { brand } from "@/config/brand";
import { fontVariables } from "@/lib/fonts";
import { ToastProvider } from "@/components/ui/Toast";
import { THEME_INIT_SCRIPT } from "@/components/shared/theme-script";
import "../globals.css";

/**
 * ROOT LAYOUT for the admin tree (FOUNDATION-owned shell).
 * Admin URLs have no locale segment: the language comes from the `admin_locale` cookie
 * (resolved in src/i18n/request.ts) and the same message bundles as the storefront are loaded.
 * The admin AREA layout (sidebar, auth guard) lives in src/app/admin/(panel)/layout.tsx.
 */
export const metadata: Metadata = {
  title: { default: `Admin | ${brand.fullName}`, template: `%s | Admin | ${brand.name}` },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
