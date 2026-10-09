import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProductThumbProps {
  /** Public path (`/products/x.svg` or `/uploads/x.webp`). */
  src?: string | null;
  /** Already-localised alt text. Use "" when a visible name sits next to the image. */
  alt: string;
  /** Sizes hint for the responsive image (defaults to a small thumbnail). */
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Square product image that fills its box. The parent (or `className`) decides the size, e.g.
 * `<ProductThumb className="size-16" ... />`. SVG product art is served as-is (`unoptimized`).
 * Safe in server and client components; shared with checkout.
 */
export function ProductThumb({ src, alt, sizes = "96px", priority, className }: ProductThumbProps) {
  return (
    <div className={cn("relative aspect-square shrink-0 overflow-hidden rounded-sm border border-border bg-surface-sunken", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={/\.svg(\?|$)/i.test(src)} className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-subtle" role={alt ? "img" : undefined} aria-label={alt || undefined}>
          <Package className="size-1/3" aria-hidden />
        </div>
      )}
    </div>
  );
}
