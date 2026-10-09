import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Pagination,
  Price,
  Select,
  Skeleton,
  Table,
  TableContainer,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  Tabs,
} from "@/components/ui";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/routing";
import { ModalToastDemo, SwitchDemo } from "./demo";

/** Dev-only design-system sheet (404 in production). Use it to eyeball tokens and primitives in both themes. */
export const dynamic = "force-dynamic";

const swatches: [string, string][] = [
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["surface-sunken", "bg-surface-sunken"],
  ["inverse", "bg-inverse"],
  ["primary", "bg-primary"],
  ["accent", "bg-accent"],
  ["secondary", "bg-secondary"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
  ["border-strong", "bg-border-strong"],
];

export default async function Styleguide({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  return (
    <main id="main" className="container-page space-y-14 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <Logo height={52} />
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="display-3">Type</h2>
        <p className="display-1">Precision parts</p>
        <p className="display-2">Brake discs and pads</p>
        <p className="display-3">Engine and drivetrain</p>
        <p className="max-w-prose text-muted">
          Body copy sits in Inter at 16px with a 1.6 line height and never exceeds roughly 70 characters per line. Part numbers and prices use tabular figures:{" "}
          <span className="num font-medium text-foreground">BP-4417-F 1,299.00</span>. Turkish check: ğüşiöç İĞÜŞÖÇ ı.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="display-3">Color</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {swatches.map(([name, cls]) => (
            <div key={name} className="overflow-hidden rounded-md border border-border">
              <div className={`h-16 ${cls}`} />
              <p className="label-caps px-3 py-2 text-muted">{name}</p>
            </div>
          ))}
        </div>
        <div className="ruler" />
      </section>

      <section className="space-y-4">
        <h2 className="display-3">Buttons and badges</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Add to cart</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="link">Text link</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="primary">New</Badge>
          <Badge tone="accent">-23%</Badge>
          <Badge tone="success" dot>
            In stock
          </Badge>
          <Badge tone="warning" dot>
            Low stock
          </Badge>
          <Badge tone="danger" dot>
            Out of stock
          </Badge>
          <Badge tone="info">Shipped</Badge>
          <Badge tone="outline">OEM</Badge>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardTitle>Form controls</CardTitle>
          <Field label="Email" required hint="We send the receipt here.">
            <Input type="email" placeholder="you@garage.com" />
          </Field>
          <Field label="Postal code" error="Enter a valid postal code.">
            <Input defaultValue="X1" />
          </Field>
          <Field label="Country">
            <Select defaultValue="US">
              <option value="US">United States</option>
              <option value="TR">Turkey</option>
            </Select>
          </Field>
          <Field label="Order note" optional>
            <Textarea placeholder="Gate code, delivery window..." />
          </Field>
          <Checkbox label="Save this vehicle to my garage" description="Used to filter parts that fit." defaultChecked />
          <SwitchDemo />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardTitle>Price</CardTitle>
            <CardDescription>USD base, TRY by locale rate</CardDescription>
            <div className="mt-4 flex flex-col gap-3">
              <Price amount={12999} compareAt={16999} locale={locale} showDiscount size="lg" />
              <Price amount={4850} locale={locale} />
              <Price amount={4850} locale="tr" currency={{ currency: "TRY", rate: 34.5 }} />
            </div>
          </Card>
          <Alert tone="info" title="Fitment check">
            Select your vehicle to confirm this part fits.
          </Alert>
          <Alert tone="success">Order placed. A receipt is on its way.</Alert>
          <Alert tone="warning" title="Only 2 left">
            Order within 3 hours for same-day dispatch.
          </Alert>
          <Alert tone="danger" title="Payment declined">
            Try another card.
          </Alert>
          <div className="flex gap-4">
            <Skeleton className="size-16" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="display-3">Table</h2>
        <TableContainer>
          <Table caption="Sample orders">
            <THead>
              <Tr>
                <Th sort="desc" href="#">
                  Order
                </Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th numeric>Total</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td className="num font-medium">AX-100482</Td>
                <Td>Mert Yilmaz</Td>
                <Td>
                  <Badge tone="info">Shipped</Badge>
                </Td>
                <Td numeric>$348.20</Td>
              </Tr>
              <Tr>
                <Td className="num font-medium">AX-100481</Td>
                <Td>Dana Whitfield</Td>
                <Td>
                  <Badge tone="success">Delivered</Badge>
                </Td>
                <Td numeric>$91.00</Td>
              </Tr>
            </TBody>
          </Table>
        </TableContainer>
        <Pagination page={3} pageCount={9} buildHref={(p) => `#page-${p}`} />
        <Breadcrumbs items={[{ label: "Home", href: "#" }, { label: "Brakes", href: "#" }, { label: "Brake pads" }]} />
      </section>

      <section className="space-y-4">
        <h2 className="display-3">Overlays and tabs</h2>
        <ModalToastDemo />
        <Tabs
          aria-label="Product details"
          tabs={[
            { id: "specs", label: "Specifications", content: <p className="text-muted">Pad thickness 17.5 mm, low-metallic compound.</p> },
            { id: "fit", label: "Fitment", content: <p className="text-muted">Fits 64 vehicle configurations.</p> },
            { id: "rev", label: "Reviews", badge: <Badge tone="outline">12</Badge>, content: <p className="text-muted">4.7 average rating.</p> },
          ]}
        />
      </section>
    </main>
  );
}
