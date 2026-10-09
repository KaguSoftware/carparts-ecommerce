"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { PartPlate } from "@/components/shared/PartPlate";
import { ServiceSpec } from "@/components/shared/ServiceSpec";
import { Price } from "@/components/ui";
import type { CurrencyContext } from "@/lib/money";
import { formatMoney } from "@/lib/money";
import type { StockStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "./AddToCartButton";
import { WishlistButton } from "./WishlistButton";

export interface PdpImage {
  id: string;
  url: string;
  alt: string;
}

export interface PdpVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  available: number;
  status: StockStatus;
  imageId?: string;
}

export interface ProductExperienceProps {
  productId: string;
  productName: string;
  images: PdpImage[];
  variants: PdpVariant[];
  defaultVariantId: string;
  /** Label for the variant group, e.g. "Position". */
  variantGroupLabel: string;
  locale: string;
  currency: CurrencyContext;
  signedIn: boolean;
  inWishlist: boolean;
  maxQuantity: number;
  warrantyMonths: number;
  freeShippingThreshold: number;
  /** Server-rendered: title and rating. */
  heading: ReactNode;
  /** Server-rendered: the one-line summary shown under the part plate. */
  intro: ReactNode;
  /** Part identification for the data plate (the SKU follows the selected variant). */
  plate: { partNumber: string; oemNumbers: string[]; brand: { name: string; href: string } };
  /** Server-rendered: fitment checker for the saved vehicle. */
  fitment: ReactNode;
}

