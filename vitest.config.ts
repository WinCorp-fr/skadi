import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests unitaires des actions serveur (Prisma simulé : aucune base touchée).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
