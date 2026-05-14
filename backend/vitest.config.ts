import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // in-memory ストアがモジュール共有のため、ファイル間の並列実行で競合しないようにする
    fileParallelism: false,
  },
});
