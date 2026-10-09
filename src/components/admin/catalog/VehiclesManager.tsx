"use client";

import { useState } from "react";
import { FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { createMakeAction, createModelAction, deleteVehicleAction, saveVehicleAction } from "@/actions/admin/vehicles";
import { vehicleInputSchema, type VehicleFormInput } from "@/actions/admin/vehicles.schema";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { applyServerErrors } from "../forms/form-utils";
import { FormError, ModalFormActions } from "../forms/FormParts";
import { RhfInteger, RhfSelect, RhfText } from "../forms/RhfFields";
import { useAdminAction } from "../forms/use-admin-action";

export interface VehicleRow {
  id: string;
  makeId: string;
  modelId: string;
  make: string;
  model: string;
  year: number;
  engine: string;
  fuel: VehicleFormInput["fuel"];
  bodyType?: string;
}

const FUELS = ["petrol", "diesel", "hybrid", "electric", "lpg"] as const;
const formSchema = z.object({ vehicle: vehicleInputSchema });
type Values = { vehicle: VehicleFormInput };

export interface VehiclesManagerProps {
  rows: VehicleRow[];
  makes: { id: string; name: string }[];
  models: { id: string; makeId: string; name: string }[];
  canWrite: boolean;
}

export function VehiclesManager({ rows, makes, models, canWrite }: VehiclesManagerProps) {
  const t = useTranslations("admin.vehicles");
  const tFuel = useTranslations("admin.vehicles.fuel");
  const [dialog, setDialog] = useState<{ kind: "vehicle"; row: VehicleRow | null } | { kind: "make" } | { kind: "model" } | null>(null);
  const close = () => setDialog(null);

  return (
    <div>
      {canWrite ? (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" leftIcon={<Plus className="size-4" />} onClick={() => setDialog({ kind: "make" })}>
            {t("newMake")}
          </Button>
          <Button size="sm" variant="outline" leftIcon={<Plus className="size-4" />} onClick={() => setDialog({ kind: "model" })}>
            {t("newModel")}
          </Button>
          <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setDialog({ kind: "vehicle", row: null })}>
            {t("newVehicle")}
          </Button>
        </div>
      ) : null}

      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.make")}</Th>
              <Th>{t("cols.model")}</Th>
              <Th numeric>{t("cols.year")}</Th>
              <Th>{t("cols.engine")}</Th>
              <Th>{t("cols.fuel")}</Th>
              <Th>{t("cols.body")}</Th>
              {canWrite ? (
                <Th className="w-px">
                  <span className="sr-only">{t("cols.actions")}</span>
                </Th>
              ) : null}
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={7}>{t("empty")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.make}</Td>
                  <Td>{r.model}</Td>
                  <Td numeric>{r.year}</Td>
                  <Td className="text-muted">{r.engine}</Td>
                  <Td className="text-muted">{tFuel(r.fuel)}</Td>
                  <Td className="text-muted">{r.bodyType ?? "-"}</Td>
                  {canWrite ? (
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={t("edit")} title={t("edit")} onClick={() => setDialog({ kind: "vehicle", row: r })}>
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmActionButton
                          size="icon-sm"
                          aria-label={t("delete")}
                          action={deleteVehicleAction.bind(null, { id: r.id })}
                          title={t("deleteTitle", { label: `${r.year} ${r.make} ${r.model}` })}
                          description={t("deleteBody")}
                          confirmLabel={t("deleteConfirm")}
                          success={t("deleted")}
                        >
                          <Trash2 className="size-4" />
                        </ConfirmActionButton>
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>

      <Modal open={dialog?.kind === "make"} onClose={close} size="sm" title={t("newMake")}>
        {dialog?.kind === "make" ? <MakeForm onClose={close} /> : null}
      </Modal>
      <Modal open={dialog?.kind === "model"} onClose={close} size="sm" title={t("newModel")}>
        {dialog?.kind === "model" ? <ModelForm makes={makes} onClose={close} /> : null}
      </Modal>
      <Modal open={dialog?.kind === "vehicle"} onClose={close} size="md" title={dialog?.kind === "vehicle" && dialog.row ? t("editVehicle") : t("newVehicle")}>
        {dialog?.kind === "vehicle" ? <VehicleForm key={dialog.row?.id ?? "new"} row={dialog.row} makes={makes} models={models} onClose={close} /> : null}
      </Modal>
    </div>
  );
}

function MakeForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin.vehicles.makeForm");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [name, setName] = useState("");
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => createMakeAction({ name }), { success: t("saved"), toastError: false, onSuccess: onClose });
      }}
    >
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <Field label={t("name")} required error={fieldError(error?.fieldErrors, "name")}>
        <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
      </Field>
      <ModalFormActions pending={pending} onCancel={onClose} />
    </form>
  );
}

