import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { supabase } from "@/lib/supabase"
import { REGIONS, getDbRegionCode, getTableName, type Scenario } from "@/lib/metrics.config"
import { getLadsForITL, hasITLMapping } from "@/lib/itl-to-lad"

type ChatMessage = { role: "user" | "assistant"; content: string }

type CompareScopeUniverse = "selected" | "itl1_lad" | "parent_auto"
type CompareScope = { universe: CompareScopeUniverse; parentComparator?: string }

type SuggestedAction =
  | { type: "addRegions"; regionCodes: string[]; reason: string }
  | { type: "removeRegions"; regionCodes: string[]; reason: string }
  | { type: "replaceRegions"; regionCodes: string[]; reason: string }

const MAX_SELECTION = 12
const TOP_N = 10

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function scenarioValue(row: any, scenario: Scenario): number | null {
  if (!row) return null
  const isHistorical = row.data_type === "historical"
  if (isHistorical) return row.value ?? null
  if (scenario === "upside") return row.ci_upper ?? row.value ?? null
  if (scenario === "downside") return row.ci_lower ?? row.value ?? null
  return row.value ?? null
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function regionName(code: string): string {
  return REGIONS.find((r) => r.code === code)?.name || code
}

async function fetchValuesAtYear(params: {
  regionCodes: string[]
  metricId: string
  year: number
  scenario: Scenario
}): Promise<Record<string, number>> {
  const { regionCodes, metricId, year, scenario } = params
  if (!regionCodes.length) return {}

  // Group by table name because selected regions may be mixed levels.
  const byTable = new Map<string, string[]>()
  const uiToDb = new Map<string, string>()
  for (const ui of regionCodes) {
    const table = getTableName(ui)
    const db = getDbRegionCode(ui)
    uiToDb.set(ui, db)
    byTable.set(table, [...(byTable.get(table) || []), db])
  }

  const results: Record<string, number> = {}
  for (const [table, dbCodesRaw] of byTable.entries()) {
    const dbCodes = uniq(dbCodesRaw)
    const { data, error } = await supabase
      .from(table)
      .select("region_code,value,ci_lower,ci_upper,data_type")
      .eq("metric_id", metricId)
      .eq("period", year)
      .in("region_code", dbCodes)

    if (error || !data) continue

    // Map db row back to UI code(s) that share that db code
    for (const row of data as any[]) {
      const v = scenarioValue(row, scenario)
      if (typeof v !== "number" || !Number.isFinite(v)) continue
      for (const [ui, db] of uiToDb.entries()) {
        if (db === row.region_code) results[ui] = v
      }
    }
  }

  return results
}

function rank(values: Record<string, number>) {
  const rows = Object.entries(values)
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([code, value]) => ({ code, name: regionName(code), value }))
    .sort((a, b) => b.value - a.value)

  return {
    top: rows.slice(0, TOP_N),
    bottom: rows.slice(-TOP_N).reverse(),
    all: rows,
  }
}

function classifyQuestion(text: string) {
  const t = text.toLowerCase()
  const wantsWhy = /\bwhy\b|\bdrivers?\b|\bexplain\b|\bdifference\b|\bcompare\b/.test(t)
  const wantsTop = /\btop\b|\bbest\b|\bhighest\b|\boutperform\b|\bfaster\b/.test(t)
  const wantsBottom = /\bbottom\b|\bworst\b|\blowest\b|\bslowest\b|\bunders?perform\b/.test(t)
  const wantsReplace = /\breplace\b|\bswap\b/.test(t)
  const wantsAdd = /\badd\b|\binclude\b|\bshow\b/.test(t)
  const wantsRemove = /\bremove\b|\bexclude\b|\bhide\b/.test(t)
  return { wantsWhy, wantsTop, wantsBottom, wantsReplace, wantsAdd, wantsRemove }
}

