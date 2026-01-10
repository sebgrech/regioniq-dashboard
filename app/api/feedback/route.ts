import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase-server"

const BodySchema = z.object({
  features: z.array(z.string()).default([]),
  otherMetrics: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  currentRegion: z.string().trim().optional().nullable(),
})

type NotionDatabase = {
  properties?: Record<string, { type?: string }>
}

function findNotionProperty(
  properties: Record<string, { type?: string }>,
  candidates: string[],
  expectedType?: string
): string | null {
  const entries = Object.entries(properties)
  const lowerCandidates = candidates.map((c) => c.toLowerCase())

  // Exact / case-insensitive match first.
  for (let i = 0; i < lowerCandidates.length; i++) {
    const want = lowerCandidates[i]
    const found = entries.find(([name]) => name.toLowerCase() === want)
    if (found) {
      const [name, def] = found
      if (!expectedType || def.type === expectedType) return name
    }
  }

  // Fuzzy contains match as fallback.
  for (let i = 0; i < lowerCandidates.length; i++) {
    const want = lowerCandidates[i]
    const found = entries.find(([name, def]) => {
      if (expectedType && def.type !== expectedType) return false
      return name.toLowerCase().includes(want)
    })
    if (found) return found[0]
  }

  return null
}

async function fetchNotionDatabaseSchema(): Promise<NotionDatabase | null> {
  const token = process.env.NOTION_TOKEN
  const databaseId = process.env.NOTION_DATABASE_ID
  if (!token || !databaseId) return null

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
    },
    cache: "no-store",
  })

  if (!res.ok) return null
  return (await res.json()) as NotionDatabase
}

async function createNotionPage(input: {
  title: string
  email: string | null
  currentRegion: string | null
  features: string[]
  otherMetrics: string | null
  submittedAtIso: string
  supabaseRowId: string
}) {
  const token = process.env.NOTION_TOKEN
  const databaseId = process.env.NOTION_DATABASE_ID
  if (!token || !databaseId) {
    return { ok: false as const, error: "Notion env not set" }
  }

  const schema = await fetchNotionDatabaseSchema()
  const props = schema?.properties ?? {}

  const titleProp =
    findNotionProperty(props, ["Name", "Title"], "title") ?? "Name"
  const emailProp = findNotionProperty(props, ["Email"], "email")
  const regionProp = findNotionProperty(
    props,
    ["Current Region", "Region"],
    "rich_text"
  )
  const featuresProp = findNotionProperty(
    props,
    ["Features", "Feature Requests", "Requested Features"],
    "multi_select"
  )
  const otherProp = findNotionProperty(
    props,
    ["Other metrics", "Other Metrics", "Other", "Notes", "Feedback"],
    "rich_text"
  )
  const submittedAtProp = findNotionProperty(
    props,
    ["Submitted at", "Submitted At", "Created at", "Created At", "Timestamp"],
    "date"
  )
  const supabaseIdProp = findNotionProperty(
    props,
    ["Supabase row id", "Supabase Row Id", "Supabase ID", "Supabase Id", "Row ID"],
    "rich_text"
  )

  const notionProperties: Record<string, any> = {
    [titleProp]: { title: [{ text: { content: input.title } }] },
  }

  if (emailProp) {
    notionProperties[emailProp] = { email: input.email ?? "" }
  }
  if (regionProp) {
    notionProperties[regionProp] = {
      rich_text: [{ text: { content: input.currentRegion ?? "" } }],
    }
  }
  if (featuresProp) {
    notionProperties[featuresProp] = {
      multi_select: input.features.map((f) => ({ name: f })),
    }
  }
  if (otherProp) {
    notionProperties[otherProp] = {
      rich_text: [{ text: { content: input.otherMetrics ?? "" } }],
    }
  }
  if (submittedAtProp) {
    notionProperties[submittedAtProp] = { date: { start: input.submittedAtIso } }
  }
  if (supabaseIdProp) {
    notionProperties[supabaseIdProp] = {
      rich_text: [{ text: { content: input.supabaseRowId } }],
    }
  }

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: notionProperties,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false as const, error: `Notion ${res.status}: ${text}` }
  }

  const json = (await res.json()) as { id?: string }
  if (!json?.id) return { ok: false as const, error: "Notion returned no page id" }

  return { ok: true as const, notionPageId: json.id }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = await req.json().catch(() => ({}))
  const body = BodySchema.parse(raw)

  const insert = await supabase
    .from("roadmap_feedback")
    .insert({
      user_id: user.id,
      email: body.email ?? user.email ?? null,
      current_region: body.currentRegion ?? null,
      features: body.features,
      other_metrics: body.otherMetrics ?? null,
      user_agent: req.headers.get("user-agent"),
      notion_sync_status: "pending",
    })
    .select("id, created_at")
    .single()

  if (insert.error || !insert.data) {
    return NextResponse.json(
      { error: insert.error?.message ?? "Insert failed" },
      { status: 500 }
    )
  }

  const row = insert.data

  // Best-effort Notion sync: never blocks returning ok:true once Supabase insert succeeds.
  try {
    const notion = await createNotionPage({
      title: `RegionIQ feedback${body.currentRegion ? ` — ${body.currentRegion}` : ""}`,
      email: body.email ?? user.email ?? null,
      currentRegion: body.currentRegion ?? null,
      features: body.features,
      otherMetrics: body.otherMetrics ?? null,
      submittedAtIso: new Date(row.created_at).toISOString(),
      supabaseRowId: row.id,
    })

    if (notion.ok) {
      await supabase
        .from("roadmap_feedback")
        .update({
          notion_page_id: notion.notionPageId,
          notion_sync_status: "ok",
          notion_last_error: null,
          notion_synced_at: new Date().toISOString(),
        })
        .eq("id", row.id)
    } else {
      await supabase
        .from("roadmap_feedback")
        .update({
          notion_sync_status: "error",
          notion_last_error: notion.error,
        })
        .eq("id", row.id)
    }
  } catch (e: any) {
    await supabase
      .from("roadmap_feedback")
      .update({
        notion_sync_status: "error",
        notion_last_error: e?.message ?? String(e),
      })
      .eq("id", row.id)
  }

  return NextResponse.json({ ok: true })
}

