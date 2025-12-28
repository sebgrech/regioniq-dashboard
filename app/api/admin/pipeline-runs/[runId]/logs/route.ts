import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api/require-admin"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { Readable } from "stream"
import zlib from "zlib"
import tar from "tar-stream"

// Maximum file size to include (5MB per file to prevent memory issues)
const MAX_FILE_SIZE = 5 * 1024 * 1024

// File extensions to extract (text-based files only)
const ALLOWED_EXTENSIONS = /\.(log|txt|json|csv|md|yaml|yml)$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  // Verify admin access
  const { response } = await requireAdmin()
  if (response) return response

  const { runId } = await params
  const supabase = createSupabaseAdminClient()

  // Download the bundle from Storage
  const { data, error } = await supabase.storage
    .from("pipeline-audit")
    .download(`runs/${runId}/bundle.tar.gz`)

  if (error || !data) {
    return NextResponse.json(
      { error: "Bundle not found", details: error?.message },
      { status: 404 }
    )
  }

  try {
    // Convert blob to buffer and decompress
    const buffer = Buffer.from(await data.arrayBuffer())
    const gunzipped = zlib.gunzipSync(buffer)

    // Extract log files from the tar archive
    const logs: Record<string, string> = {}
    const extract = tar.extract()

    const extractPromise = new Promise<void>((resolve, reject) => {
      extract.on("entry", (header, stream, next) => {
        const chunks: Buffer[] = []
        let size = 0

        stream.on("data", (chunk: Buffer) => {
          size += chunk.length
          // Only accumulate if within size limit
          if (size <= MAX_FILE_SIZE) {
            chunks.push(chunk)
          }
        })

        stream.on("end", () => {
          // Only include text-based files
          if (header.name && ALLOWED_EXTENSIONS.test(header.name)) {
            if (size > MAX_FILE_SIZE) {
              logs[header.name] = `[File too large: ${(size / 1024 / 1024).toFixed(2)}MB - download bundle to view]`
            } else {
              logs[header.name] = Buffer.concat(chunks).toString("utf-8")
            }
          }
          next()
        })

        stream.on("error", (err) => {
          console.error(`Error reading ${header.name}:`, err)
          next()
        })

        stream.resume()
      })

      extract.on("finish", () => resolve())
      extract.on("error", (err) => reject(err))
    })

    // Pipe the gunzipped data into the tar extractor
    Readable.from(gunzipped).pipe(extract)

    await extractPromise

    return NextResponse.json({
      runId,
      fileCount: Object.keys(logs).length,
      logs,
    })
  } catch (err: any) {
    console.error("Error extracting bundle:", err)
    return NextResponse.json(
      { error: "Failed to extract bundle", details: err?.message },
      { status: 500 }
    )
  }
}

