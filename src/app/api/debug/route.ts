import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  const passMatch = dbUrl.match(/:\/\/[^:]+:([^@]+)@/);

  let dbStatus = "unknown";
  let eventCount = -1;
  let errorMsg = "";

  try {
    eventCount = await prisma.evenement.count();
    dbStatus = "connected";
  } catch (e: unknown) {
    dbStatus = "error";
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    dbUrlStart: dbUrl.substring(0, 45),
    passwordLength: passMatch?.[1]?.length,
    hasSchemaFoires: dbUrl.includes("schema=foires"),
    dbStatus,
    eventCount,
    errorMsg: errorMsg.substring(0, 500),
  });
}
