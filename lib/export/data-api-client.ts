import { z } from "zod"

const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().optional(),
      message: z.string().optional(),
      details: z.any().optional(),
    }),
  })
  .passthrough()

export type DataApiQueryResponse = {
  meta: any
  data: any[]
}

export function getDataApiBase(): string {
  // Server-side routes should prefer a non-public env var.
  const base = (process.env.DATA_API_BASE_URL ?? process.env.NEXT_PUBLIC_DATA_API_BASE_URL ?? "").replace(/\/$/, "")
  if (!base) throw new Error("Data API not configured (set DATA_API_BASE_URL or NEXT_PUBLIC_DATA_API_BASE_URL).")
  
  // Enforce HTTPS in production to prevent accidental http:// regression
  if (process.env.NODE_ENV === "production" && !base.startsWith("https://")) {
    throw new Error("DATA_API_BASE_URL must be HTTPS in production")
  }
  
  return base
}

export async function postObservationsQuery(params: {
  accessToken: string
  requestBody: any
}): Promise<DataApiQueryResponse> {
  const { accessToken, requestBody } = params
  const base = getDataApiBase()

  // Server-side fetch to Data API (bypasses CORS by design, called from Next.js API routes)
  const res = await fetch(`${base}/api/v1/observations/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  })

  const ct = res.headers.get("content-type") ?? ""
  const json = ct.includes("application/json") ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const parsed = ErrorSchema.safeParse(json)
    const msg =
      (parsed.success ? parsed.data?.error?.message : null) ??
      (typeof json?.error === "string" ? json.error : null) ??
      `Data API error (HTTP ${res.status})`
    throw new Error(msg)
  }
  return (json ?? { meta: {}, data: [] }) as DataApiQueryResponse
}