function governAddOrReplace(params: {
  selected: string[]
  proposedAdd: string[]
  reason: string
}): SuggestedAction {
  const { selected, proposedAdd, reason } = params
  const remaining = MAX_SELECTION - selected.length
  const add = proposedAdd.filter((c) => !selected.includes(c))
  if (add.length <= remaining) {
    return { type: "addRegions", regionCodes: add, reason }
  }
  // Soft behavior: propose replacement when adding would exceed cap.
  const replacement = uniq([...selected, ...add]).slice(0, MAX_SELECTION)
  return {
    type: "replaceRegions",
    regionCodes: replacement,
    reason: `${reason} (cap ${MAX_SELECTION}; suggested a replacement to avoid clutter)`,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const metricId = String(body.metricId || "")
    const metricTitle = String(body.metricTitle || metricId)
    const year = Number(body.year || 0)
    const scenario = String(body.scenario || "baseline") as Scenario
    const selectedRegions = Array.isArray(body.selectedRegions) ? body.selectedRegions.map(String) : []
    const scope = (body.scope || { universe: "selected" }) as CompareScope
    const selectionSummary = String(body.selectionSummary || "")
    const messages = (Array.isArray(body.messages) ? body.messages : []) as ChatMessage[]

    const maxRegions = Number(body.maxRegions || MAX_SELECTION)
    const effectiveMax = Number.isFinite(maxRegions) ? Math.min(Math.max(3, maxRegions), MAX_SELECTION) : MAX_SELECTION

    if (!metricId || !Number.isFinite(year) || year <= 0) {
      return NextResponse.json({ answerMarkdown: "Invalid request.", suggestedActions: [] }, { status: 400 })
    }

    // Build candidate universe
    let universeCodes: string[] = []
    let parentComparator: string | null = scope.parentComparator ?? null
    let universeNote: string | null = null

    if (scope.universe === "selected") {
      universeCodes = selectedRegions
    } else if (scope.universe === "itl1_lad") {
      const itl1 = scope.parentComparator
      if (!itl1) {
        universeCodes = selectedRegions
        universeNote = "No ITL1 parentComparator provided; using selected regions."
      } else {
        universeCodes = getLadsForITL(itl1, "ITL1")
        parentComparator = parentComparator ?? itl1
      }
    } else {
      // parent_auto
      const seed = selectedRegions[0]
      const seedRegion = REGIONS.find((r) => r.code === seed)
      if (!seedRegion) {
        universeCodes = selectedRegions
        universeNote = "Could not infer parent from selection; using selected regions."
      } else if (seedRegion.level === "ITL1" || seedRegion.level === "ITL2" || seedRegion.level === "ITL3") {
        if (!hasITLMapping(seedRegion.code, seedRegion.level)) {
          universeCodes = selectedRegions
          universeNote = "No LAD mapping for inferred parent; using selected regions."
        } else {
          universeCodes = getLadsForITL(seedRegion.code, seedRegion.level)
          parentComparator = parentComparator ?? seedRegion.code
        }
      } else {
        universeCodes = selectedRegions
        universeNote = "Auto scope requires an ITL parent in selection; using selected regions."
      }
    }

    universeCodes = uniq(universeCodes).slice(0, 2500) // payload guardrail

    // Deterministic facts: rankings within universe at year
    const universeValues = await fetchValuesAtYear({
      regionCodes: universeCodes,
      metricId,
      year,
      scenario,
    })
    const ranked = rank(universeValues)

    // Parent comparator value (if requested) and outperformers vs parent
    let parentValue: number | null = null
    let outperformers: { code: string; name: string; value: number }[] = []
    if (parentComparator) {
      const parentVals = await fetchValuesAtYear({
        regionCodes: [parentComparator],
        metricId,
        year,
        scenario,
      })
      parentValue = parentVals[parentComparator] ?? null
      if (parentValue != null) {
        outperformers = ranked.all
          .filter((r) => r.value > parentValue!)
          .slice(0, TOP_N)
      }
    }

    const lastUserText = messages.filter((m) => m.role === "user").slice(-1)[0]?.content || ""
    const q = classifyQuestion(lastUserText)

    // Suggested actions (optimizer mental model)
    const suggestedActions: SuggestedAction[] = []
    const top5 = ranked.top.slice(0, 5).map((r) => r.code)
    const bottom5 = ranked.bottom.slice(0, 5).map((r) => r.code)

    if (top5.length) {
      suggestedActions.push({
        type: "replaceRegions",
        regionCodes: top5.slice(0, Math.min(5, effectiveMax)),
        reason: `Replace current selection with the top performers in the current scope (${scope.universe}).`,
      })
      suggestedActions.push(
        governAddOrReplace({
          selected: selectedRegions,
          proposedAdd: top5,
          reason: "Add the top performers to increase contrast.",
        })
      )
    }

    if (bottom5.length) {
      suggestedActions.push(
        governAddOrReplace({
          selected: selectedRegions,
          proposedAdd: bottom5,
          reason: "Add the underperformers to surface meaningful spread.",
        })
      )
    }

    if (outperformers.length) {
      const codes = outperformers.map((r) => r.code).slice(0, 5)
      suggestedActions.push(
        governAddOrReplace({
          selected: selectedRegions,
          proposedAdd: codes,
          reason: `Add top outperformers vs ${parentComparator} (at ${year}).`,
        })
      )
    }

    // If user explicitly asked to replace/add/remove, bias ordering
    if (q.wantsReplace) {
      suggestedActions.sort((a) => (a.type === "replaceRegions" ? -1 : 1))
    } else if (q.wantsRemove) {
      // No deterministic "noisy regions" yet; keep current list.
    } else if (q.wantsAdd) {
      suggestedActions.sort((a) => (a.type === "addRegions" ? -1 : 1))
    }

    // Selection summary for the prompt (canonical)
    const canonicalSummary =
      selectionSummary ||
      `Metric: ${metricTitle}\nYear: ${year}\nScenario: ${scenario}\nRegions shown (${selectedRegions.length}/${effectiveMax}): ${selectedRegions
        .slice(0, 12)
        .map(regionName)
        .join(", ")}`

    const context = {
      metricId,
      metricTitle,
      year,
      scenario,
      scope,
      universeNote,
      parentComparator,
      parentValue,
      top: ranked.top.slice(0, TOP_N),
      bottom: ranked.bottom.slice(0, TOP_N),
      outperformersVsParent: outperformers,
      selectionCap: effectiveMax,
      selectedRegions: selectedRegions.map((c) => ({ code: c, name: regionName(c) })),
    }

    // If no key, return deterministic summary only.
    if (!process.env.OPENAI_API_KEY) {
      const answerMarkdown = [
        "### Selection summary",
        canonicalSummary,
        "",
        universeNote ? `Note: ${universeNote}` : null,
        "",
        "### Key quantitative contrasts",
        ranked.top.length
          ? `- **Top**: ${ranked.top
              .slice(0, 5)
              .map((r) => `${r.name} (${r.code})`)
              .join(", ")}`
          : "- No data in scope.",
        ranked.bottom.length
          ? `- **Bottom**: ${ranked.bottom
              .slice(0, 5)
              .map((r) => `${r.name} (${r.code})`)
              .join(", ")}`
          : null,
        parentComparator && parentValue != null
          ? `- **Outperforming ${parentComparator}**: ${outperformers
              .slice(0, 5)
              .map((r) => `${r.name} (${r.code})`)
              .join(", ")}`
          : null,
        "",
        "Configure `OPENAI_API_KEY` to enable natural-language explanations.",
      ]
        .filter(Boolean)
        .join("\n")

      return NextResponse.json({ answerMarkdown, suggestedActions })
    }

    const system = `You are CompareCopilot, a selection optimizer for a UK regional comparison chart.\n\nRules:\n- Use ONLY the provided computed context (rankings/outperformers/values). Do not invent numbers.\n- If the user asks \"why\" or \"difference\" or \"compare\", structure the answer:\n  1) Key quantitative contrasts (facts)\n  2) Relative rank within the scope\n  3) Possible drivers (hypotheses; label as hypotheses)\n  4) What to check next\n- Keep it concise and chart-native. Prefer bullets.\n- You are NOT a metric-detail copilot: do not propose switching metrics or exporting; focus on improving region selection and explaining contrasts.\n`

    const user = `Current chart:\n${canonicalSummary}\n\nComputed context (JSON):\n${JSON.stringify(context, null, 2)}\n\nConversation:\n${JSON.stringify(messages.slice(-8), null, 2)}\n\nRespond with markdown only.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    })

    const answerMarkdown = completion.choices[0]?.message?.content || "No response."
    return NextResponse.json({ answerMarkdown, suggestedActions, context })
  } catch (error) {
    console.error("compare-assistant error:", error)
    return NextResponse.json({ answerMarkdown: "Error generating response.", suggestedActions: [] }, { status: 500 })
  }
}


