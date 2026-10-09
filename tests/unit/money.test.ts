import { describe, expect, it } from "vitest";
import {
  allocate,
  applyBps,
  convertFromBase,
  currencyContextFor,
  discountPercent,
  formatMoney,
  parseMajorToMinor,
  percentOf,
} from "@/lib/money";
import { localize } from "@/lib/i18n-string";
import { slugify } from "@/lib/utils";

describe("money", () => {
  it("formats USD for en and TRY for tr using the rate", () => {
    expect(formatMoney(12999, "en")).toBe("$129.99");
    const tr = currencyContextFor("tr", 34.5);
    expect(tr.currency).toBe("TRY");
    expect(convertFromBase(1000, tr)).toBe(34500);
    expect(formatMoney(1000, "tr", tr)).toContain("345,00");
  });

  it("parses typed decimals into cents", () => {
    expect(parseMajorToMinor("12.5")).toBe(1250);
    expect(parseMajorToMinor("12,50")).toBe(1250);
    expect(parseMajorToMinor("1,299.00")).toBe(129900);
    expect(parseMajorToMinor("1.299,00")).toBe(129900);
    expect(parseMajorToMinor("abc")).toBeNaN();
  });

  it("rounds basis points half away from zero", () => {
    expect(applyBps(1999, 825)).toBe(165); // 164.9175
    expect(applyBps(-1999, 825)).toBe(-165);
    expect(percentOf(10000, 12.5)).toBe(1250);
  });

  it("allocates without losing cents", () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts.sort()).toEqual([33, 33, 34]);
    expect(allocate(10, [0, 0])).toEqual([0, 0]);
  });

  it("computes discount percent", () => {
    expect(discountPercent(7700, 10000)).toBe(23);
    expect(discountPercent(10000, 10000)).toBe(0);
  });
});

describe("i18n helpers", () => {
  it("localizes with fallback", () => {
    expect(localize({ en: "Brake pads", tr: "Balata" }, "tr")).toBe("Balata");
    expect(localize({ en: "Brake pads", tr: "" }, "tr")).toBe("Brake pads");
    expect(localize(null, "en")).toBe("");
  });

  it("slugifies Turkish text", () => {
    expect(slugify("Ön Fren Balatası & Disk")).toBe("on-fren-balatasi-and-disk");
  });
});
