"use client";

import { useEffect } from "react";

/**
 * Phones: the sticky header is two rows tall (logo and actions, then search), which is about 15 percent of the viewport on
 * every page. This tucks the search row away on scroll-down and brings it back on scroll-up, by setting
 * `data-search-hidden` on the header. The header clips its own bottom `--search-hide` (a clip-path, so the clipped strip is
 * transparent and ignores the pointer) instead of changing height, so the page below never reflows. It renders nothing.
 *
 * It stays shown while the header holds focus, and stays hidden while `<html data-header-compact>` is set: the engine
 * teardown sets that while it is pinned on screen, so its stage can use the extra height.
 */
export function HeaderAutoHide() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header[data-site-header]");
    if (!header) return;
    const phone = window.matchMedia("(max-width: 767px)");
    let lastY = window.scrollY;
    let hidden = false;

    const set = (hide: boolean) => {
      hidden = hide;
      header.toggleAttribute("data-search-hidden", hide);
    };
    const forced = () => document.documentElement.hasAttribute("data-header-compact");
    const apply = () => {
      if (!phone.matches) return set(false);
      if (header.contains(document.activeElement) && !forced()) return set(false);
      if (forced()) return set(true);
      if (window.scrollY <= 96) return set(false);
      set(hidden);
    };
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < 6) return;
      lastY = y;
      if (!phone.matches) return set(false);
      if (forced()) return set(true);
      if (header.contains(document.activeElement)) return set(false);
      set(y > 96 && delta > 0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    header.addEventListener("focusin", apply);
    phone.addEventListener("change", apply);
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-header-compact"] });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      header.removeEventListener("focusin", apply);
      phone.removeEventListener("change", apply);
      observer.disconnect();
      header.removeAttribute("data-search-hidden");
    };
  }, []);

  return null;
}
