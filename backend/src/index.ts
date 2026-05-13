import express from "express";
import { createApiRouter } from "./adapters/runtime-backend-adapter.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use("/api", createApiRouter());

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
app.listen(port, "127.0.0.1", () => {
  console.log(`nagi-api listening on http://127.0.0.1:${port}`);
});
