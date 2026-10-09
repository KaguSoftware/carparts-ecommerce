"use client";

import { useState } from "react";
import { Controller, FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { deleteBannerAction, saveBannerAction } from "@/actions/admin/content";
import { bannerInputSchema, type BannerFormInput } from "@/actions/admin/content.schema";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { localize, type LocalizedString } from "@/lib/i18n-string";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { applyServerErrors, isoToDateInput } from "../forms/form-utils";
import { FormError, ModalFormActions } from "../forms/FormParts";
import { ImageUploadField } from "../forms/ImageUpload";
import { RhfInteger, RhfLocalized, RhfSelect, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";
import { useFieldError } from "../forms/use-field-error";

export interface BannerRow {
  id: string;
  placement: BannerFormInput["placement"];
  title: LocalizedString;
  subtitle: LocalizedString;
  ctaLabel: LocalizedString;
  ctaHref: string;
  image?: string;
  tone: BannerFormInput["tone"];
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  sortOrder: number;
  live: boolean;
}

const PLACEMENTS = ["home_hero", "home_promo", "announcement", "category_top"] as const;
const formSchema = z.object({ banner: bannerInputSchema });

export function BannersManager({ rows }: { rows: BannerRow[] }) {
  const t = useTranslations("admin.banners");
  const locale = useLocale();
  const [editing, setEditing] = useState<BannerRow | "new" | null>(null);
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("new")}
        </Button>
      </div>
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.banner")}</Th>
              <Th>{t("cols.placement")}</Th>
              <Th>{t("cols.link")}</Th>
              <Th>{t("cols.schedule")}</Th>
              <Th numeric>{t("cols.order")}</Th>
              <Th>{t("cols.status")}</Th>
              <Th className="w-px">
                <span className="sr-only">{t("cols.actions")}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={7}>{t("empty")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt="" width={64} height={40} loading="lazy" className="size-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <span className="block max-w-64 truncate font-medium">{localize(r.title, locale)}</span>
                        <span className="block max-w-64 truncate text-xs text-muted">{localize(r.subtitle, locale)}</span>
                      </div>
                    </div>
                  </Td>
                  <Td>{t(`placements.${r.placement}`)}</Td>
                  <Td className="num max-w-40 truncate text-muted">{r.ctaHref || "-"}</Td>
                  <Td className="num whitespace-nowrap text-xs text-muted">{r.startsAt || r.endsAt ? `${isoToDateInput(r.startsAt) || "…"} → ${isoToDateInput(r.endsAt) || "…"}` : t("always")}</Td>
                  <Td numeric>{r.sortOrder}</Td>
                  <Td>
                    <Badge tone={r.live ? "success" : r.isActive ? "info" : "neutral"} dot>
                      {r.live ? t("live") : r.isActive ? t("scheduled") : t("off")}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={t("edit", { title: localize(r.title, locale) })} title={t("edit", { title: localize(r.title, locale) })} onClick={() => setEditing(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmActionButton
                        size="icon-sm"
                        aria-label={t("delete", { title: localize(r.title, locale) })}
                        action={deleteBannerAction.bind(null, { id: r.id })}
                        title={t("deleteTitle")}
                        description={t("deleteBody")}
                        confirmLabel={t("deleteConfirm")}
                        success={t("deleted")}
                      >
                        <Trash2 className="size-4" />
                      </ConfirmActionButton>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>
      <Modal open={editing !== null} onClose={() => setEditing(null)} size="xl" title={editing && editing !== "new" ? t("editTitle") : t("newTitle")}>
        {editing ? <BannerForm key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      </Modal>
    </div>
  );
}

function BannerForm({ row, onClose }: { row: BannerRow | null; onClose: () => void }) {
  const t = useTranslations("admin.banners.form");
  const tp = useTranslations("admin.banners.placements");
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<{ banner: BannerFormInput }>({
    resolver: zodResolver(formSchema) as unknown as Resolver<{ banner: BannerFormInput }>,
    defaultValues: {
      banner: {
        placement: row?.placement ?? "home_hero",
        title: row?.title ?? { en: "", tr: "" },
        subtitle: row?.subtitle ?? { en: "", tr: "" },
        ctaLabel: row?.ctaLabel ?? { en: "", tr: "" },
        ctaHref: row?.ctaHref ?? "",
        image: row?.image ?? "",
        tone: row?.tone ?? "dark",
        startsAt: isoToDateInput(row?.startsAt),
        endsAt: isoToDateInput(row?.endsAt),
        isActive: row?.isActive ?? true,
        sortOrder: row?.sortOrder ?? 0,
      },
    },
  });
  const fe = useFieldError(form.formState.errors);
  const submit = form.handleSubmit((values) =>
    run(() => saveBannerAction({ id: row?.id, banner: values.banner }), {
      success: t("saved"),
      toastError: false,
      onSuccess: onClose,
      onError: (failure) => applyServerErrors(form.setError, failure),
    }),
  );
  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormError text={errorText} />
        <div className="grid gap-4 sm:grid-cols-3">
          <RhfSelect name="banner.placement" label={t("placement")} required>
            {PLACEMENTS.map((p) => (
              <option key={p} value={p}>
                {tp(p)}
              </option>
            ))}
          </RhfSelect>
          <RhfSelect name="banner.tone" label={t("tone")} hint={t("toneHint")}>
            <option value="dark">{t("tones.dark")}</option>
            <option value="orange">{t("tones.orange")}</option>
            <option value="light">{t("tones.light")}</option>
          </RhfSelect>
          <RhfInteger name="banner.sortOrder" label={t("sortOrder")} />
        </div>
        <RhfLocalized name="banner.title" label={t("title")} required />
        <RhfLocalized name="banner.subtitle" label={t("subtitle")} multiline rows={2} />
        <RhfLocalized name="banner.ctaLabel" label={t("ctaLabel")} />
        <RhfText name="banner.ctaHref" label={t("ctaHref")} hint={t("ctaHrefHint")} autoComplete="off" className="font-mono" />
        <Controller control={form.control} name="banner.image" render={({ field }) => <ImageUploadField label={t("image")} value={field.value || undefined} onChange={(url) => field.onChange(url ?? "")} />} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="banner.startsAt"
            render={({ field }) => (
              <Field label={t("startsAt")} hint={t("scheduleHint")} error={fe("banner.startsAt")}>
                <Input size="sm" type="date" value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="banner.endsAt"
            render={({ field }) => (
              <Field label={t("endsAt")} error={fe("banner.endsAt")}>
                <Input size="sm" type="date" value={field.value} onChange={field.onChange} />
              </Field>
            )}
          />
        </div>
        <RhfSwitch name="banner.isActive" label={t("active")} description={t("activeHint")} />
        <ModalFormActions pending={pending} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}
