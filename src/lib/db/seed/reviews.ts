import type { Review } from "@/lib/types/domain";
import type { BuiltProduct } from "./catalog/build";
import { SEED_CREDENTIALS } from "./credentials";
import { DAY, Rng, pad, type SeedClock } from "./util";

type Template = { title: string; body: string };

/** {part} = plural/mass noun in lower case, {Part} = same with a capital first letter. */
const EN: Record<number, Template[]> = {
  5: [
    { title: "Exactly what I needed", body: "Ordered the {part} for my daily driver and they arrived in two days. Quality is excellent and the price beat my local shop." },
    { title: "Fits perfectly", body: "{Part}: fitment was spot on after using the vehicle selector. Packaging was solid and everything was in the box." },
    { title: "Great value", body: "Compared a few brands before choosing this one. No regrets so far, and it is noticeably better than the cheap {part} I had before." },
    { title: "Highly recommend", body: "Fitted over the weekend with basic tools. No surprises, nothing missing. Would buy these {part} again." },
    { title: "Better than the original", body: "Honestly I think these {part} are better than the ones the car came with. Solid, quiet and well finished." },
    { title: "Five stars", body: "Fast shipping, well packed and the {part} look exactly like the photos. Happy customer." },
    { title: "Solid purchase", body: "My mechanic commented on the build quality of these {part}. Zero issues after a few thousand kilometres." },
    { title: "A real difference", body: "You can feel the improvement straight away. I should have replaced the {part} much sooner." },
  ],
  4: [
    { title: "Good, with one small caveat", body: "Quality {part} and good value. Delivery took a day longer than quoted, otherwise perfect." },
    { title: "Does the job", body: "Fits well and works as expected. The packaging could be better but the {part} themselves are great." },
    { title: "Happy overall", body: "Solid {part} for the money. Lost one star because the instructions were minimal." },
    { title: "Very good", body: "Nice finish and the fit was right first time. A bit pricier than I hoped, but worth it." },
  ],
  3: [
    { title: "Okay for the price", body: "The {part} are fine but nothing special. Fitment needed a little persuasion." },
    { title: "Average", body: "Does what it should. I expected a bit more from the finish, but no complaints about how they work." },
    { title: "Decent", body: "Perfectly usable {part}. Shipping was slower than I would have liked." },
  ],
  2: [
    { title: "Not quite right", body: "The {part} fit, but the finish was rough and one fastener was missing. Support replaced it quickly." },
    { title: "Disappointed", body: "A faint noise appeared after a few hundred kilometres. Contacted support and waiting for a resolution." },
  ],
  1: [
    { title: "Wrong item in the box", body: "I received a different version of the {part}. The return was processed quickly and I was refunded." },
    { title: "Failed early", body: "These {part} stopped working after a few weeks. Returning under warranty." },
  ],
};

const TR: Record<number, Template[]> = {
  5: [
    { title: "Tam ihtiyacım olan ürün", body: "Günlük aracım için aldım, iki günde elime ulaştı. Bu {part} kaliteli ve fiyatı yerel servisten daha uygundu." },
    { title: "Tam oturdu", body: "Araç seçiciyle seçim yaptım ve bu {part} tam uydu. Paketleme sağlamdı, kutudan her şey çıktı." },
    { title: "Fiyatına değer", body: "Birkaç markayı karşılaştırdım ve bunu seçtim. Şimdiye kadar pişman olmadım; önceki ucuz ürüne göre bariz şekilde daha iyi." },
    { title: "Kesinlikle tavsiye ederim", body: "Hafta sonu temel aletlerle taktım. Sürpriz yok, eksik parça yok. Bu {part} tekrar alırım." },
    { title: "Orijinalinden iyi", body: "Açıkçası bu {part} aracın orijinallerinden daha iyi hissettiriyor. Sağlam, sessiz ve işçiliği güzel." },
    { title: "Beş yıldız", body: "Hızlı kargo, iyi paketlenmiş. Bu {part} fotoğraftakiyle birebir aynı. Memnunum." },
    { title: "Sağlam alışveriş", body: "Ustam bu {part} için yapı kalitesine dikkat çekti. Birkaç bin kilometredir hiçbir sorun yok." },
    { title: "Fark ediliyor", body: "İyileşme hemen hissediliyor. Bu {part} çok daha önce değiştirmem gerekirmiş." },
  ],
  4: [
    { title: "İyi, küçük bir not var", body: "Kaliteli bu {part} ve fiyatı uygun. Teslimat söylenenden bir gün geç geldi, onun dışında mükemmel." },
    { title: "İşini yapıyor", body: "İyi oturdu ve beklendiği gibi çalışıyor. Paketleme daha iyi olabilirdi ama ürünün kendisi harika." },
    { title: "Genel olarak memnunum", body: "Parasına göre sağlam bir ürün. Montaj talimatı çok kısa olduğu için bir yıldız kırdım." },
    { title: "Çok iyi", body: "Yüzey işçiliği güzel ve ilk seferde oturdu. Beklediğimden biraz pahalı ama değer." },
  ],
  3: [
    { title: "Fiyatına göre idare eder", body: "Bu {part} fena değil ama özel de değil. Montajda biraz zorlandım." },
    { title: "Ortalama", body: "Olması gerekeni yapıyor. Yüzey işçiliğinden biraz daha fazlasını beklerdim ama çalışmasında sorun yok." },
    { title: "Fena değil", body: "Kullanılabilir bir ürün. Kargo istediğimden yavaştı." },
  ],
  2: [
    { title: "Pek iyi değil", body: "Bu {part} uydu ama yüzey pürüzlüydü ve bir bağlantı elemanı eksikti. Destek ekibi hızlıca yenisini gönderdi." },
    { title: "Hayal kırıklığı", body: "Birkaç yüz kilometre sonra hafif bir ses başladı. Destek ile iletişime geçtim, çözüm bekliyorum." },
  ],
  1: [
    { title: "Kutudan yanlış ürün çıktı", body: "Bu {part} için farklı bir versiyon gönderilmiş. İade hızlıca işleme alındı ve ücretim iade edildi." },
    { title: "Çabuk bozuldu", body: "Bu {part} birkaç hafta sonra çalışmayı bıraktı. Garanti kapsamında iade ediyorum." },
  ],
};

