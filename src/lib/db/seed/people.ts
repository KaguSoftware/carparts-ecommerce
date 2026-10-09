import { hashPassword } from "better-auth/crypto";
import type { Address, AddressInput, User, Wishlist } from "@/lib/types/domain";
import { SEED_CREDENTIALS } from "./credentials";
import { DAY, HOUR, type SeedClock } from "./util";

export interface PersonDef {
  id: string;
  email: string;
  name: string;
  locale: "en" | "tr";
  address: AddressInput;
  disabled?: boolean;
  marketingOptIn?: boolean;
  createdDaysAgo: number;
}

const addr = (
  firstName: string,
  lastName: string,
  line1: string,
  city: string,
  region: string,
  postalCode: string,
  country: string,
  phone: string,
  label = "Home",
): AddressInput => ({ label, firstName, lastName, line1, city, region, postalCode, country, phone });

/** Customers that own the sample orders. `usr_customer` is the documented demo shopper. */
export const CUSTOMERS: PersonDef[] = [
  {
    id: SEED_CREDENTIALS.customer.id,
    email: SEED_CREDENTIALS.customer.email,
    name: SEED_CREDENTIALS.customer.name,
    locale: "en",
    address: addr("Deniz", "Kaya", "2418 Cass Ave", "Detroit", "MI", "48201", "US", "+1 313 555 0142"),
    marketingOptIn: true,
    createdDaysAgo: 140,
  },
  { id: "usr_c01", email: "sofia.marino@mail.example", name: "Sofia Marino", locale: "en", address: addr("Sofia", "Marino", "415 W 52nd St", "New York", "NY", "10019", "US", "+1 212 555 0176"), createdDaysAgo: 120 },
  { id: "usr_c02", email: "liam.oconnor@mail.example", name: "Liam O'Connor", locale: "en", address: addr("Liam", "O'Connor", "7710 Burnet Rd", "Austin", "TX", "78757", "US", "+1 512 555 0123"), marketingOptIn: true, createdDaysAgo: 110 },
  { id: "usr_c03", email: "aylin.demir@mail.example", name: "Aylin Demir", locale: "tr", address: addr("Aylin", "Demir", "Caferağa Mah. Moda Cad. No: 41 D: 6", "İstanbul", "İstanbul", "34710", "TR", "+90 532 555 01 21"), marketingOptIn: true, createdDaysAgo: 95 },
  { id: "usr_c04", email: "kaan.yildiz@mail.example", name: "Kaan Yıldız", locale: "tr", address: addr("Kaan", "Yıldız", "Çankaya Mah. Atatürk Bulvarı No: 112", "Ankara", "Ankara", "06680", "TR", "+90 533 555 01 87"), createdDaysAgo: 88 },
  { id: "usr_c05", email: "emma.schneider@mail.example", name: "Emma Schneider", locale: "en", address: addr("Emma", "Schneider", "Torstraße 92", "Berlin", "Berlin", "10119", "DE", "+49 30 5550 142"), createdDaysAgo: 80 },
  { id: "usr_c06", email: "noor.haddad@mail.example", name: "Noor Haddad", locale: "en", address: addr("Noor", "Haddad", "14 Camden Mews", "London", "England", "NW1 9AB", "GB", "+44 20 7946 0112"), createdDaysAgo: 75 },
  { id: "usr_c07", email: "carlos.ortega@mail.example", name: "Carlos Ortega", locale: "en", address: addr("Carlos", "Ortega", "9012 Sunset Blvd", "Los Angeles", "CA", "90069", "US", "+1 310 555 0168"), marketingOptIn: true, createdDaysAgo: 70 },
  { id: "usr_c08", email: "zeynep.aksoy@mail.example", name: "Zeynep Aksoy", locale: "tr", address: addr("Zeynep", "Aksoy", "Alsancak Mah. Kıbrıs Şehitleri Cad. No: 77", "İzmir", "İzmir", "35220", "TR", "+90 535 555 01 64"), createdDaysAgo: 66 },
  { id: "usr_c09", email: "jack.turner@mail.example", name: "Jack Turner", locale: "en", address: addr("Jack", "Turner", "5521 Michigan Ave", "Detroit", "MI", "48210", "US", "+1 313 555 0199"), createdDaysAgo: 60 },
  { id: "usr_c10", email: "victor.hale@mail.example", name: "Victor Hale", locale: "en", address: addr("Victor", "Hale", "300 Biscayne Blvd", "Miami", "FL", "33131", "US", "+1 305 555 0150"), disabled: true, createdDaysAgo: 100 },
];

