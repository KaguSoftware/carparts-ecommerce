import type { Brand } from "@/lib/types/domain";
import type { SeedClock } from "./util";
import { DAY, L } from "./util";

/** All brands are invented for this demo. */
interface BrandDef {
  key: string;
  name: string;
  country: string;
  featured?: boolean;
  desc: [string, string];
}

export const BRAND_DEFS: BrandDef[] = [
  { key: "torqvane", name: "Torqvane", country: "US", featured: true, desc: ["Braking systems engineered in Michigan for daily drivers and track days alike.", "Michigan'da hem günlük sürücüler hem de pist günleri için tasarlanan fren sistemleri."] },
  { key: "veloxa", name: "Veloxa", country: "DE", featured: true, desc: ["German-engineered discs, pads and hydraulics with OE-grade tolerances.", "Orijinal ekipman toleranslarında Alman mühendisliği disk, balata ve hidrolik parçalar."] },
  { key: "stoppix", name: "Stoppix", country: "IT", desc: ["Italian friction specialists focused on quiet, consistent stopping.", "Sessiz ve tutarlı frenleme odaklı İtalyan sürtünme malzemesi uzmanı."] },
  { key: "kinetra", name: "Kinetra", country: "SE", featured: true, desc: ["Scandinavian chassis components built to survive salted winter roads.", "Tuzlu kış yollarına dayanacak şekilde üretilen İskandinav şasi parçaları."] },
  { key: "dampro", name: "Dampro", country: "DE", desc: ["Dampers, springs and links tuned for control and comfort.", "Kontrol ve konfor için ayarlanmış amortisör, yay ve z rotları."] },
  { key: "ridgewell", name: "Ridgewell", country: "US", desc: ["Heavy-duty suspension parts for trucks, SUVs and work vehicles.", "Kamyonet, SUV ve iş araçları için ağır hizmet süspansiyon parçaları."] },
  { key: "sparkine", name: "Sparkine", country: "JP", featured: true, desc: ["Ignition and sensor specialists with a reputation for cold-start reliability.", "Soğuk çalıştırma güvenilirliğiyle tanınan ateşleme ve sensör uzmanı."] },
  { key: "beltora", name: "Beltora", country: "PL", desc: ["Timing, drive-belt and mounting parts supplied to European assembly lines.", "Avrupa montaj hatlarına tedarik edilen triger, kayış ve takoz parçaları."] },
  { key: "sealwell", name: "Sealwell", country: "CZ", desc: ["Gaskets and seals cut from multi-layer steel and advanced elastomers.", "Çok katmanlı çelik ve gelişmiş elastomerlerden kesilen conta ve keçeler."] },
  { key: "filtravo", name: "Filtravo", country: "DE", featured: true, desc: ["Oil, fuel and transmission filtration with high dirt-holding capacity.", "Yüksek kir tutma kapasiteli yağ, yakıt ve şanzıman filtreleri."] },
  { key: "airnova", name: "Airnova", country: "FR", desc: ["Engine air filters that balance airflow and fine-particle capture.", "Hava akışı ile ince parçacık tutmayı dengeleyen motor hava filtreleri."] },
  { key: "clarivent", name: "Clarivent", country: "NL", desc: ["Cabin air filters with activated carbon and anti-allergen layers.", "Aktif karbon ve alerjen önleyici katmanlı polen filtreleri."] },
  { key: "lumora", name: "Lumora", country: "NL", featured: true, desc: ["Bright, long-life bulbs and LED kits for road and cabin.", "Yol ve kabin için parlak, uzun ömürlü ampul ve LED setleri."] },
  { key: "halovex", name: "Halovex", country: "CZ", desc: ["Headlight and tail-light assemblies with tested beam patterns.", "Işık deseni test edilmiş far ve stop lambası komple grupları."] },
  { key: "brightbeam", name: "Brightbeam", country: "KR", desc: ["Value-driven lighting upgrades for everyday vehicles.", "Günlük araçlar için fiyat/performans odaklı aydınlatma yükseltmeleri."] },
  { key: "voltara", name: "Voltara", country: "KR", featured: true, desc: ["Chargers, starters and electrical accessories for a dependable 12-volt system.", "Güvenilir bir 12 voltluk sistem için şarj cihazı, marş ve elektrik aksesuarları."] },
  { key: "cellforge", name: "Cellforge", country: "CZ", desc: ["AGM and flooded starter batteries with generous reserve capacity.", "Yüksek yedek kapasiteli AGM ve sulu marş aküleri."] },
  { key: "spinwell", name: "Spinwell", country: "TR", desc: ["Remanufactured alternators and starters, bench-tested before shipping.", "Gönderimden önce tezgahta test edilen yenilenmiş alternatör ve marş motorları."] },
  { key: "exhalon", name: "Exhalon", country: "PL", desc: ["Catalysts, mufflers and pipes tuned for low emissions and a calm exhaust note.", "Düşük emisyon ve dengeli egzoz sesi için ayarlanmış katalizör, susturucu ve borular."] },
  { key: "muffora", name: "Muffora", country: "ES", desc: ["Aluminised-steel exhaust parts built for long, rust-resistant service.", "Uzun ömürlü, paslanmaya dayanıklı alüminize çelik egzoz parçaları."] },
  { key: "coolvane", name: "Coolvane", country: "DE", featured: true, desc: ["Radiators, pumps and fans that keep engines at the right temperature.", "Motorları doğru sıcaklıkta tutan radyatör, pompa ve fanlar."] },
  { key: "thermaxo", name: "Thermaxo", country: "TR", desc: ["Cooling-system parts made in Turkey for demanding summer traffic.", "Zorlu yaz trafiği için Türkiye'de üretilen soğutma sistemi parçaları."] },
  { key: "swiftwipe", name: "Swiftwipe", country: "GB", desc: ["Wiper blades and screen-wash for streak-free visibility in any weather.", "Her havada çizgisiz görüş için silecek lastikleri ve cam suyu."] },
  { key: "carrosa", name: "Carrosa", country: "IT", desc: ["Mirrors, trim and protection made to fit and finish like the original.", "Orijinal gibi oturan ve tamamlanan ayna, dış donanım ve koruma parçaları."] },
  { key: "gripton", name: "Gripton", country: "TR", desc: ["Hard-wearing floor protection for family cars and workhorses.", "Aile araçları ve iş araçları için sağlam zemin koruması."] },
  { key: "lubrix", name: "Lubrix", country: "US", featured: true, desc: ["Synthetic oils and fluids formulated for modern engines and transmissions.", "Modern motor ve şanzımanlar için formüle edilmiş sentetik yağlar ve sıvılar."] },
  { key: "fluxoil", name: "Fluxoil", country: "TR", desc: ["Everyday lubricants and coolants with dependable protection at a fair price.", "Uygun fiyata güvenilir koruma sunan günlük yağlar ve antifrizler."] },
  { key: "apexline-select", name: "APEXLINE Select", country: "US", featured: true, desc: ["Our house brand: tested to original-equipment standards, priced for the workshop.", "Kendi markamız: orijinal ekipman standartlarında test edilir, atölye bütçesine uygun fiyatlanır."] },
];

export const brandId = (key: string) => `brd_${key}`;
export const BRAND_CODE: Record<string, string> = Object.fromEntries(
  BRAND_DEFS.map((b) => [b.key, b.key === "apexline-select" ? "APX" : b.key.slice(0, 3).toUpperCase()]),
);

export function buildBrands(clock: SeedClock): Brand[] {
  return BRAND_DEFS.map((b, i) => ({
    id: brandId(b.key),
    slug: b.key,
    name: b.name,
    description: L(b.desc[0], b.desc[1]),
    logo: `/products/brand-${b.key}.svg`,
    country: b.country,
    website: `https://${b.key.replace(/-/g, "")}.example`,
    isActive: true,
    isFeatured: Boolean(b.featured),
    sortOrder: i,
    createdAt: clock.ago(400 * DAY),
    updatedAt: clock.ago((20 + i) * DAY),
  }));
}