const NAMES_EN = ["Marcus T.", "Elena R.", "Chris P.", "Jordan M.", "Priya S.", "Tom H.", "Sarah L.", "Diego F.", "Hannah W.", "Ryan K.", "Olivia B.", "Ben C.", "Mia J.", "Nate D.", "Lucas G.", "Grace A.", "Owen P.", "Isabel V."];
const NAMES_TR = ["Ahmet Y.", "Elif K.", "Mehmet D.", "Zeynep A.", "Burak S.", "Ayşe T.", "Emre C.", "Selin B.", "Murat Ö.", "Derya H.", "Can U.", "Gizem P.", "Kerem A.", "Merve Ş.", "Onur E.", "Esra N."];

const REPLIES_EN = [
  "Thank you for the feedback! We are glad the part is working well for you.",
  "Thanks for taking the time to review. If anything changes, our support team is one message away.",
];
const REPLIES_TR = ["Geri bildiriminiz için teşekkür ederiz! Parçanın sizin için iyi çalışmasına sevindik.", "Değerlendirmeniz için teşekkürler. Bir şey değişirse destek ekibimiz bir mesaj uzağınızda."];

/** Templates that talk about vehicle fitment; skipped for universal products (oil, bulbs, chargers ...). */
const FIT_TITLES = new Set(["Fits perfectly", "Does the job", "Very good", "Okay for the price", "Not quite right", "Tam oturdu", "İşini yapıyor", "Çok iyi", "Fiyatına göre idare eder", "Pek iyi değil"]);

const cap = (s: string, locale: "en" | "tr") => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);

export interface ReviewsData {
  reviews: Review[];
  reviewVotes: { id: string; reviewId: string; voterKey: string; at: string }[];
}

