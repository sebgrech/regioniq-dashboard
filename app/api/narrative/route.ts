import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { supabase } from "@/lib/supabase"
import { METRICS, REGIONS, getDbRegionCode, getTableName } from "@/lib/metrics.config"
import type { Scenario } from "@/lib/metrics.config"
import { fetchSeries } from "@/lib/data-service"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Fetch UK averages for a given year and scenario
 * Aggregates across all ITL1 regions
 */
async function fetchUKAverages(year: number, scenario: Scenario) {
  try {
    const metricIds = [
      "population_total",
      "nominal_gva_mn_gbp",
      "gdhi_per_head_gbp",
      "emp_total_jobs",
    ]

    const averages: Record<string, number> = {}

    for (const metricId of metricIds) {
      const { data, error } = await supabase
        .from("itl1_latest_all")
        .select("value, ci_lower, ci_upper, data_type")
        .eq("metric_id", metricId)
        .eq("period", year)

      if (error || !data || data.length === 0) {
        averages[metricId] = 0
        continue
      }

      // Calculate average based on scenario
      const values = data.map((row) => {
        if (row.data_type === "historical") {
          return row.value || 0
        }
        switch (scenario) {
          case "baseline":
            return row.value || 0
          case "downside":
            return row.ci_lower ?? row.value ?? 0
          case "upside":
            return row.ci_upper ?? row.value ?? 0
          default:
            return row.value || 0
        }
      })

      const sum = values.reduce((acc, val) => acc + val, 0)
      averages[metricId] = values.length > 0 ? sum / values.length : 0
    }

    return averages
  } catch (error) {
    console.error("Error fetching UK averages:", error)
    return {
      population_total: 0,
      nominal_gva_mn_gbp: 0,
      gdhi_per_head_gbp: 0,
      emp_total_jobs: 0,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      region,
      regionName,
      year,
      scenario,
      currentValues,
      allMetricsSeriesData,
      messages,
      isChatMode,
    } = body

    console.log("Narrative API called. Key present?", !!process.env.OPENAI_API_KEY)

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        narrative: `Regional analysis for ${regionName || region} in ${year} under ${scenario} scenario would be generated here. Configure your OpenAI API key to enable AI analysis.`,
        timestamp: new Date().toISOString(),
        fallback: true,
      })
    }

    // Fetch UK averages for comparison
    const ukAverages = await fetchUKAverages(year, scenario as Scenario)

    // Extract previous year values
    const previousYear = year - 1
    const previousValues: Record<string, number> = {}
    if (allMetricsSeriesData && Array.isArray(allMetricsSeriesData)) {
      for (const series of allMetricsSeriesData) {
        const prevYearData = series.data?.find((d: any) => d.year === previousYear)
        if (prevYearData) {
          previousValues[series.metricId] = prevYearData.value || 0
        }
      }
    }

    // Build historical series (include all available data up to year, plus forecast if needed)
    const historicalSeries: Record<string, Array<{ year: number; value: number }>> = {}
    if (allMetricsSeriesData && Array.isArray(allMetricsSeriesData)) {
      for (const series of allMetricsSeriesData) {
        if (series.data && Array.isArray(series.data)) {
          // Get all data up to and including the current year, plus a few forecast years for context
          // This allows answering questions about time ranges (e.g., "2025 to 2030")
          const relevantData = series.data
            .filter((d: any) => d.year <= year + 5) // Include forecast years for range questions
            .map((d: any) => ({ year: d.year, value: d.value || 0 }))
          historicalSeries[series.metricId] = relevantData
        }
      }
    }

    // For chat mode, also fetch comparison region data if mentioned
    let comparisonRegionData: any = null
    if (isChatMode && messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]?.content || ""
      // Check if message mentions another region (simple heuristic - look for region names)
      const regionMentions = REGIONS.filter((r) => 
        lastMessage.toLowerCase().includes(r.name.toLowerCase())
      )
      if (regionMentions.length > 0) {
        const comparisonRegion = regionMentions.find((r) => r.code !== region) || regionMentions[0]
        if (comparisonRegion && comparisonRegion.code !== region) {
          try {
            // Fetch data for comparison region
            const comparisonMetrics = await Promise.all(
              ["population_total", "nominal_gva_mn_gbp", "gdhi_per_head_gbp", "emp_total_jobs"].map(
                async (metricId) => {
                  const data = await fetchSeries({
                    metricId,
                    region: comparisonRegion.code,
                    scenario: scenario as Scenario,
                  })
                  return { metricId, data }
                }
              )
            )
            const comparisonCurrentValues: Record<string, number> = {}
            const comparisonHistoricalSeries: Record<string, Array<{ year: number; value: number }>> = {}
            
            for (const { metricId, data } of comparisonMetrics) {
              const currentYearData = data.find((d: any) => d.year === year)
              comparisonCurrentValues[metricId] = currentYearData?.value || 0
              
            const historical = data
              .filter((d: any) => d.year <= year + 5) // Include forecast years for range questions
              .map((d: any) => ({ year: d.year, value: d.value || 0 }))
            comparisonHistoricalSeries[metricId] = historical
            }
            
            comparisonRegionData = {
              regionName: comparisonRegion.name,
              regionCode: comparisonRegion.code,
              currentValues: comparisonCurrentValues,
              historicalSeries: comparisonHistoricalSeries,
            }
          } catch (error) {
            console.error("Error fetching comparison region data:", error)
            // Continue without comparison data
          }
        }
      }
    }

    // Build the prompt
    const prompt = `
You are an economic analyst producing a concise but insightful briefing for a UK subnational region.

You are given:

- regionName: ${regionName || region}

- metricValues (current year): ${JSON.stringify(currentValues, null, 2)}

- previousYearValues: ${JSON.stringify(previousValues, null, 2)}

- ukAverages: ${JSON.stringify(ukAverages, null, 2)}

- historicalSeries: ${JSON.stringify(historicalSeries, null, 2)}

- scenario: ${scenario}

- year: ${year}

The metrics provided include:

- population_total

- nominal_gva_mn_gbp

- gdhi_per_head_gbp

- emp_total_jobs

Your task:

1. **Identify key trends** from historicalSeries (population, GVA, GDHI, employment).

   • Comment on long-run direction (growth/decline/plateau).

   • Extract meaningful YoY or multi-year insights (e.g. "growth has slowed", "recovered after 2020").

   • Use real numbers but keep the narrative readable.

2. **Explain current-year performance** using metricValues.

   • Convert levels into meaningful, human context ("large for its size", "below regional peers").

   • Do NOT repeat values mechanically — interpret them.

3. **Compare the region to UK averages** (ukAverages).

   • Indicate relative performance (+/– %) for income, GDP per capita, employment intensity, etc.

   • Identify whether the region is outperforming or lagging the national picture.

4. **Scenario-awareness** (baseline, upside, downside):

   - If scenario === "baseline": describe central trends.

   - If scenario === "upside": emphasise drivers of stronger growth.

   - If scenario === "downside": emphasise vulnerabilities and risks.

5. **Provide a short forward-looking outlook** for 5–10 years:

   • Expected population trend

   • Expected labour market direction

   • GVA momentum

   • Income trajectory

   Frame it as: "Looking ahead to ${year + 5}–${year + 10}, we expect…"

6. **Write in a concise, engaging, professional, research-brief style.**

   • 3–4 sentences total for the main narrative (4–5 only for complex multi-region comparisons).

   • Use clear paragraph breaks for readability (double line breaks between paragraphs).

   • Use **bold** to highlight key numbers, percentages, and important concepts - make numbers pop!

   • Use engaging, visual language: "surges", "outpaces", "trails", "narrows the gap"

   • Create visual comparisons: "stands 46% higher", "widens the lead"

   • Use dynamic transitions: "Meanwhile", "In contrast", "Notably"

   • **BE CONCISE**: For time range questions, focus on START value, END value, overall growth rate, and key insight. Don't list every year.

   • DO NOT use markdown headers (###, ##, #) - write in flowing prose.

   • DO NOT use bullet points or numbered lists - write in complete sentences.

   • No filler phrases like "Here's a breakdown" or "In summary" - just state the facts engagingly.

   • Focus on signal over noise - every sentence should add value.

   • Do not apologise or disclaim.

   • Do not mention the data format or JSON.

   • Write in flowing, engaging prose that reads naturally and makes numbers come alive.

   • Make comparisons vivid but concise: "Bromley's £35,565 towers 46% above Exeter's £24,432" is better than a year-by-year breakdown.

Now write the final narrative.
`

    console.log("➡️ Sending request to OpenAI…")

    // If this is a chat message, use conversation context with full data
    const systemMessage = messages && messages.length > 0
      ? {
          role: "system" as const,
          content: `You are an economic analyst with access to comprehensive UK regional economic data. You MUST use the data provided in the user's message to answer questions. NEVER say you don't have the data - all necessary data is provided. Always use specific numbers, calculate percentages and growth rates, and provide detailed comparisons. If comparison region data is provided, use it to answer comparison questions. Write in clear, professional prose with specific numbers and insights.`,
        }
      : null

    // For chat mode, build a data-rich prompt
    const chatPrompt = isChatMode && messages && messages.length > 0
      ? `You are analyzing UK regional economic data. Answer the user's question using the following data:

**Primary Region: ${regionName || region} (${year}, ${scenario} scenario)**

Current Values:
${JSON.stringify(currentValues, null, 2)}

Previous Year Values:
${JSON.stringify(previousValues, null, 2)}

UK Averages (for comparison):
${JSON.stringify(ukAverages, null, 2)}

Historical Series (last 10 years):
${JSON.stringify(historicalSeries, null, 2)}

${comparisonRegionData ? `
**Comparison Region: ${comparisonRegionData.regionName}**

