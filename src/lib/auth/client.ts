import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client. Our UI signs in/out through Server Actions (so lockout, rate limiting and the
 * cart merge always run); this client exists for the rare case a client component needs the session reactively.
 */
export const authClient = createAuthClient({ basePath: "/api/auth" });
