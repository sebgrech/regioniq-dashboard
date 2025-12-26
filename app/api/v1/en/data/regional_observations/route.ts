import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/api/require-user"

/**
 * Proxy route for regional observations data.
 * 
 * This route forwards requests to the external Data API (Fly.io) when configured,
 * ensuring consistent data access and auth handling.
 * Falls back to Supabase-direct queries if DATA_API_BASE_URL is not set.
 */

function getDataApiBase(): string | null {
  const base = (process.env.DATA_API_BASE_URL ?? process.env.NEXT_PUBLIC_DATA_API_BASE_URL ?? "").replace(/\/$/, "")
  return base || null
}

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  const bodyJson = await req.json().catch(() => null)
  if (!bodyJson) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const dataApiBase = getDataApiBase()
  
  if (!dataApiBase) {
    return NextResponse.json(
      { 
        error: "Data API not configured", 
        details: "Set DATA_API_BASE_URL environment variable to enable data queries."
      }, 
      { status: 503 }
    )
  }

  // Get access token from session
  const { data: sessionData } = await auth.supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    return NextResponse.json({ error: "Unauthorized - no session token" }, { status: 401 })
  }

  try {
    // Forward request to external Data API
    const response = await fetch(`${dataApiBase}/api/v1/observations/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(bodyJson),
    })

    const contentType = response.headers.get("content-type") ?? ""
    
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "")
      console.error("[Data API Proxy] Non-JSON response:", text.slice(0, 200))
      return NextResponse.json(
        { error: `Data API returned non-JSON response (HTTP ${response.status})` },
        { status: 502 }
      )
    }

    const json = await response.json()

    if (!response.ok) {
      const errorMsg = json?.error?.message || json?.error || `Data API error (HTTP ${response.status})`
      return NextResponse.json({ error: errorMsg }, { status: response.status })
    }

    // Return the response from the external API
    return NextResponse.json(json)
  } catch (error: any) {
    console.error("[Data API Proxy] Request failed:", error)
    
    if (error?.name === "TypeError" && error?.message?.includes("fetch")) {
      return NextResponse.json(
        { error: "Failed to connect to Data API", details: "Check DATA_API_BASE_URL and network connectivity" },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: error?.message || "Data API request failed" },
      { status: 500 }
    )
  }
}
