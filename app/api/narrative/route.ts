import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { region, year, scenario, metrics } = body

    console.log("Narrative API called. Key present?", !!process.env.OPENAI_API_KEY)

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        narrative: `Regional analysis for ${region} in ${year} under ${scenario} scenario would be generated here. Configure your OpenAI API key to enable AI analysis.`,
        timestamp: new Date().toISOString(),
        fallback: true,
      })
    }

    console.log("➡️ Sending request to OpenAI…")

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ make sure this model is available to your account
      messages: [
        {
          role: "user",
          content: `Generate a 2–3 sentence regional economic analysis for ${region} in ${year} under ${scenario} scenario.
                    Population: ${metrics.population}, GVA: ${metrics.gva},
                    Income: ${metrics.income}, Employment: ${metrics.employment}.
                    Focus on regional performance and trajectory, not individual metrics.`,
        },
      ],
      max_tokens: 200,
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
