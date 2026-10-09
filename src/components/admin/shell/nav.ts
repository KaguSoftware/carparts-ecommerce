import {
  Boxes,
  Car,
  FileText,
  FolderTree,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Mail,
  MailOpen,
  Package,
  Percent,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tags,
  Ticket,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/types/domain";

export interface NavItem {
  /** Message key under `admin.nav.items` and badge key. */
  key: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from roles lacking it. Real enforcement happens on the page (requireStaff) and in the actions. */
  permission: Permission;
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { key: "overview", items: [{ key: "dashboard", href: "/admin", icon: LayoutDashboard, permission: "dashboard.read" }] },
  {
    key: "sales",
    items: [
      { key: "orders", href: "/admin/orders", icon: ShoppingCart, permission: "orders.read" },
      { key: "customers", href: "/admin/customers", icon: Users, permission: "customers.read" },
      { key: "reviews", href: "/admin/reviews", icon: Star, permission: "reviews.moderate" },
      { key: "coupons", href: "/admin/coupons", icon: Ticket, permission: "marketing.write" },
    ],
  },
  {
    key: "catalog",
    items: [
      { key: "products", href: "/admin/products", icon: Package, permission: "catalog.read" },
      { key: "categories", href: "/admin/categories", icon: FolderTree, permission: "catalog.read" },
      { key: "brands", href: "/admin/brands", icon: Tags, permission: "catalog.read" },
      { key: "vehicles", href: "/admin/vehicles", icon: Car, permission: "catalog.read" },
      { key: "inventory", href: "/admin/inventory", icon: Boxes, permission: "catalog.read" },
    ],
  },
  {
    key: "content",
    items: [
      { key: "banners", href: "/admin/banners", icon: ImageIcon, permission: "marketing.write" },
      { key: "pages", href: "/admin/pages", icon: FileText, permission: "cms.write" },
      { key: "messages", href: "/admin/messages", icon: Inbox, permission: "customers.read" },
      { key: "newsletter", href: "/admin/newsletter", icon: Mail, permission: "marketing.write" },
    ],
  },
  {
    key: "system",
    items: [
      { key: "settings", href: "/admin/settings", icon: Settings, permission: "settings.write" },
      { key: "shipping", href: "/admin/shipping", icon: Truck, permission: "settings.write" },
      { key: "tax", href: "/admin/tax", icon: Percent, permission: "settings.write" },
      { key: "staff", href: "/admin/staff", icon: ShieldCheck, permission: "users.manage" },
      { key: "audit", href: "/admin/audit", icon: ScrollText, permission: "audit.read" },
      { key: "emails", href: "/admin/emails", icon: MailOpen, permission: "settings.write" },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
