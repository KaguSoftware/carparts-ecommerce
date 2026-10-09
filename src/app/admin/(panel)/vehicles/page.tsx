import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VehiclesManager, type VehicleRow } from "@/components/admin/catalog/VehiclesManager";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { can } from "@/lib/permissions";
import { listAllVehicles, listMakes, listModels } from "@/lib/services/vehicles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.vehicles");
  return { title: t("title") };
}

const BASE = "/admin/vehicles";

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user } = await guard("catalog.read");
  const sp = await searchParams;
  const t = await getTranslations("admin.vehicles");
  const q = param(sp, "q");
  const makeId = param(sp, "make");
  const modelId = param(sp, "model");
  const page = intParam(sp, "page", 1);

  const makes = await listMakes();
  const models = (await Promise.all(makes.map((m) => listModels(m.id)))).flat();
  const result = await listAllVehicles({ page, pageSize: 25, ...(q ? { q } : {}), ...(makeId ? { makeId } : {}), ...(modelId ? { modelId } : {}) });

  const rows: VehicleRow[] = result.items.map((v) => ({
    id: v.id,
    makeId: v.makeId,
    modelId: v.modelId,
    make: v.make.name,
    model: v.model.name,
    year: v.year,
    engine: v.engine,
    fuel: v.fuel,
    bodyType: v.bodyType,
  }));
  const makeName = new Map(makes.map((m) => [m.id, m.name]));

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: result.total })} />
      <FilterBar action={BASE}>
        <SearchFilter value={q} placeholder={t("searchPlaceholder")} />
        <SelectFilter name="make" label={t("cols.make")} value={makeId} allLabel={t("allMakes")} options={makes.map((m) => ({ value: m.id, label: m.name }))} />
        <SelectFilter
          name="model"
          label={t("cols.model")}
          value={modelId}
          allLabel={t("allModels")}
          options={models.filter((m) => !makeId || m.makeId === makeId).map((m) => ({ value: m.id, label: makeId ? m.name : `${makeName.get(m.makeId) ?? ""} ${m.name}` }))}
        />
      </FilterBar>
      <VehiclesManager rows={rows} makes={makes.map((m) => ({ id: m.id, name: m.name }))} models={models.map((m) => ({ id: m.id, makeId: m.makeId, name: m.name }))} canWrite={can(user.role, "catalog.write")} />
      <ListFooter base={BASE} sp={sp} page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}
