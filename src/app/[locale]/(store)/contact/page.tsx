import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/ui";
import { ContactForm } from "@/components/store/pages/ContactForm";
import { getStoreContext } from "@/components/store/shared/context";
import { pageMetadata } from "@/components/store/shared/seo";
import { brand } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { getPublicSettings } from "@/lib/services/settings";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "store.contact" });
  return pageMetadata({ locale, path: "/contact", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("store.contact");
  const [ctx, settings] = await Promise.all([getStoreContext(locale), getPublicSettings()]);
  const { store } = settings;
  const row = "flex items-start gap-3.5";
  const icon = "mt-0.5 size-5 shrink-0 text-primary-text";

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("title") }]} />
      <div className="mb-10 mt-6 max-w-2xl">
        <h1 className="display-2">{t("title")}</h1>
        <p className="mt-3 text-[1.0625rem] text-muted">{t("intro")}</p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-20">
        <section aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading" className="display-3 mb-6">
            {t("formTitle")}
          </h2>
          <ContactForm defaultName={ctx.user?.name ?? ""} defaultEmail={ctx.user?.email ?? ""} />
        </section>

        <aside aria-labelledby="contact-info-heading" className="space-y-8">
          <div>
            <h2 id="contact-info-heading" className="display-3 mb-5">
              {t("infoTitle")}
            </h2>
            <ul className="space-y-5 text-[1rem]">
              <li className={row}>
                <Phone className={icon} aria-hidden />
                <div>
                  <p className="font-semibold">{t("phoneLabel")}</p>
                  <a href={`tel:${store.phone.replace(/[^+\d]/g, "")}`} className="num text-muted underline-offset-4 hover:text-foreground hover:underline">
                    {store.phone}
                  </a>
                </div>
              </li>
              <li className={row}>
                <MessageCircle className={icon} aria-hidden />
                <div>
                  <p className="font-semibold">{t("whatsappLabel")}</p>
                  <a href={`https://wa.me/${brand.contact.whatsapp.replace(/\D/g, "")}`} rel="noopener noreferrer" target="_blank" className="text-muted underline-offset-4 hover:text-foreground hover:underline">
                    {t("whatsappCta")}
                    <span className="sr-only"> {t("opensInNewTab")}</span>
                  </a>
                </div>
              </li>
              <li className={row}>
                <Mail className={icon} aria-hidden />
                <div>
                  <p className="font-semibold">{t("emailLabel")}</p>
                  <a href={`mailto:${store.email}`} className="text-muted underline-offset-4 hover:text-foreground hover:underline">
                    {store.email}
                  </a>
                </div>
              </li>
              <li className={row}>
                <Clock className={icon} aria-hidden />
                <div>
                  <p className="font-semibold">{t("hoursLabel")}</p>
                  <p className="text-muted">{brand.contact.hours[locale]}</p>
                </div>
              </li>
              <li className={row}>
                <MapPin className={icon} aria-hidden />
                <div>
                  <p className="font-semibold">{t("addressLabel")}</p>
                  <address className="not-italic text-muted">
                    {store.address.line1}
                    <br />
                    {store.address.city}, {store.address.region} {store.address.postalCode}
                  </address>
                </div>
              </li>
            </ul>
          </div>
          <div className="border-t border-border pt-6">
            <p className="font-semibold">{t("trackTitle")}</p>
            <p className="mt-1 text-muted">{t("trackBody")}</p>
            <Link href="/track-order" className="mt-2 inline-block font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
              {t("trackCta")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
