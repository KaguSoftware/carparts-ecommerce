import type { AnchorHTMLAttributes } from "react";
import { Link } from "@/i18n/navigation";

/**
 * CMS-driven links (banners, footer) are either an unprefixed internal path ("/shop") or an absolute URL.
 * Internal paths get the locale prefix; external URLs open normally with safe rel attributes.
 */
export function SmartLink({ href, children, ...rest }: { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  const internal = href.startsWith("/") && !href.startsWith("//") ? href : `/${href}`;
  return (
    <Link href={internal} {...rest}>
      {children}
    </Link>
  );
}
