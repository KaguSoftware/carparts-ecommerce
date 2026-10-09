import { get, type FieldErrors, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";

/**
 * Helpers shared by every RHF form in the account / checkout area.
 * Convention: validation messages are CODES (see ARCHITECTURE.md > Server Actions); translate at render time with
 * `useErrorText().validation`.
 */

/** First error code for a (possibly nested) field name, or undefined. */
export function errorCode<T extends FieldValues>(errors: FieldErrors<T>, name: string): string | undefined {
  const entry = get(errors, name) as { message?: unknown } | undefined;
  return typeof entry?.message === "string" && entry.message ? entry.message : undefined;
}

/**
 * Pushes server `fieldErrors` ({ "shippingAddress.postalCode": ["required"] }) into the form. `mapKey` renames server
 * paths to form field names (return null to leave a key unmapped). Returns the keys that could not be mapped so the
 * caller can fall back to a banner. Focuses the first mapped field.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldErrors: Record<string, string[]> | undefined,
  mapKey: (serverKey: string) => string | null = (key) => key,
): string[] {
  const unmapped: string[] = [];
  let first = true;
  for (const [key, codes] of Object.entries(fieldErrors ?? {})) {
    const code = codes[0];
    const name = mapKey(key);
    if (!code || !name) {
      unmapped.push(key);
      continue;
    }
    form.setError(name as Path<T>, { type: "server", message: code }, { shouldFocus: first });
    first = false;
  }
  return unmapped;
}
