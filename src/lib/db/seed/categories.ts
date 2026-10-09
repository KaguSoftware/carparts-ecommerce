import type { Category } from "@/lib/types/domain";
import type { SeedClock } from "./util";
import { DAY, L } from "./util";

interface SubDef {
  slug: string;
  name: [string, string];
  desc: [string, string];
}
interface TopDef {
  slug: string;
  icon: string;
  name: [string, string];
  desc: [string, string];
  subs: SubDef[];
}

const TOP: TopDef[] = [
  {
    slug: "brakes",
    icon: "Disc3",
    name: ["Brakes", "Frenler"],
    desc: ["Pads, discs, calipers and hardware to stop with confidence.", "Güvenle durmanızı sağlayan balata, disk, kaliper ve bağlantı parçaları."],
    subs: [
      { slug: "brake-pads", name: ["Brake Pads", "Fren Balataları"], desc: ["Ceramic and semi-metallic pad sets for every axle.", "Her aks için seramik ve yarı metalik balata setleri."] },
      { slug: "brake-discs", name: ["Brake Discs", "Fren Diskleri"], desc: ["Vented and performance rotors, sold as pairs.", "Çift olarak satılan havalandırmalı ve performans diskleri."] },
      { slug: "brake-calipers", name: ["Brake Calipers", "Fren Kaliperleri"], desc: ["Remanufactured calipers tested under pressure.", "Basınç altında test edilmiş yenilenmiş kaliperler."] },
      { slug: "brake-hardware", name: ["Hoses, Sensors & Shoes", "Hortum, Sensör ve Kampana Balata"], desc: ["Braided hoses, wear sensors and drum brake shoes.", "Örgülü hortumlar, aşınma sensörleri ve kampana balatalar."] },
    ],
  },
  {
    slug: "engine",
    icon: "Cog",
    name: ["Engine", "Motor"],
    desc: ["Ignition, timing, gaskets and sensors for a healthy engine.", "Sağlıklı bir motor için ateşleme, triger, conta ve sensör parçaları."],
    subs: [
      { slug: "ignition", name: ["Ignition", "Ateşleme"], desc: ["Spark plugs and ignition coils.", "Bujiler ve ateşleme bobinleri."] },
      { slug: "belts-timing", name: ["Belts & Timing", "Kayış ve Triger"], desc: ["Timing belt kits and serpentine belts.", "Triger setleri ve alternatör kayışları."] },
      { slug: "gaskets-seals", name: ["Gaskets & Seals", "Conta ve Keçeler"], desc: ["Head gasket sets and valve cover gaskets.", "Silindir kapak conta setleri ve külbütör kapak contaları."] },
      { slug: "engine-mounts", name: ["Engine Mounts", "Motor Takozları"], desc: ["Hydraulic mounts that tame vibration.", "Titreşimi bastıran hidrolik takozlar."] },
      { slug: "engine-sensors", name: ["Engine Sensors", "Motor Sensörleri"], desc: ["Airflow and position sensors.", "Hava akış ve konum sensörleri."] },
    ],
  },
  {
    slug: "suspension",
    icon: "Activity",
    name: ["Suspension", "Süspansiyon"],
    desc: ["Shocks, struts, springs and arms for a planted, comfortable ride.", "Yere basan ve konforlu bir sürüş için amortisör, yay ve salıncaklar."],
    subs: [
      { slug: "shocks-struts", name: ["Shocks & Struts", "Amortisörler"], desc: ["Gas-pressure shocks and complete strut assemblies.", "Gaz basınçlı amortisörler ve komple amortisör takımları."] },
      { slug: "springs", name: ["Springs", "Yaylar"], desc: ["Coil springs matched to your vehicle's ride height.", "Aracınızın yüksekliğine uygun helezon yaylar."] },
      { slug: "control-arms-joints", name: ["Control Arms & Joints", "Salıncak ve Rotiller"], desc: ["Control arms and ball joints.", "Salıncaklar ve rotiller."] },
      { slug: "stabiliser-links", name: ["Stabiliser Links", "Z Rotları"], desc: ["Anti-roll bar links that remove clunks.", "Tıkırtıyı gideren denge çubuğu rotları."] },
      { slug: "wheel-bearings", name: ["Wheel Bearings", "Teker Rulmanları"], desc: ["Hub and bearing assemblies.", "Poyra ve rulman grupları."] },
      { slug: "bushings", name: ["Bushings", "Burçlar"], desc: ["Rubber and polyurethane bushing kits.", "Kauçuk ve poliüretan burç setleri."] },
    ],
  },
  {
    slug: "filters",
    icon: "Filter",
    name: ["Filters", "Filtreler"],
    desc: ["Oil, air, cabin, fuel and transmission filters.", "Yağ, hava, polen, yakıt ve şanzıman filtreleri."],
    subs: [
      { slug: "oil-filters", name: ["Oil Filters", "Yağ Filtreleri"], desc: ["Spin-on and cartridge oil filters.", "Vidalı ve kartuş tipi yağ filtreleri."] },
      { slug: "air-filters", name: ["Air Filters", "Hava Filtreleri"], desc: ["Panel and high-flow engine air filters.", "Panel ve yüksek akışlı motor hava filtreleri."] },
      { slug: "cabin-filters", name: ["Cabin Filters", "Polen Filtreleri"], desc: ["Carbon and anti-allergen cabin filters.", "Karbonlu ve alerjen önleyici polen filtreleri."] },
      { slug: "fuel-filters", name: ["Fuel Filters", "Yakıt Filtreleri"], desc: ["Petrol and diesel fuel filters.", "Benzin ve dizel yakıt filtreleri."] },
      { slug: "transmission-filters", name: ["Transmission Filters", "Şanzıman Filtreleri"], desc: ["Automatic transmission filter kits.", "Otomatik şanzıman filtre setleri."] },
    ],
  },
  {
    slug: "lighting",
    icon: "Lightbulb",
    name: ["Lighting", "Aydınlatma"],
    desc: ["Bulbs, headlights and lamps that light the road ahead.", "Önünüzü aydınlatan ampuller, farlar ve lambalar."],
    subs: [
      { slug: "headlights", name: ["Headlights", "Farlar"], desc: ["Complete headlight assemblies.", "Komple far grupları."] },
      { slug: "bulbs", name: ["Bulbs", "Ampuller"], desc: ["Halogen, LED and xenon bulbs.", "Halojen, LED ve xenon ampuller."] },
      { slug: "tail-lights", name: ["Tail Lights", "Stoplar"], desc: ["LED and bulb tail light assemblies.", "LED ve ampullü stop lambası grupları."] },
      { slug: "fog-lights", name: ["Fog Lights", "Sis Farları"], desc: ["Fog and driving light kits.", "Sis ve sürüş ışığı setleri."] },
      { slug: "interior-lighting", name: ["Interior Lighting", "İç Aydınlatma"], desc: ["Cabin and footwell LED kits.", "Kabin ve ayak boşluğu LED setleri."] },
    ],
  },
  {
    slug: "electrical",
    icon: "Zap",
    name: ["Electrical", "Elektrik"],
    desc: ["Batteries, alternators, starters and charging gear.", "Akü, alternatör, marş motoru ve şarj ekipmanları."],
    subs: [
      { slug: "batteries", name: ["Batteries", "Aküler"], desc: ["AGM and maintenance-free starter batteries.", "AGM ve bakımsız marş aküleri."] },
      { slug: "alternators-starters", name: ["Alternators & Starters", "Alternatör ve Marş Motorları"], desc: ["Remanufactured and tested to spec.", "Yenilenmiş ve spesifikasyona göre test edilmiş."] },
      { slug: "charging-jump-starting", name: ["Charging & Jump Starting", "Şarj ve Takviye"], desc: ["Smart chargers and jump starters.", "Akıllı şarj cihazları ve takviye cihazları."] },
      { slug: "fuses-relays", name: ["Fuses & Relays", "Sigorta ve Röleler"], desc: ["Blade fuse kits and 12 V relays.", "Bıçak sigorta setleri ve 12 V röleler."] },
    ],
  },
  {
    slug: "exhaust",
    icon: "Wind",
    name: ["Exhaust", "Egzoz"],
    desc: ["Mufflers, catalysts, pipes and sensors for a clean, quiet exhaust.", "Temiz ve sessiz bir egzoz için susturucu, katalizör, boru ve sensörler."],
    subs: [
      { slug: "mufflers", name: ["Mufflers", "Susturucular"], desc: ["Rear and middle silencers.", "Arka ve orta susturucular."] },
      { slug: "catalytic-converters", name: ["Catalytic Converters", "Katalitik Konvertörler"], desc: ["Euro 6 compliant catalysts.", "Euro 6 uyumlu katalizörler."] },
      { slug: "pipes-flex", name: ["Pipes & Flex", "Borular ve Körükler"], desc: ["Flex joints, middle pipes and resonators.", "Körükler, orta borular ve rezonatörler."] },
      { slug: "lambda-sensors", name: ["Lambda Sensors", "Lambda Sensörleri"], desc: ["Oxygen sensors for correct fuelling.", "Doğru yakıt karışımı için oksijen sensörleri."] },
      { slug: "exhaust-gaskets", name: ["Gaskets & Clamps", "Conta ve Kelepçeler"], desc: ["Seals and clamps for leak-free joints.", "Kaçaksız bağlantılar için conta ve kelepçeler."] },
    ],
  },
  {
    slug: "cooling",
    icon: "Thermometer",
    name: ["Cooling", "Soğutma"],
    desc: ["Radiators, pumps, thermostats and fans to beat the heat.", "Sıcağı yenmek için radyatör, pompa, termostat ve fanlar."],
    subs: [
      { slug: "radiators", name: ["Radiators", "Radyatörler"], desc: ["Aluminium core radiators.", "Alüminyum petekli radyatörler."] },
      { slug: "water-pumps", name: ["Water Pumps", "Devirdaim Pompaları"], desc: ["Water pumps with metal impellers.", "Metal çarklı devirdaim pompaları."] },
      { slug: "thermostats", name: ["Thermostats", "Termostatlar"], desc: ["Thermostats and housings.", "Termostatlar ve yuvaları."] },
      { slug: "hoses-caps", name: ["Hoses & Caps", "Hortumlar ve Kapaklar"], desc: ["Coolant hoses and pressure caps.", "Soğutma sıvısı hortumları ve basınç kapakları."] },
      { slug: "cooling-fans", name: ["Cooling Fans", "Soğutma Fanları"], desc: ["Electric radiator fans.", "Elektrikli radyatör fanları."] },
      { slug: "expansion-tanks", name: ["Expansion Tanks", "Genleşme Depoları"], desc: ["Coolant expansion tanks.", "Soğutma suyu genleşme depoları."] },
    ],
  },
  {
    slug: "body",
    icon: "CarFront",
    name: ["Body", "Kaporta"],
    desc: ["Wipers, mirrors, mats and exterior parts.", "Silecekler, aynalar, paspaslar ve dış donanım parçaları."],
    subs: [
      { slug: "wipers", name: ["Wipers", "Silecekler"], desc: ["Front and rear wiper blades.", "Ön ve arka silecek lastikleri."] },
      { slug: "mirrors", name: ["Mirrors", "Aynalar"], desc: ["Replacement mirror glass.", "Yedek ayna camları."] },
      { slug: "mats-protection", name: ["Mats & Protection", "Paspas ve Koruma"], desc: ["Floor mats and mud flaps.", "Paspaslar ve çamurluk lastikleri."] },
      { slug: "exterior-trim", name: ["Exterior Parts", "Dış Donanım"], desc: ["Door handles and hood struts.", "Kapı kolları ve kaput amortisörleri."] },
    ],
  },
  {
    slug: "fluids",
    icon: "Droplets",
    name: ["Fluids", "Sıvılar"],
    desc: ["Engine oil, brake fluid, coolant and other essential fluids.", "Motor yağı, fren hidroliği, antifriz ve diğer temel sıvılar."],
    subs: [
      { slug: "engine-oil", name: ["Engine Oil", "Motor Yağları"], desc: ["Synthetic and semi-synthetic engine oils.", "Sentetik ve yarı sentetik motor yağları."] },
      { slug: "brake-fluid", name: ["Brake Fluid", "Fren Hidroliği"], desc: ["DOT 4 brake fluid.", "DOT 4 fren hidroliği."] },
      { slug: "coolant", name: ["Coolant", "Antifriz"], desc: ["Long-life coolant concentrates.", "Uzun ömürlü antifriz konsantreleri."] },
      { slug: "transmission-fluid", name: ["Transmission Fluid", "Şanzıman Yağı"], desc: ["ATF for automatic gearboxes.", "Otomatik şanzımanlar için ATF."] },
      { slug: "washer-fluid", name: ["Washer Fluid", "Cam Suyu"], desc: ["Screen-wash concentrates.", "Cam suyu konsantreleri."] },
    ],
  },
];

