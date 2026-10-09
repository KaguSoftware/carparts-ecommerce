import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

const TONES = {
  // Order tones follow the lifecycle: amber (waiting on money), grey (being prepared), blue (on its way), green (done).
  order: { pending_payment: "warning", processing: "neutral", shipped: "info", delivered: "success", cancelled: "neutral", refunded: "danger" },
  payment: { unpaid: "warning", paid: "success", failed: "danger", partially_refunded: "accent", refunded: "danger" },
  product: { draft: "warning", active: "success", archived: "neutral" },
  review: { pending: "warning", approved: "success", rejected: "danger" },
  contact: { new: "primary", read: "neutral", replied: "success", archived: "outline" },
  coupon: { active: "success", scheduled: "info", expired: "neutral", disabled: "danger" },
  stock: { in_stock: "success", low_stock: "warning", out_of_stock: "danger" },
  role: { customer: "neutral", staff: "info", admin: "primary" },
  user: { active: "success", disabled: "danger" },
} satisfies Record<string, Record<string, BadgeTone>>;

export type StatusKind = keyof typeof TONES;

const BAR: Record<BadgeTone, string> = {
  neutral: "bg-subtle",
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  outline: "bg-border-strong",
  inverse: "bg-inverse",
};

/** Fill class for a bar that stands for a status, in the same tone as its badge. */
export function statusBarClass(kind: StatusKind, value: string): string {
  return BAR[(TONES[kind] as Record<string, BadgeTone>)[value] ?? "neutral"];
}

/** Coloured status pill whose label comes from `admin.status.<kind>.<value>`. */
export function StatusBadge({ kind, value }: { kind: StatusKind; value: string }) {
  const t = useTranslations("admin.status");
  const tone = (TONES[kind] as Record<string, BadgeTone>)[value] ?? "neutral";
  return (
    <Badge tone={tone} dot>
      {t.has(`${kind}.${value}`) ? t(`${kind}.${value}`) : value}
    </Badge>
  );
}