Current Values:
${JSON.stringify(comparisonRegionData.currentValues, null, 2)}

Historical Series:
${JSON.stringify(comparisonRegionData.historicalSeries, null, 2)}
` : ''}

**User Question:** ${messages[messages.length - 1].content}

**CRITICAL INSTRUCTIONS:**
- You MUST use the ACTUAL DATA provided above - all the data you need is here
- NEVER say "I don't have the data" or "as of my last update" - you have all current data
- Provide SPECIFIC NUMBERS from the data (e.g., "Bromley's GDHI per head is £37,000 in 2032")
- Calculate percentages, growth rates, and differences (e.g., "23% higher than UK average")
- Compare trends over time using the historical series data
- If comparing regions, use the comparison region data provided above
- For time series questions (e.g., "2025 to 2030"), focus on START, END, and GROWTH RATE - don't list every year
- Write in CONCISE, engaging, professional prose (3-4 sentences for simple questions, 4-5 for complex comparisons)
- **BE CONCISE**: Avoid year-by-year breakdowns. Instead, highlight the overall trend, start/end values, and key insights

**FORMATTING FOR ENGAGEMENT:**
- Use **bold** to highlight key numbers and important concepts
- Use visual language: "surges", "outpaces", "trails", "narrows the gap"
- Create visual comparisons: "Bromley's £35,565 stands 46% above Exeter's £24,432"
- Use engaging transitions: "Meanwhile", "In contrast", "Notably"
- Make numbers pop by placing them prominently in sentences
- Use active voice and dynamic language where appropriate

**CONCISENESS RULES:**
- For time range questions: Mention start year value, end year value, overall growth rate, and key comparison
- Don't list every intermediate year - focus on the trend and outcome
- Example: "From 2025 to 2030, **Bromley's GDHI per head grows from £33,436 to £35,565** (6.4% growth), while **Exeter rises from £20,961 to £24,432** (16.6% growth). Despite Exeter's faster growth, **Bromley maintains a 46% lead** in 2030, reflecting its stronger economic position."

Focus on economic insights and meaningful comparisons. Use actual numbers from the data, not general statements. Keep it concise and punchy.

Answer the question using the data provided:`
      : null

    const userMessage = chatPrompt || (messages && messages.length > 0
      ? messages[messages.length - 1].content
      : prompt)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        ...(systemMessage ? [systemMessage] : []),
        ...(messages && messages.length > 1 && isChatMode
          ? messages.slice(0, -1).map((m: any) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            }))
          : []),
        {
          role: "user",
          content: userMessage,
        },
      ],
      max_tokens: isChatMode ? 600 : 400,
      temperature: 0.7,
    })

    const narrative = completion.choices[0]?.message?.content || "Unable to generate analysis"

    console.log("✅ OpenAI response received")

    return NextResponse.json({
      narrative,
      timestamp: new Date().toISOString(),
      fallback: false,
    })
  } catch (error: any) {
    console.error("❌ Narrative generation error")
    if (error.response) {
      console.error("Status:", error.response.status)
      console.error("Data:", error.response.data)
    } else {
      console.error("Message:", error.message)
      console.error("Stack:", error.stack)
    }

    return NextResponse.json(
      {
        error: "Failed to generate narrative",
        fallback: true,
      },
      { status: 500 }
    )
  }
}