export const WORKSHOP_ADDRESS: AddressInput = {
  label: "Workshop",
  firstName: "Deniz",
  lastName: "Kaya",
  company: "Kaya Auto Repair",
  line1: "88 Mack Ave",
  city: "Detroit",
  region: "MI",
  postalCode: "48201",
  country: "US",
  phone: "+1 313 555 0188",
};

export interface PeopleData {
  users: User[];
  addresses: Address[];
  authAccounts: { id: string; userId: string; providerId: string; accountId: string; password: string; createdAt: string; updatedAt: string }[];
  wishlists: Wishlist[];
}

/**
 * Users + Better Auth credential accounts. Passwords are hashed with Better Auth's own `hashPassword`
 * (scrypt, `salt:key` format), so `auth.api.signInEmail` verifies them without any adapter tweaks.
 */
export async function buildPeople(clock: SeedClock, wishlistProductIds: string[]): Promise<PeopleData> {
  const [adminHash, staffHash, customerHash] = await Promise.all([
    hashPassword(SEED_CREDENTIALS.admin.password),
    hashPassword(SEED_CREDENTIALS.staff.password),
    hashPassword(SEED_CREDENTIALS.customer.password),
  ]);
  // The extra demo customers share the customer password (documented in README).

  const users: User[] = [];
  const authAccounts: PeopleData["authAccounts"] = [];

  const add = (u: Omit<User, "createdAt" | "updatedAt" | "image" | "emailVerified">, hash: string, createdDaysAgo: number) => {
    const createdAt = clock.ago(createdDaysAgo * DAY);
    users.push({ ...u, emailVerified: true, image: null, createdAt, updatedAt: createdAt });
    authAccounts.push({ id: `acc_${u.id.slice(4)}`, userId: u.id, providerId: "credential", accountId: u.id, password: hash, createdAt, updatedAt: createdAt });
  };

  add(
    { id: SEED_CREDENTIALS.admin.id, email: SEED_CREDENTIALS.admin.email, name: SEED_CREDENTIALS.admin.name, role: "admin", phone: "+1 313 555 0100", locale: "en", disabled: false, marketingOptIn: false, lastLoginAt: clock.ago(2 * HOUR) },
    adminHash,
    420,
  );
  add(
    { id: SEED_CREDENTIALS.staff.id, email: SEED_CREDENTIALS.staff.email, name: SEED_CREDENTIALS.staff.name, role: "staff", phone: "+1 313 555 0101", locale: "en", disabled: false, marketingOptIn: false, lastLoginAt: clock.ago(26 * HOUR) },
    staffHash,
    260,
  );
  for (const c of CUSTOMERS) {
    add(
      {
        id: c.id,
        email: c.email,
        name: c.name,
        role: "customer",
        phone: c.address.phone,
        locale: c.locale,
        disabled: Boolean(c.disabled),
        marketingOptIn: Boolean(c.marketingOptIn),
        lastLoginAt: c.disabled ? clock.ago(50 * DAY) : clock.ago(((c.createdDaysAgo % 9) + 1) * DAY),
      },
      customerHash,
      c.createdDaysAgo,
    );
  }

  const addresses: Address[] = CUSTOMERS.map((c) => ({
    id: `adr_${c.id.slice(4)}`,
    userId: c.id,
    ...c.address,
    isDefaultShipping: true,
    isDefaultBilling: true,
  }));
  addresses.push({ id: "adr_customer_work", userId: SEED_CREDENTIALS.customer.id, ...WORKSHOP_ADDRESS, isDefaultShipping: false, isDefaultBilling: false });

  const wishlists: Wishlist[] = [
    { id: "wsh_customer", userId: SEED_CREDENTIALS.customer.id, productIds: wishlistProductIds.slice(0, 6), updatedAt: clock.ago(3 * DAY) },
    { id: "wsh_c03", userId: "usr_c03", productIds: wishlistProductIds.slice(6, 9), updatedAt: clock.ago(8 * DAY) },
  ];

  return { users, addresses, authAccounts, wishlists };
}
