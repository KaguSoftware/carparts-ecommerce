import type { Vehicle, VehicleMake, VehicleModel } from "@/lib/types/domain";
import { pad } from "./util";

type Fuel = Vehicle["fuel"];

export interface VehicleConfig {
  key: string; // c01...
  make: string; // make slug
  model: string; // display name
  from: number;
  to: number;
  engine: string;
  fuel: Fuel;
  body: string;
  /** Popularity weight used when mapping fitment (more popular cars get more compatible parts). */
  pop: number;
}

const MAKE_NAMES: Record<string, string> = {
  toyota: "Toyota",
  honda: "Honda",
  ford: "Ford",
  volkswagen: "Volkswagen",
  bmw: "BMW",
  "mercedes-benz": "Mercedes-Benz",
  audi: "Audi",
  chevrolet: "Chevrolet",
  nissan: "Nissan",
  hyundai: "Hyundai",
  kia: "Kia",
  renault: "Renault",
  peugeot: "Peugeot",
  fiat: "Fiat",
  skoda: "Škoda",
};

const c = (n: number, make: string, model: string, from: number, to: number, engine: string, fuel: Fuel, body: string, pop: number): VehicleConfig => ({
  key: `c${pad(n, 2)}`,
  make,
  model,
  from,
  to,
  engine,
  fuel,
  body,
  pop,
});

