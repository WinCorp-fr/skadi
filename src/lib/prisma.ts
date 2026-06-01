/**
 * Prisma client singleton avec fix IPv4 pour Vercel serverless.
 *
 * Vercel résout les hostnames en IPv6 par défaut, mais Supabase direct
 * n'écoute qu'en IPv4 → ENETUNREACH. Le monkey-patch de net.createConnection
 * force family=4 sur tous les sockets TCP créés par le module pg.
 */
import net from "net";

// Monkey-patch net.Socket.prototype.connect AVANT tout import de pg
// pg appelle socket.connect(port, host) → pas de param family.
// Ce patch convertit en { port, host, family: 4 } pour forcer IPv4.
/* eslint-disable @typescript-eslint/no-explicit-any */
const _origConnect = net.Socket.prototype.connect as any;
net.Socket.prototype.connect = function patchedConnect(this: net.Socket) {
  // eslint-disable-next-line prefer-rest-params
  const args = Array.from(arguments) as any[];
  if (typeof args[0] === "number") {
    // connect(port, host, cb) → connect({ port, host, family: 4 }, cb)
    const opts: any = { port: args[0], family: 4 };
    if (typeof args[1] === "string") {
      opts.host = args[1];
      return _origConnect.call(this, opts, args[2]);
    }
    return _origConnect.call(this, opts, args[1]);
  }
  if (args[0] && typeof args[0] === "object" && !args[0].family) {
    args[0].family = 4;
  }
  return _origConnect.apply(this, args);
} as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL!;
  const isProduction = process.env.NODE_ENV === "production";

  const pool = new Pool({
    connectionString: url.replace(/\?.*$/, ""), // URL sans query params
    ssl: { rejectUnauthorized: false },
    max: isProduction ? 1 : 10, // 1 connexion en serverless (pooler côté Supabase)
  });

  const adapter = new PrismaPg(pool, { schema: "foires" });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
