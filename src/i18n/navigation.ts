import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives for STOREFRONT / ACCOUNT / CHECKOUT code.
 * Never use these inside src/app/admin (admin URLs have no locale prefix) - use next/link there.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
