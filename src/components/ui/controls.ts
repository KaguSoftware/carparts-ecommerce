/** Shared class strings for form controls so Input / Select / Textarea stay visually identical. */
export const controlBase =
  "block w-full rounded-sm border bg-surface text-foreground placeholder:text-subtle " +
  "border-border-strong hover:border-muted focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted disabled:opacity-70 " +
  "read-only:bg-surface-sunken transition-colors duration-150";

export const controlInvalid = "border-danger hover:border-danger focus-visible:border-danger focus-visible:outline-danger";

export const controlSizes = {
  md: "h-11 px-3.5 text-base",
  sm: "h-9 px-3 text-sm",
} as const;

export type ControlSize = keyof typeof controlSizes;
