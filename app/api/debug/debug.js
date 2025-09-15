import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    keyPresent: !!process.env.OPENAI_API_KEY,
    keyPreview: process.env.OPENAI_API_KEY?.slice(0, 5) + "..." || null,
  })
}
