import "server-only";

/** Base class for persistence-layer failures. Services translate these into DomainErrors when needed. */
export class DbError extends Error {
  readonly code: string;
  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DbError";
    this.code = code;
  }
}

/** `insert` with an id that already exists. */
export class DuplicateIdError extends DbError {
  constructor(collection: string, id: string) {
    super("duplicate_id", `Duplicate id "${id}" in collection "${collection}"`);
    this.name = "DuplicateIdError";
  }
}

/** `update` of an id that does not exist. */
export class RecordNotFoundError extends DbError {
  constructor(collection: string, id: string) {
    super("record_not_found", `No record "${id}" in collection "${collection}"`);
    this.name = "RecordNotFoundError";
  }
}

/** The write lock could not be acquired in time (something holds a transaction open too long). */
export class LockTimeoutError extends DbError {
  constructor(timeoutMs: number) {
    super("lock_timeout", `Timed out after ${timeoutMs} ms waiting for the database write lock`);
    this.name = "LockTimeoutError";
  }
}

/** A repository bound to a finished transaction was used (leaked `tx` reference). */
export class TransactionClosedError extends DbError {
  constructor() {
    super("transaction_closed", "This transaction has already finished; do not keep a reference to `tx` after the callback returns");
    this.name = "TransactionClosedError";
  }
}

/** A collection file on disk could not be parsed or has an invalid shape. The file is never overwritten. */
export class CorruptDataError extends DbError {
  constructor(file: string, reason: string, options?: { cause?: unknown }) {
    super("corrupt_data", `Data file ${file} is corrupt: ${reason}. Restore it from a backup or run "npm run seed:reset" (this discards runtime data).`, options);
    this.name = "CorruptDataError";
  }
}
