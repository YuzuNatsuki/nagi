import type { NagiUser } from "../auth/nagi-user.js";

declare global {
  namespace Express {
    interface Request {
      /** Firebase ID トークンまたは `X-Nagi-User-Id` で解決した利用者。未確定のときは undefined。 */
      nagiUser?: NagiUser;
    }
  }
}

export {};
