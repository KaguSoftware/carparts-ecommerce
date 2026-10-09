/**
 * Development-only accounts created by the seed. Documented in README.md; the same values are used by the
 * Playwright e2e tests. NEVER deploy with these: change or delete them before going live.
 */
export const SEED_CREDENTIALS = {
  admin: { id: "usr_admin", email: "admin@apexline.example", password: "Admin#Apex2026!", name: "Ada Mercer", role: "admin" },
  staff: { id: "usr_staff", email: "staff@apexline.example", password: "Staff#Apex2026!", name: "Noah Whitfield", role: "staff" },
  customer: { id: "usr_customer", email: "customer@apexline.example", password: "Customer#Apex2026!", name: "Deniz Kaya", role: "customer" },
} as const;