/** ~250 reviews across the active catalogue; ratings skew positive and track the product tier. */
export function buildReviews(clock: SeedClock, built: BuiltProduct[], purchased: Map<string, Set<string>>): ReviewsData {
  const rng = new Rng("reviews");
  const reviews: Review[] = [];
  let seq = 0;

  const make = (b: BuiltProduct, opts: { userId?: string; authorName?: string; rating?: 1 | 2 | 3 | 4 | 5; locale?: "en" | "tr"; verified?: boolean; status?: Review["status"]; minAgeDays?: number }): Review => {
    const locale = opts.locale ?? (rng.chance(0.58) ? "en" : "tr");
    const tierBoost = b.offer.tier === "premium" || b.offer.tier === "performance" ? 0.06 : b.offer.tier === "value" ? -0.08 : 0;
    const roll = rng.next() - tierBoost;
    const rating = opts.rating ?? (roll < 0.55 ? 5 : roll < 0.8 ? 4 : roll < 0.9 ? 3 : roll < 0.96 ? 2 : 1);
    const all = (locale === "en" ? EN : TR)[rating]!;
    const templates = b.family.fitment === "universal" ? all.filter((t) => !FIT_TITLES.has(t.title)) : all;
    const tpl = rng.pick(templates.length ? templates : all);
    const noun = locale === "en" ? b.family.noun.en : b.family.noun.tr;
    const fill = (s: string) => s.replaceAll("{Part}", cap(noun, locale)).replaceAll("{part}", noun);
    const productAge = Math.max(4, Math.floor((clock.now - Date.parse(b.product.createdAt)) / DAY));
    const ageDays = Math.max(opts.minAgeDays ?? 0, rng.int(1, Math.max(2, productAge - 2)));
    const at = new Date(clock.now - ageDays * DAY - rng.int(0, 20) * 3_600_000).toISOString();
    seq++;
    const status: Review["status"] = opts.status ?? "approved";
    return {
      id: `rev_${pad(seq, 4)}`,
      productId: b.product.id,
      userId: opts.userId ?? null,
      authorName: opts.authorName ?? rng.pick(locale === "en" ? NAMES_EN : NAMES_TR),
      rating,
      title: tpl.title,
      body: fill(tpl.body),
      locale,
      status,
      verifiedPurchase: opts.verified ?? rng.chance(0.62),
      helpfulCount: status === "approved" ? Math.max(0, rng.int(-4, 14)) : 0,
      createdAt: at,
      updatedAt: at,
    };
  };

  const active = built.filter((b) => b.product.status === "active");

  for (const b of active) {
    const weight = b.product.isFeatured ? 5 : b.offer.tier === "value" ? 2 : 3;
    const count = rng.chance(0.14) ? 0 : rng.int(1, weight + 1);
    for (let i = 0; i < count; i++) {
      const r = rng.next();
      reviews.push(make(b, { status: r < 0.9 ? "approved" : r < 0.97 ? "pending" : "rejected" }));
    }
  }

  // Verified reviews by the demo customer for things they actually received.
  const customerProducts = [...(purchased.get(SEED_CREDENTIALS.customer.id) ?? [])];
  customerProducts.slice(0, 3).forEach((pid, i) => {
    const b = built.find((x) => x.product.id === pid);
    if (!b) return;
    reviews.push(
      make(b, { userId: SEED_CREDENTIALS.customer.id, authorName: "Deniz K.", locale: "en", rating: i === 1 ? 4 : 5, verified: true, status: "approved", minAgeDays: 2 }),
    );
  });

  // Make sure the moderation queue always has something in it, and a few staff replies exist.
  const pendingCount = reviews.filter((r) => r.status === "pending").length;
  for (let i = pendingCount; i < 6; i++) {
    const b = rng.pick(active);
    reviews.push(make(b, { status: "pending", minAgeDays: 1 }));
  }
  reviews
    .filter((r) => r.status === "approved" && (r.rating === 4 || r.rating === 5))
    .slice(0, 8)
    .forEach((r, i) => {
      if (i % 2) return;
      const text = (r.locale === "en" ? REPLIES_EN : REPLIES_TR)[i % 2]!;
      r.adminReply = { body: text, at: new Date(Date.parse(r.createdAt) + DAY).toISOString(), by: SEED_CREDENTIALS.staff.name };
    });

  // A handful of helpful votes tied to real reviews.
  const reviewVotes: ReviewsData["reviewVotes"] = [];
  reviews
    .filter((r) => r.status === "approved")
    .slice(0, 24)
    .forEach((r, i) => {
      reviewVotes.push({ id: `vot_${pad(i + 1, 3)}`, reviewId: r.id, voterKey: `ip:${rng.int(10, 240)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`, at: r.createdAt });
    });

  // A product with one review cannot have a dozen helpful votes: scale the count with how many reviews it has.
  const approvedPerProduct = new Map<string, number>();
  for (const r of reviews) if (r.status === "approved") approvedPerProduct.set(r.productId, (approvedPerProduct.get(r.productId) ?? 0) + 1);
  for (const r of reviews) {
    if (r.status !== "approved") continue;
    const cap = Math.max(1, (approvedPerProduct.get(r.productId) ?? 1) * 2 - 1);
    r.helpfulCount = Math.min(r.helpfulCount, cap);
  }

  reviews.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { reviews, reviewVotes };
}

/** Writes rating aggregates (approved reviews only) and sold counts into the products. */
export function applyAggregates(built: BuiltProduct[], reviews: Review[], unitsSold: Map<string, number>): void {
  const rng = new Rng("sold");
  for (const b of built) {
    const approved = reviews.filter((r) => r.productId === b.product.id && r.status === "approved");
    b.product.ratingCount = approved.length;
    b.product.ratingAverage = approved.length ? Math.round((approved.reduce((s, r) => s + r.rating, 0) / approved.length) * 10) / 10 : 0;
    const base = b.product.status === "active" ? rng.int(8, 40) + (b.product.isFeatured ? rng.int(60, 300) : rng.int(0, 120)) : rng.int(0, 20);
    b.product.soldCount = Math.max(0, base + (unitsSold.get(b.product.id) ?? 0));
  }
}
