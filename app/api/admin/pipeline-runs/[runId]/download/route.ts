import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/require-admin"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  // Verify admin access
  const { user, response } = await requireAdmin()
  if (response) return response

  const { runId } = await params
  const supabase = createSupabaseAdminClient()

  // Generate a signed URL valid for 1 hour (3600 seconds)
  const { data, error } = await supabase.storage
    .from("pipeline-audit")
    .createSignedUrl(`runs/${runId}/bundle.tar.gz`, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { 
        error: "Bundle not found",
        details: error?.message ?? "Could not generate signed URL"
      },
      { status: 404 }
    )
  }

  // Redirect browser to the signed URL for download
  return NextResponse.redirect(data.signedUrl)
}

