import type { NextRequest } from "next/server";
import {
  DELETE as deleteSessions,
  GET as getSessions,
} from "@/app/api/internal/personal-data/auth/sessions/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return getSessions(request);
}

export function DELETE(request: NextRequest) {
  return deleteSessions(request);
}
