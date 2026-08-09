import { NextRequest } from "next/server";
import { listLegalDocumentVersions, registerLegalDocumentVersion } from "@/lib/pd-admin/registers/repository";
import { pdStage4Get, pdStage4Mutation } from "@/lib/pd-admin/http/stage4-route";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { return pdStage4Get(request, "VIEW_LEGAL_DOCUMENT_VERSIONS", listLegalDocumentVersions); }
export async function POST(request: NextRequest) { return pdStage4Mutation(request, "MANAGE_LEGAL_DOCUMENT_VERSIONS", registerLegalDocumentVersion, 201); }
