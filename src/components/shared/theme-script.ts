/** Storage key for the per-viewer theme override ("light" | "dark"; absent = follow the system). */
export const THEME_STORAGE_KEY = "apexline-theme";

/** Inline script rendered in <head> by the root layouts: applies the stored theme before first paint (no flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
