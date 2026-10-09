"use client";

import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { savePageAction } from "@/actions/admin/content";
import { pageInputSchema, type PageFormInput } from "@/actions/admin/content.schema";
import { applyServerErrors } from "../forms/form-utils";
import { FormError, FormFooter, FormSection } from "../forms/FormParts";
import { RhfInteger, RhfLocalized, RhfSwitch, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";

const formSchema = z.object({ page: pageInputSchema });

export function PageForm({ id, initial }: { id?: string; initial?: PageFormInput }) {
  const t = useTranslations("admin.pages.form");
  const router = useRouter();
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<{ page: PageFormInput }>({
    resolver: zodResolver(formSchema) as unknown as Resolver<{ page: PageFormInput }>,
    defaultValues: {
      page: initial ?? { slug: "", title: { en: "", tr: "" }, body: { en: "", tr: "" }, isPublished: false, showInFooter: true, sortOrder: 0, seoDescription: { en: "", tr: "" } },
    },
  });
  const submit = form.handleSubmit((values) =>
    run(() => savePageAction({ id, page: values.page }), {
      success: t("saved"),
      toastError: false,
      refresh: !!id,
      onSuccess: (data) => {
        if (!id) router.push(`/admin/pages/${data.id}`);
        else form.reset(values);
      },
      onError: (failure) => applyServerErrors(form.setError, failure),
    }),
  );
  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate>
        <FormError text={errorText} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <FormSection title={t("content")}>
              <RhfLocalized name="page.title" label={t("title")} required />
              <RhfLocalized name="page.body" label={t("body")} hint={t("bodyHint")} multiline rows={16} mono />
            </FormSection>
            <FormSection title={t("seo")}>
              <RhfLocalized name="page.seoDescription" label={t("seoDescription")} multiline rows={2} />
            </FormSection>
          </div>
          <div className="space-y-4">
            <FormSection title={t("publishing")}>
              <RhfSwitch name="page.isPublished" label={t("published")} description={t("publishedHint")} />
              <RhfSwitch name="page.showInFooter" label={t("showInFooter")} description={t("showInFooterHint")} />
              <RhfText name="page.slug" label={t("slug")} hint={t("slugHint")} required className="font-mono" autoComplete="off" />
              <RhfInteger name="page.sortOrder" label={t("sortOrder")} />
            </FormSection>
          </div>
        </div>
        <FormFooter pending={pending} cancelHref="/admin/pages" saveLabel={id ? undefined : t("create")} />
      </form>
    </FormProvider>
  );
}
