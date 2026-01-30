import { NextRequest, NextResponse } from "next/server"
import { REGIONS } from "@/lib/metrics.config"

// =============================================================================
// Postcode Lookup API
// Converts UK postcodes to region codes using Postcodes.io
// =============================================================================

interface PostcodesIOResponse {
  status: number
  result: {
    postcode: string
    admin_district: string  // LAD name (e.g., "Aberdeen City")
    admin_county: string | null
    region: string  // Region name (e.g., "Scotland")
    country: string
    latitude: number
    longitude: number
    codes: {
      admin_district: string  // LAD code (e.g., "S12000033")
    }
  } | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const postcode = searchParams.get("postcode")

  if (!postcode) {
    return NextResponse.json(
      { error: "Postcode is required" },
      { status: 400 }
    )
  }

  try {
    // Clean postcode - remove spaces and uppercase
    const cleanPostcode = postcode.replace(/\s+/g, "").toUpperCase()

    // Call Postcodes.io API
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`
    )

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Postcode not found" },
          { status: 404 }
        )
      }
      throw new Error(`Postcodes.io API error: ${response.status}`)
    }

    const data: PostcodesIOResponse = await response.json()

    if (!data.result) {
      return NextResponse.json(
        { error: "Postcode not found" },
        { status: 404 }
      )
    }

    const ladCode = data.result.codes.admin_district
    const ladName = data.result.admin_district

    // Look up in our REGIONS config to validate
    const region = REGIONS.find(
      r => r.level === "LAD" && (r.dbCode === ladCode || r.code === ladCode)
    )

    if (!region) {
      // LAD exists but not in our config - return anyway with warning
      return NextResponse.json({
        postcode: data.result.postcode,
        region_code: ladCode,
        region_name: ladName,
        latitude: data.result.latitude,
        longitude: data.result.longitude,
        country: data.result.country,
        warning: "Region not found in configuration - data may be limited"
      })
    }

    return NextResponse.json({
      postcode: data.result.postcode,
      region_code: region.dbCode,
      region_name: region.name,
      latitude: data.result.latitude,
      longitude: data.result.longitude,
      country: region.country
    })

  } catch (error) {
    console.error("Postcode lookup error:", error)
    return NextResponse.json(
      { error: "Failed to lookup postcode" },
      { status: 500 }
    )
  }
}

// Also support POST for batch lookups
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postcode } = body

    if (!postcode) {
      return NextResponse.json(
        { error: "Postcode is required" },
        { status: 400 }
      )
    }

    // Reuse GET logic
    const url = new URL(request.url)
    url.searchParams.set("postcode", postcode)
    
    return GET(new NextRequest(url))
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