function Gallery({ images, activeId, onSelect }: { images: PdpImage[]; activeId?: string; onSelect: (id: string) => void }) {
  const t = useTranslations("store.product");
  const index = Math.max(0, images.findIndex((i) => i.id === activeId));
  const active = images[index];
  const step = (d: number) => {
    const next = images[(index + d + images.length) % images.length];
    if (next) onSelect(next.id);
  };
  if (!active) return <div className="aspect-square border border-border-strong bg-surface-sunken" />;
  return (
    <div className="space-y-3" role="group" aria-roledescription="carousel" aria-label={t("gallery")}>
      <div
        className="group relative aspect-square overflow-hidden border border-border-strong bg-surface-sunken"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        <div className="plotter absolute inset-0">
        {images.map((img) => (
          <Image
            key={img.id}
            src={img.url}
            alt={img.alt}
            fill
            sizes="(min-width: 1024px) 46vw, 100vw"
            priority={img.id === images[0]?.id}
            unoptimized={/\.svg(\?|$)/i.test(img.url)}
            className={cn("object-cover transition-opacity duration-300 ease-out", img.id === active.id ? "opacity-100" : "pointer-events-none opacity-0")}
            aria-hidden={img.id === active.id ? undefined : true}
          />
        ))}
        </div>
        <span aria-hidden className="plotter-pen" />
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t("previousImage")}
              className="absolute left-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-sm bg-surface/90 text-foreground shadow-md transition-opacity hover:bg-surface focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t("nextImage")}
              className="absolute right-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-sm bg-surface/90 text-foreground shadow-md transition-opacity hover:bg-surface focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {t("imageOf", { current: index + 1, total: images.length })}
        </p>
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2.5">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => onSelect(img.id)}
                aria-label={t("showImage", { number: i + 1 })}
                aria-current={img.id === active.id ? "true" : undefined}
                className={cn(
                  "relative block size-18 overflow-hidden border bg-surface-sunken transition-colors sm:size-20",
                  img.id === active.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" unoptimized={/\.svg(\?|$)/i.test(img.url)} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StockLine({ variant }: { variant: PdpVariant }) {
  const t = useTranslations("store.product");
  if (variant.status === "out_of_stock") {
    return (
      <p className="tag-mono flex items-center gap-2 text-danger">
        <span aria-hidden className="size-2 rounded-full bg-current" />
        {t("outOfStock")}
      </p>
    );
  }
  if (variant.status === "low_stock") {
    return (
      <p className="tag-mono flex items-center gap-2 text-warning">
        <span aria-hidden className="size-2 rounded-full bg-current" />
        {t("lowStock", { count: variant.available })}
      </p>
    );
  }
  return (
    <p className="tag-mono flex items-center gap-2 text-success">
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {t("inStock")}
    </p>
  );
}

export function ProductExperience(props: ProductExperienceProps) {
  const { images, variants, locale, currency } = props;
  const t = useTranslations("store.product");
  const uid = useId().replace(/:/g, "");
  const [variantId, setVariantId] = useState(props.defaultVariantId);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const [imageId, setImageId] = useState<string | undefined>(variant?.imageId ?? images[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setCtaVisible(entry?.isIntersecting ?? true), { rootMargin: "-64px 0px 0px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!variant) return null;
  const maxQty = Math.max(1, Math.min(props.maxQuantity, variant.available));
  const qty = Math.min(quantity, maxQty);
  const unavailable = variant.status === "out_of_stock";

  function selectVariant(id: string) {
    setVariantId(id);
    setQuantity(1);
    const next = variants.find((v) => v.id === id);
    if (next?.imageId) setImageId(next.imageId);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
      <div className="lg:sticky lg:top-32 lg:self-start">
        <Gallery images={images} activeId={imageId} onSelect={setImageId} />
      </div>

      <div className="space-y-6">
        {props.heading}
        <PartPlate partNumber={props.plate.partNumber} oemNumbers={props.plate.oemNumbers} sku={variant.sku} brand={props.plate.brand} />
        {props.intro}

        <div className="space-y-5 border-y border-border-strong py-6">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Price amount={variant.price} compareAt={variant.compareAtPrice} locale={locale} currency={currency} size="xl" showDiscount />
            <StockLine variant={variant} />
            {!unavailable ? <p className="tag-mono text-muted sm:ml-auto">{t("shipBy")}</p> : null}
          </div>

          {variants.length > 1 ? (
            <fieldset>
              <legend className="mb-2.5 text-sm font-semibold text-foreground">
                {props.variantGroupLabel}: <span className="font-normal text-muted">{variant.name}</span>
              </legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {variants.map((v) => {
                  const selected = v.id === variantId;
                  return (
                    <label
                      key={v.id}
                      className={cn(
                        "relative flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-sm border bg-surface px-4 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                        selected ? "border-primary bg-primary-soft" : "border-border-strong hover:border-foreground",
                        v.status === "out_of_stock" && !selected && "opacity-60",
                      )}
                    >
                      <input type="radio" name={`variant-${uid}`} value={v.id} checked={selected} onChange={() => selectVariant(v.id)} className="peer sr-only" />
                      <span className="min-w-0">
                        <span className="block truncate text-[0.9375rem] font-semibold">{v.name}</span>
                        <span className="block text-[0.8125rem] text-muted">{v.status === "out_of_stock" ? t("outOfStock") : v.status === "low_stock" ? t("lowStockShort") : t("inStock")}</span>
                      </span>
                      <span className="num shrink-0 font-display text-lg font-bold">{formatMoney(v.price, locale, currency)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div ref={ctaRef} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="inline-flex h-13 items-center self-start rounded-sm border border-border-strong bg-surface" role="group" aria-label={t("quantity")}>
              <button type="button" onClick={() => setQuantity(Math.max(1, qty - 1))} disabled={qty <= 1 || unavailable} aria-label={t("decrease")} className="inline-flex size-12 items-center justify-center hover:bg-surface-sunken disabled:opacity-40">
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="num min-w-10 text-center text-lg font-semibold" aria-live="polite">
                {qty}
              </span>
              <button type="button" onClick={() => setQuantity(Math.min(maxQty, qty + 1))} disabled={qty >= maxQty || unavailable} aria-label={t("increase")} className="inline-flex size-12 items-center justify-center hover:bg-surface-sunken disabled:opacity-40">
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <AddToCartButton variantId={variant.id} quantity={qty} disabled={unavailable} label={unavailable ? t("outOfStock") : undefined} />
            </div>
          </div>
          <WishlistButton productId={props.productId} productName={props.productName} initialInWishlist={props.inWishlist} signedIn={props.signedIn} variant="inline" className="w-full sm:w-auto" />
        </div>

        {props.fitment}

        <ServiceSpec
          label={t("service.label")}
          columns={2}
          rows={[
            { key: t("service.dispatch"), value: t("service.dispatchValue") },
            { key: t("service.returns"), value: t("service.returnsValue") },
            { key: t("service.warranty"), value: props.warrantyMonths > 0 ? t("service.warrantyValue", { count: props.warrantyMonths }) : t("service.warrantyNone") },
            { key: t("service.shipping"), value: props.freeShippingThreshold > 0 ? t("service.shippingFree", { amount: formatMoney(props.freeShippingThreshold, locale, currency) }) : t("service.shippingFlat") },
          ]}
        />
      </div>

      {/* Mobile sticky buy bar: appears once the main button scrolls out of view. */}
      <div
        inert={ctaVisible}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur-sm transition-transform duration-300 ease-out lg:hidden",
          ctaVisible ? "pointer-events-none translate-y-full" : "translate-y-0",
        )}
      >
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] text-muted">{variants.length > 1 ? variant.name : props.productName}</p>
            <Price amount={variant.price} compareAt={variant.compareAtPrice} locale={locale} currency={currency} size="md" />
          </div>
          <div className="w-44 shrink-0">
            <AddToCartButton variantId={variant.id} quantity={qty} disabled={unavailable || ctaVisible} label={unavailable ? t("outOfStock") : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
