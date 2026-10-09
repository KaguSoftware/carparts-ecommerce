import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createId } from "@/lib/db/id";
import { resolveDataDir } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { Locale } from "@/i18n/routing";
import type { OutboxEmail } from "@/lib/services/contracts";
import type { Paged, PageParams } from "@/lib/types/domain";

/**
 * Mail transport abstraction. Today: a file outbox (no SMTP). To send real email, implement `Mailer`
 * (SMTP/SES/Resend ...) and return it from `getMailer()` for a new EMAIL_PROVIDER value.
 */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Template id, e.g. "order_confirmation" (shown in the admin outbox viewer). */
  template: string;
  locale: Locale;
}

export interface Mailer {
  send(message: MailMessage): Promise<OutboxEmail>;
  list(params?: PageParams & { to?: string }): Promise<Paged<OutboxEmail>>;
  get(id: string): Promise<OutboxEmail | null>;
}

export function outboxDir(): string {
  return env.OUTBOX_DIR ? path.resolve(/* turbopackIgnore: true */ process.cwd(), env.OUTBOX_DIR) : path.resolve(resolveDataDir(), "..", "outbox");
}

const SAFE_ID = /^[a-z0-9_]{6,40}$/;
const maskEmail = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

export class FileOutboxMailer implements Mailer {
  async send(message: MailMessage): Promise<OutboxEmail> {
    const dir = outboxDir();
    await fs.mkdir(dir, { recursive: true });
    const email: OutboxEmail = { id: createId("eml"), at: new Date().toISOString(), ...message };
    const file = path.join(dir, `${email.at.replace(/[:.]/g, "-")}_${email.id}.json`);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(email, null, 2), "utf8");
    await fs.rename(tmp, file);
    logger.info("email.queued", { template: message.template, to: maskEmail(message.to), id: email.id });
    return email;
  }

  private async readAll(): Promise<OutboxEmail[]> {
    let names: string[];
    try {
      names = (await fs.readdir(outboxDir())).filter((n) => n.endsWith(".json")).sort().reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return (
      await Promise.all(
        names.map(async (name) => {
          try {
            return JSON.parse(await fs.readFile(path.join(outboxDir(), name), "utf8")) as OutboxEmail;
          } catch {
            return null; // half-written or hand-edited file: skip rather than break the viewer
          }
        }),
      )
    ).filter((e): e is OutboxEmail => e !== null);
  }

  async list(params: PageParams & { to?: string } = {}): Promise<Paged<OutboxEmail>> {
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 25)));
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const to = params.to?.trim().toLowerCase();
    const all = (await this.readAll()).filter((e) => !to || e.to.toLowerCase().includes(to));
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize, pageCount: Math.max(1, Math.ceil(all.length / pageSize)) };
  }

  async get(id: string): Promise<OutboxEmail | null> {
    if (!SAFE_ID.test(id)) return null; // path traversal guard
    let names: string[];
    try {
      names = await fs.readdir(outboxDir());
    } catch {
      return null;
    }
    const name = names.find((n) => n.endsWith(`_${id}.json`));
    if (!name) return null;
    try {
      return JSON.parse(await fs.readFile(path.join(outboxDir(), name), "utf8")) as OutboxEmail;
    } catch {
      return null;
    }
  }
}

const KEY = Symbol.for("apexline.mailer");
type G = typeof globalThis & { [KEY]?: Mailer };

export function getMailer(): Mailer {
  const g = globalThis as G;
  return (g[KEY] ??= new FileOutboxMailer());
}
