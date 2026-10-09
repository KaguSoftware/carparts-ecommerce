import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

/** Better Auth endpoints (sign-in, sign-up, password reset, email verification ...). Created lazily on first request. */
export const { GET, POST } = toNextJsHandler({ handler: (request: Request) => getAuth().handler(request) });
