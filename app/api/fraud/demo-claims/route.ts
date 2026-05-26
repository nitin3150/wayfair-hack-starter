import { NextResponse } from "next/server";
import { DEMO_CLAIMS } from "@/lib/fraud/seed-data";

export async function GET() {
  return NextResponse.json(DEMO_CLAIMS);
}