/** ~40 vehicle configurations (a make/model/engine over a range of model years). */
export const VEHICLE_CONFIGS: VehicleConfig[] = [
  c(1, "toyota", "Corolla", 2014, 2018, "1.6 Valvematic 132 hp", "petrol", "Sedan", 3),
  c(2, "toyota", "Corolla", 2019, 2023, "1.8 Hybrid 122 hp", "hybrid", "Sedan", 3),
  c(3, "toyota", "Camry", 2018, 2023, "2.5 Dynamic Force 203 hp", "petrol", "Sedan", 2),
  c(4, "toyota", "RAV4", 2016, 2022, "2.0 Valvematic 151 hp", "petrol", "SUV", 2),
  c(5, "toyota", "Hilux", 2016, 2023, "2.4 D-4D 150 hp", "diesel", "Pickup", 2),
  c(6, "honda", "Civic", 2016, 2021, "1.5 VTEC Turbo 182 hp", "petrol", "Hatchback", 3),
  c(7, "honda", "Civic", 2012, 2015, "1.8 i-VTEC 142 hp", "petrol", "Sedan", 1.5),
  c(8, "honda", "CR-V", 2017, 2022, "1.5 VTEC Turbo 193 hp", "petrol", "SUV", 2),
  c(9, "ford", "Focus", 2012, 2018, "1.6 TDCi 115 hp", "diesel", "Hatchback", 3),
  c(10, "ford", "Focus", 2018, 2023, "1.5 EcoBoost 150 hp", "petrol", "Hatchback", 2),
  c(11, "ford", "Fiesta", 2013, 2017, "1.0 EcoBoost 100 hp", "petrol", "Hatchback", 2),
  c(12, "ford", "F-150", 2015, 2020, "3.5 EcoBoost V6 375 hp", "petrol", "Pickup", 1.5),
  c(13, "volkswagen", "Golf", 2013, 2019, "1.4 TSI 125 hp", "petrol", "Hatchback", 3),
  c(14, "volkswagen", "Golf", 2013, 2019, "2.0 TDI 150 hp", "diesel", "Hatchback", 3),
  c(15, "volkswagen", "Passat", 2015, 2022, "2.0 TDI 150 hp", "diesel", "Sedan", 2.5),
  c(16, "volkswagen", "Polo", 2014, 2021, "1.0 TSI 95 hp", "petrol", "Hatchback", 2),
  c(17, "volkswagen", "Tiguan", 2016, 2023, "2.0 TDI 150 hp", "diesel", "SUV", 2),
  c(18, "bmw", "3 Series", 2012, 2018, "320d 2.0 184 hp", "diesel", "Sedan", 2.5),
  c(19, "bmw", "3 Series", 2019, 2023, "330i 2.0 Turbo 258 hp", "petrol", "Sedan", 2),
  c(20, "bmw", "X3", 2018, 2023, "xDrive20d 2.0 190 hp", "diesel", "SUV", 1.5),
  c(21, "mercedes-benz", "C-Class", 2014, 2021, "C200 2.0 Turbo 184 hp", "petrol", "Sedan", 2),
  c(22, "mercedes-benz", "E-Class", 2016, 2023, "E220d 2.0 194 hp", "diesel", "Sedan", 2),
  c(23, "audi", "A4", 2016, 2023, "2.0 TDI 150 hp", "diesel", "Sedan", 2),
  c(24, "audi", "A3", 2013, 2020, "1.4 TFSI 150 hp", "petrol", "Hatchback", 1.5),
  c(25, "chevrolet", "Silverado 1500", 2014, 2018, "5.3 V8 355 hp", "petrol", "Pickup", 1.2),
  c(26, "chevrolet", "Malibu", 2016, 2022, "1.5 Turbo 163 hp", "petrol", "Sedan", 1),
  c(27, "nissan", "Qashqai", 2014, 2021, "1.5 dCi 110 hp", "diesel", "SUV", 3),
  c(28, "nissan", "Altima", 2013, 2018, "2.5 QR25 182 hp", "petrol", "Sedan", 1.5),
  c(29, "hyundai", "i20", 2015, 2020, "1.2 MPI 84 hp", "petrol", "Hatchback", 3),
  c(30, "hyundai", "Tucson", 2016, 2021, "1.6 GDI 132 hp", "petrol", "SUV", 2),
  c(31, "hyundai", "Elantra", 2017, 2020, "2.0 MPI 149 hp", "petrol", "Sedan", 2),
  c(32, "kia", "Sportage", 2016, 2021, "1.7 CRDi 141 hp", "diesel", "SUV", 2),
  c(33, "kia", "Ceed", 2013, 2018, "1.6 CRDi 128 hp", "diesel", "Hatchback", 1.5),
  c(34, "kia", "Rio", 2017, 2022, "1.4 MPI 100 hp", "petrol", "Hatchback", 2),
  c(35, "renault", "Clio", 2013, 2019, "0.9 TCe 90 hp", "petrol", "Hatchback", 3),
  c(36, "renault", "Megane", 2016, 2022, "1.5 dCi 110 hp", "diesel", "Hatchback", 3),
  c(37, "peugeot", "208", 2012, 2019, "1.2 PureTech 82 hp", "petrol", "Hatchback", 2),
  c(38, "peugeot", "3008", 2017, 2023, "1.5 BlueHDi 130 hp", "diesel", "SUV", 2),
  c(39, "fiat", "Egea / Tipo", 2016, 2023, "1.4 Fire 95 hp", "petrol", "Sedan", 3),
  c(40, "fiat", "Egea / Tipo", 2016, 2023, "1.3 Multijet 95 hp", "diesel", "Sedan", 2),
  c(41, "skoda", "Octavia", 2013, 2020, "1.6 TDI 110 hp", "diesel", "Liftback", 3),
  c(42, "skoda", "Superb", 2015, 2023, "2.0 TDI 150 hp", "diesel", "Liftback", 1.5),
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/š/g, "s")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const makeId = (makeSlug: string) => `mak_${makeSlug}`;
export const modelId = (makeSlug: string, model: string) => `mdl_${makeSlug}-${slug(model)}`;
export const vehicleId = (configKey: string, year: number) => `veh_${configKey}_${year}`;

export interface VehicleData {
  makes: VehicleMake[];
  models: VehicleModel[];
  vehicles: Vehicle[];
  /** config key -> the concrete vehicles (one per model year) */
  byConfig: Map<string, Vehicle[]>;
}

export function buildVehicles(): VehicleData {
  const makes: VehicleMake[] = Object.entries(MAKE_NAMES).map(([s, name]) => ({ id: makeId(s), slug: s, name }));
  const models = new Map<string, VehicleModel>();
  const vehicles: Vehicle[] = [];
  const byConfig = new Map<string, Vehicle[]>();

  for (const cfg of VEHICLE_CONFIGS) {
    const mid = modelId(cfg.make, cfg.model);
    if (!models.has(mid)) models.set(mid, { id: mid, makeId: makeId(cfg.make), slug: slug(cfg.model), name: cfg.model });
    const rows: Vehicle[] = [];
    for (let year = cfg.from; year <= cfg.to; year++) {
      rows.push({ id: vehicleId(cfg.key, year), makeId: makeId(cfg.make), modelId: mid, year, engine: cfg.engine, fuel: cfg.fuel, bodyType: cfg.body });
    }
    vehicles.push(...rows);
    byConfig.set(cfg.key, rows);
  }
  return { makes, models: [...models.values()], vehicles, byConfig };
}
