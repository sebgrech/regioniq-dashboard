import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import crypto from "node:crypto"

type Role = "current" | "parent" | "national" | "peer"

interface InputSchema {
  metric: {
    id: string
    name: string
    unit: string
    growth_type: "yoy"
  }
  time_context: {
    latest_year: number
    comparison_year: number
    data_type: "historical" | "forecast"
  }
  focal_region: {
    code: string
    name: string
    level: string
  }
  comparison_set: Array<{
    code: string
    name: string
    level: string
    role: Role
    value: number | null
    growth: number | null
  }>
}

// -----------------------------------------------------------------------------
// Simple in-memory cache (best-effort; helps a lot in dev and long-lived runtimes)
// -----------------------------------------------------------------------------

const CACHE_TTL_MS = 1000 * 60 * 60 * 12 // 12h
const narrativeCache = new Map<string, { expiresAt: number; narrative: string }>()

function cacheGet(key: string): string | null {
  const hit = narrativeCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    narrativeCache.delete(key)
    return null
  }
  return hit.narrative
}

function cacheSet(key: string, narrative: string) {
  narrativeCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, narrative })
  // opportunistic prune (avoid unbounded growth)
  if (narrativeCache.size > 1000) {
    for (const [k, v] of narrativeCache.entries()) {
      if (Date.now() > v.expiresAt) narrativeCache.delete(k)
    }
  }
}

function fmtPct(x: number) {
  return `${x.toFixed(1)}%`
}

function fallbackNarrative(input: InputSchema): string {
  const { focal_region, metric, time_context, comparison_set } = input
  const focal = comparison_set[0]
  const parents = comparison_set.filter((r) => r.role === "parent")
  const national = comparison_set.find((r) => r.role === "national")
  const peers = comparison_set.filter((r) => r.role === "peer")

  const g = focal?.growth
  const head =
    g == null
      ? `${focal_region.name} has no reported ${metric.name} growth figure for ${time_context.latest_year}.`
      : `${focal_region.name}’s ${metric.name} grew by ${fmtPct(g)} in ${time_context.latest_year}.`

  const parentClauses: string[] = []
  for (const p of parents) {
    if (p.growth == null || g == null) continue
    if (g > p.growth) parentClauses.push(`outpacing ${p.name}`)
    else if (g < p.growth) parentClauses.push(`lagging ${p.name}`)
    else parentClauses.push(`matching ${p.name}`)
  }

  const parentSentence =
    parentClauses.length > 0 ? `This leaves it ${parentClauses.join(" and ")}.` : ""

  let nationalSentence = ""
  if (national?.growth != null && g != null) {
    if (g > national.growth) nationalSentence = `Growth is above the national benchmark (${fmtPct(national.growth)}).`
    else if (g < national.growth)
      nationalSentence = `Growth is below the national benchmark (${fmtPct(national.growth)}).`
    else nationalSentence = `Growth is in line with the national benchmark (${fmtPct(national.growth)}).`
  }

  let peerSentence = ""
  if (peers.length > 0 && g != null) {
    const peer = peers[0]
    if (peer.growth != null) {
      if (g > peer.growth) peerSentence = `Against similar areas such as ${peer.name}, performance is relatively strong.`
      else if (g < peer.growth) peerSentence = `Against similar areas such as ${peer.name}, performance is relatively weak.`
      else peerSentence = `Against similar areas such as ${peer.name}, performance is typical.`
    }
  }

  const implication = `This positioning suggests local conditions are ${g != null && g >= 0 ? "supportive" : "challenging"} relative to the wider regional context.`

  return [head, parentSentence, nationalSentence, peerSentence, implication].filter(Boolean).join(" ").trim()
}

function sanitizeNarrative(raw: string, input: InputSchema): string {
  let text = (raw ?? "").trim()
  if (!text) return text

  // Remove common "heading" artifacts (model sometimes repeats the metric name on its own line).
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.toLowerCase() !== input.metric.name.toLowerCase())
  text = lines.join(" ")

  // Enforce single paragraph (no bullets / headings)
  text = text.replace(/\s+/g, " ").trim()

  // Hard constraint: no hedging words; if present, fall back.
  if (/\b(may|could|might)\b/i.test(text)) {
    return fallbackNarrative(input)
  }

  // Hard constraint: <= 120 words
  const words = text.split(" ").filter(Boolean)
  if (words.length > 120) {
    text = words.slice(0, 120).join(" ").trim()
  }

  return text
}

export async function POST(request: NextRequest) {
  try {
    // Use request text so we can hash deterministically for caching.
    const rawBody = await request.text()
    const cacheKey = crypto.createHash("sha256").update(rawBody).digest("hex")
    const cached = cacheGet(cacheKey)
    if (cached) {
      return NextResponse.json({ narrative: cached, fallback: false, cached: true })
    }

    const input = JSON.parse(rawBody) as InputSchema

    if (!process.env.OPENAI_API_KEY) {
      const narrative = sanitizeNarrative(fallbackNarrative(input), input)
      cacheSet(cacheKey, narrative)
      return NextResponse.json({ narrative, fallback: true, cached: true })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt =
      "You are an economic analyst generating concise regional performance context for decision-makers.\n\n" +
      "Your task is to explain how the focal region is performing relative to:\n" +
      "• its structural parents,\n" +
      "• the national benchmark,\n" +
      "• and a small peer set.\n\n" +
      "Do not produce rankings, tables, or exhaustive comparisons.\n" +
      "Do not restate raw numbers unless they support a comparison.\n" +
      "Focus on relative position, direction, and implication.\n\n" +
      "Write in neutral, professional language suitable for an economics briefing."

    const instructionPrompt =
      "Using the data provided:\n\n" +
      "1. Start with the focal region’s latest performance and growth.\n" +
      "2. Compare it vertically to its parent regions (nearest first).\n" +
      "3. Anchor the comparison against the national figure.\n" +
      "4. Reference peer regions only to clarify whether performance is strong, weak, or typical.\n" +
      "5. Conclude with one implication sentence that explains what this positioning suggests.\n\n" +
      "Constraints:\n" +
      "- Maximum 120 words.\n" +
      "- No bullet points.\n" +
      "- No hedging language (\"may\", \"could\").\n" +
      "- No methodological commentary.\n" +
      "- Do not mention region codes or levels explicitly.\n" +
      "- Return exactly one paragraph.\n" +
      "- Do not include headings, labels, or the metric name as a title.\n\n" +
      "Data (JSON):\n" +
      JSON.stringify(input)

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: instructionPrompt },
      ],
    })

    const raw = resp.choices?.[0]?.message?.content?.trim() ?? ""
    const narrative = sanitizeNarrative(raw || fallbackNarrative(input), input)
    cacheSet(cacheKey, narrative)
    return NextResponse.json({ narrative, fallback: false, cached: false })
  } catch (error: any) {
    return NextResponse.json(
      { narrative: "Narrative generation failed.", error: error?.message ?? String(error) },
      { status: 500 }
    )
  }
}


