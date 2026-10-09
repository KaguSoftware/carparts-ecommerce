import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CarFront, LifeBuoy, Truck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Two-panel frame for sign-in, registration and password recovery. The dark panel carries the brand promise (desktop
 * only, it would just push the form down on phones); the form side is where the page's single `h1` lives.
 */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  const t = useTranslations("auth.shell");
  const points = [
    { icon: CarFront, title: t("pointFitmentTitle"), body: t("pointFitmentBody") },
    { icon: Truck, title: t("pointShippingTitle"), body: t("pointShippingBody") },
    { icon: LifeBuoy, title: t("pointSupportTitle"), body: t("pointSupportBody") },
  ];

  return (
    <div className="grid min-h-[calc(100dvh-var(--header-h))] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-inverse px-12 py-14 text-inverse-foreground lg:flex" aria-hidden={false}>
        <Logo variant="dark" height={40} title="" />
        <div className="max-w-md">
          <p className="display-2 text-inverse-foreground">{t("headline")}</p>
          <ul className="mt-10 space-y-6">
            {points.map(({ icon: Icon, title: pointTitle, body }) => (
              <li key={pointTitle} className="flex gap-4">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-sm bg-inverse-surface text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold uppercase tracking-wide">{pointTitle}</span>
                  <span className="mt-0.5 block text-sm text-inverse-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden className="ruler opacity-40" />
      </aside>

      <section className="flex items-start justify-center px-4 py-10 sm:px-8 sm:py-16 lg:items-center">
        <div className="w-full max-w-md">
          <h1 className="display-3">{title}</h1>
          {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 border-t border-border pt-6 text-sm text-muted">{footer}</div> : null}
        </div>
      </section>
    </div>
  );
}