function ModelForm({ makes, onClose }: { makes: VehiclesManagerProps["makes"]; onClose: () => void }) {
  const t = useTranslations("admin.vehicles.modelForm");
  const { fieldError } = useErrorText();
  const { run, pending, error, errorText } = useAdminAction();
  const [makeId, setMakeId] = useState(makes[0]?.id ?? "");
  const [name, setName] = useState("");
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => createModelAction({ makeId, name }), { success: t("saved"), toastError: false, onSuccess: onClose });
      }}
    >
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <Field label={t("make")} required error={fieldError(error?.fieldErrors, "makeId")}>
        <Select size="sm" value={makeId} onChange={(e) => setMakeId(e.target.value)}>
          {makes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("name")} required error={fieldError(error?.fieldErrors, "name")}>
        <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
      </Field>
      <ModalFormActions pending={pending} onCancel={onClose} />
    </form>
  );
}

function VehicleForm({ row, makes, models, onClose }: { row: VehicleRow | null; makes: VehiclesManagerProps["makes"]; models: VehiclesManagerProps["models"]; onClose: () => void }) {
  const t = useTranslations("admin.vehicles.form");
  const tFuel = useTranslations("admin.vehicles.fuel");
  const { run, pending, errorText } = useAdminAction();
  const form = useForm<Values>({
    resolver: zodResolver(formSchema) as unknown as Resolver<Values>,
    defaultValues: {
      vehicle: {
        makeId: row?.makeId ?? "",
        modelId: row?.modelId ?? "",
        year: (row?.year ?? new Date().getFullYear()) as number,
        engine: row?.engine ?? "",
        fuel: row?.fuel ?? "petrol",
        bodyType: row?.bodyType ?? "",
      },
    },
  });
  const makeId = useWatch({ control: form.control, name: "vehicle.makeId" });

  const submit = form.handleSubmit((values) =>
    run(() => saveVehicleAction({ id: row?.id, vehicle: values.vehicle }), {
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
        <div className="grid gap-4 sm:grid-cols-2">
          <RhfSelect name="vehicle.makeId" label={t("make")} required>
            <option value="">{t("choose")}</option>
            {makes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </RhfSelect>
          <RhfSelect name="vehicle.modelId" label={t("model")} required disabled={!makeId}>
            <option value="">{t("choose")}</option>
            {models
              .filter((m) => m.makeId === makeId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </RhfSelect>
          <RhfInteger name="vehicle.year" label={t("year")} required />
          <RhfSelect name="vehicle.fuel" label={t("fuel")} required>
            {FUELS.map((f) => (
              <option key={f} value={f}>
                {tFuel(f)}
              </option>
            ))}
          </RhfSelect>
          <RhfText name="vehicle.engine" label={t("engine")} hint={t("engineHint")} required className="sm:col-span-2" />
          <RhfText name="vehicle.bodyType" label={t("body")} hint={t("bodyHint")} className="sm:col-span-2" />
        </div>
        <ModalFormActions pending={pending} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}
