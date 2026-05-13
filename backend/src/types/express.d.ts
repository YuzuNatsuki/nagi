import type { DummyUser } from "../adapters/in-memory/dummy-users.js";

declare global {
  namespace Express {
    interface Request {
      /** Phase 1: `X-Nagi-User-Id` から解決した利用者。未送信のときは undefined。 */
      nagiUser?: DummyUser;
    }
  }
}

export {};
