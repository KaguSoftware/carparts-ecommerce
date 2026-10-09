"use client";

import { useState } from "react";
import { Input, type InputProps } from "@/components/ui/Input";
import { minorToMajorString, parseMajorToMinor } from "@/lib/money";
import { parseIntInput } from "./form-utils";

type BaseProps = Omit<InputProps, "value" | "onChange" | "type" | "defaultValue">;

/**
 * Whole-number input that reports `undefined` when blank. Keeps the typed text locally so partial input
 * ("-", "") never fights the controlled value; an external reset (form.reset) shows through.
 */
export function IntegerInput({ value, onChange, ...props }: BaseProps & { value: number | undefined; onChange: (value: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const display = parseIntInput(text) === value ? text : value === undefined ? "" : String(value);
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseIntInput(e.target.value));
      }}
    />
  );
}

const parseMoney = (s: string): number | undefined => {
  const n = parseMajorToMinor(s);
  return Number.isNaN(n) ? undefined : n;
};

/** USD amount typed as dollars ("12.50"), reported as integer cents. Shows a "$" prefix. */
export function MoneyInput({ value, onChange, ...props }: BaseProps & { value: number | undefined; onChange: (cents: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? "" : minorToMajorString(value));
  const display = parseMoney(text) === value ? text : value === undefined ? "" : minorToMajorString(value);
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      leading="$"
      className="num"
      value={display}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseMoney(e.target.value));
      }}
    />
  );
}

const splitList = (s: string): string[] =>
  s
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Comma separated values <-> string[] (tags, OEM numbers, country codes). */
export function ListInput({ value, onChange, ...props }: BaseProps & { value: string[]; onChange: (value: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  const same = JSON.stringify(splitList(text)) === JSON.stringify(value);
  return (
    <Input
      {...props}
      type="text"
      value={same ? text : value.join(", ")}
      onChange={(e) => {
        setText(e.target.value);
        onChange(splitList(e.target.value));
      }}
    />
  );
}

const parseBps = (s: string): number | undefined => {
  const t = s.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
  return Math.round(parseFloat(t) * 100);
};
const bpsToText = (bps: number): string => String(bps / 100);

/** Percentage typed as "8.25", reported as basis points (825). Shows a "%" suffix. */
export function PercentInput({ value, onChange, ...props }: BaseProps & { value: number | undefined; onChange: (bps: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? "" : bpsToText(value));
  const display = parseBps(text) === value ? text : value === undefined ? "" : bpsToText(value);
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      trailing="%"
      className="num"
      value={display}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseBps(e.target.value));
      }}
    />
  );
}
