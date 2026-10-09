/**
 * Domain error thrown by services. `code` is a stable snake_case identifier that maps to a
 * translation under `errors.<code>` in the common message fragment. Server Actions / route
 * handlers catch it and turn it into an ActionResult / HTTP response.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly params?: Record<string, string | number>;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: string,
    opts: { params?: Record<string, string | number>; status?: number; fieldErrors?: Record<string, string[]>; message?: string } = {},
  ) {
    super(opts.message ?? code);
    this.name = "DomainError";
    this.code = code;
    this.params = opts.params;
    this.status = opts.status ?? 400;
    this.fieldErrors = opts.fieldErrors;
  }
}

export const notFound = (what = "resource") => new DomainError("not_found", { status: 404, params: { what } });
export const conflict = (code = "conflict") => new DomainError(code, { status: 409 });
export const forbidden = () => new DomainError("forbidden", { status: 403 });
export const unauthorized = () => new DomainError("unauthorized", { status: 401 });

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
