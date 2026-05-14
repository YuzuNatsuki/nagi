import cors from "cors";
import express from "express";
import { createApiRouter } from "./adapters/runtime-backend-adapter.js";

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Nagi-User-Id",
      "X-Nagi-Firebase-Id-Token",
    ],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use("/api", createApiRouter());

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
/** Cloud Run 用イメージでは `BIND_HOST=0.0.0.0` を指定する。未指定時はローカル向けに 127.0.0.1。 */
const host = process.env.BIND_HOST ?? "127.0.0.1";
app.listen(port, host, () => {
  console.log(`nagi-api listening on http://${host}:${port}`);
});