export const categoryId = (slug: string) => `cat_${slug}`;

/** slug -> parent slug for every subcategory. */
export const PARENT_OF: Record<string, string> = Object.fromEntries(TOP.flatMap((t) => t.subs.map((s) => [s.slug, t.slug])));
export const TOP_SLUGS = TOP.map((t) => t.slug);

export function buildCategories(clock: SeedClock): Category[] {
  const out: Category[] = [];
  TOP.forEach((top, ti) => {
    out.push({
      id: categoryId(top.slug),
      slug: top.slug,
      parentId: null,
      name: L(top.name[0], top.name[1]),
      description: L(top.desc[0], top.desc[1]),
      image: `/products/cat-${top.slug}.svg`,
      icon: top.icon,
      sortOrder: ti,
      isActive: true,
      seoTitle: L(`${top.name[0]} - Car Parts`, `${top.name[1]} - Oto Yedek Parça`),
      seoDescription: L(top.desc[0], top.desc[1]),
      createdAt: clock.ago(420 * DAY),
      updatedAt: clock.ago(30 * DAY),
    });
    top.subs.forEach((sub, si) => {
      out.push({
        id: categoryId(sub.slug),
        slug: sub.slug,
        parentId: categoryId(top.slug),
        name: L(sub.name[0], sub.name[1]),
        description: L(sub.desc[0], sub.desc[1]),
        image: `/products/cat-${top.slug}.svg`,
        sortOrder: si,
        isActive: true,
        createdAt: clock.ago(420 * DAY),
        updatedAt: clock.ago(30 * DAY),
      });
    });
  });
  return out;
}
