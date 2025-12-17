import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { createClient } from "@supabase/supabase-js"

function parseDotenv(content) {
  const out = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    // Remove surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    // Basic unescape for \n
    val = val.replace(/\\n/g, "\n")
    out[key] = val
  }
  return out
}

function safeUrl(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  } catch {
    return "<invalid url>"
  }
}

async function countRows(tableQuery) {
  // tableQuery must already include .select(..., { count, head }) and filters.
  const { count, error } = await tableQuery
  if (error) throw error
  return count ?? 0
}

function countQuery(supabase, table, applyFilters = (q) => q) {
  const q = supabase.from(table).select("region_code", { count: "exact", head: true })
  return applyFilters(q)
}

function selectQuery(supabase, table, columns, applyFilters = (q) => q) {
  const q = supabase.from(table).select(columns)
  return applyFilters(q)
}

async function sampleDistinctMetricIds(selectQ, limit = 1000) {
  const { data, error } = await selectQ.limit(limit)
  if (error) throw error
  const metrics = [...new Set((data ?? []).map((r) => r.metric_id).filter(Boolean))].sort()
  return metrics
}

async function sampleDistinctRegionCodes(selectQ, limit = 1000) {
  const { data, error } = await selectQ.limit(limit)
  if (error) throw error
  const codes = [...new Set((data ?? []).map((r) => r.region_code).filter(Boolean))].sort()
  return codes
}

async function main() {
  const repoRoot = process.cwd()
  const envPath = path.join(repoRoot, ".env.local")
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.local at", envPath)
    process.exit(1)
  }

  const env = parseDotenv(fs.readFileSync(envPath, "utf8"))
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (not printing values).")
    process.exit(1)
  }

  console.log("Supabase:", safeUrl(url))

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const tables = ["itl1_latest_all", "itl2_latest_all", "itl3_latest_all", "lad_latest_all"]

  // NI codes we expect at each level
  const NI_ITL1_DB = "N92000002"
  const NI_ITL1_UI = "UKN" // only to detect mismatched storage
  const NI_ITL2 = "TLN0"
  const NI_ITL3_PREFIX = "TLN"
  const NI_LAD_PREFIX = "N09"

  console.log("\n=== NI presence by table ===")

  for (const table of tables) {
    let niCount = 0
    if (table === "itl1_latest_all") {
      const n920 = await countRows(countQuery(supabase, table, (q) => q.eq("region_code", NI_ITL1_DB)))
      const ukn = await countRows(countQuery(supabase, table, (q) => q.eq("region_code", NI_ITL1_UI)))
      const nPrefix = await countRows(countQuery(supabase, table, (q) => q.like("region_code", "N%")))
      niCount = nPrefix
      console.log(`\n${table}`)
      console.log(`- region_code = ${NI_ITL1_DB}: ${n920}`)
      console.log(`- region_code = ${NI_ITL1_UI}: ${ukn}`)
      console.log(`- region_code LIKE N%: ${nPrefix}`)
      if (nPrefix > 0) {
        const codes = await sampleDistinctRegionCodes(
          selectQuery(supabase, table, "region_code", (q) => q.like("region_code", "N%")),
          2000
        )
        console.log(`- distinct region_codes (N% sample): ${codes.join(", ")}`)
      }
    } else if (table === "itl2_latest_all") {
      const tln0 = await countRows(countQuery(supabase, table, (q) => q.eq("region_code", NI_ITL2)))
      const tln = await countRows(countQuery(supabase, table, (q) => q.like("region_code", `${NI_ITL3_PREFIX}%`)))
      niCount = tln
      console.log(`\n${table}`)
      console.log(`- region_code = ${NI_ITL2}: ${tln0}`)
      console.log(`- region_code LIKE ${NI_ITL3_PREFIX}%: ${tln}`)
      if (tln > 0) {
        const codes = await sampleDistinctRegionCodes(
          selectQuery(supabase, table, "region_code", (q) => q.like("region_code", `${NI_ITL3_PREFIX}%`)),
          2000
        )
        console.log(`- distinct region_codes (TLN% sample): ${codes.join(", ")}`)
      }
    } else if (table === "itl3_latest_all") {
      const tln = await countRows(countQuery(supabase, table, (q) => q.like("region_code", `${NI_ITL3_PREFIX}%`)))
      niCount = tln
      console.log(`\n${table}`)
      console.log(`- region_code LIKE ${NI_ITL3_PREFIX}%: ${tln}`)
      if (tln > 0) {
        const codes = await sampleDistinctRegionCodes(
          selectQuery(supabase, table, "region_code", (q) => q.like("region_code", `${NI_ITL3_PREFIX}%`)),
          2000
        )
        console.log(`- distinct region_codes (TLN% sample): ${codes.join(", ")}`)
      }
    } else if (table === "lad_latest_all") {
      const n09 = await countRows(countQuery(supabase, table, (q) => q.like("region_code", `${NI_LAD_PREFIX}%`)))
      niCount = n09
      console.log(`\n${table}`)
      console.log(`- region_code LIKE ${NI_LAD_PREFIX}%: ${n09}`)
      if (n09 > 0) {
        const codes = await sampleDistinctRegionCodes(
          selectQuery(supabase, table, "region_code", (q) => q.like("region_code", `${NI_LAD_PREFIX}%`)),
          2000
        )
        console.log(`- distinct region_codes (N09% sample): ${codes.join(", ")}`)
      }
    }

    if (niCount > 0) {
      // Metric id sanity: do NI rows have the same metric ids as GB?
      // (We cap to 1000 for speed; still enough to detect suffix patterns like *_ni.)
      let metricProbe
      if (table === "itl1_latest_all") {
        metricProbe = selectQuery(supabase, table, "metric_id", (q) => q.eq("region_code", NI_ITL1_DB))
      } else if (table === "itl2_latest_all") {
        metricProbe = selectQuery(supabase, table, "metric_id", (q) => q.eq("region_code", NI_ITL2))
      } else if (table === "itl3_latest_all") {
        metricProbe = selectQuery(supabase, table, "metric_id", (q) => q.like("region_code", `${NI_ITL3_PREFIX}%`))
      } else {
        metricProbe = selectQuery(supabase, table, "metric_id", (q) => q.like("region_code", `${NI_LAD_PREFIX}%`))
      }

      const metrics = await sampleDistinctMetricIds(metricProbe, 1500)
      const hasJobs = metrics.includes("emp_total_jobs")
      const hasJobsNI = metrics.includes("emp_total_jobs_ni")
      console.log(`- distinct metric_id count (sample): ${metrics.length}`)
      console.log(`- metric_id sample: ${metrics.slice(0, 25).join(", ")}${metrics.length > 25 ? ", ..." : ""}`)
      console.log(`- contains emp_total_jobs: ${hasJobs}`)
      console.log(`- contains emp_total_jobs_ni: ${hasJobsNI}`)

      // Also explicitly count jobs rows for NI where we can (table-specific)
      const jobsCounts = {}
      try {
        if (table === "itl1_latest_all") {
          jobsCounts.emp_total_jobs = await countRows(
            countQuery(supabase, table, (q) => q.eq("region_code", NI_ITL1_DB).eq("metric_id", "emp_total_jobs"))
          )
          jobsCounts.emp_total_jobs_ni = await countRows(
            countQuery(supabase, table, (q) => q.eq("region_code", NI_ITL1_DB).eq("metric_id", "emp_total_jobs_ni"))
          )
        } else if (table === "itl2_latest_all") {
          jobsCounts.emp_total_jobs = await countRows(
            countQuery(supabase, table, (q) => q.eq("region_code", NI_ITL2).eq("metric_id", "emp_total_jobs"))
          )
          jobsCounts.emp_total_jobs_ni = await countRows(
            countQuery(supabase, table, (q) => q.eq("region_code", NI_ITL2).eq("metric_id", "emp_total_jobs_ni"))
          )
        } else if (table === "lad_latest_all") {
          // LAD has 11 regions, so this is a strong signal if present
          jobsCounts.emp_total_jobs = await countRows(
            countQuery(supabase, table, (q) =>
              q.like("region_code", `${NI_LAD_PREFIX}%`).eq("metric_id", "emp_total_jobs")
            )
          )
          jobsCounts.emp_total_jobs_ni = await countRows(
            countQuery(supabase, table, (q) =>
              q.like("region_code", `${NI_LAD_PREFIX}%`).eq("metric_id", "emp_total_jobs_ni")
            )
          )
        }
      } catch (e) {
        // ignore; some tables may not have those metrics
      }
      if (Object.keys(jobsCounts).length > 0) {
        console.log(`- jobs row counts (NI):`, jobsCounts)
      }
    }
  }

  console.log("\n=== Quick spot-check: NI vs England population ===")
  try {
    const niPop = await countRows(
      countQuery(supabase, "itl1_latest_all", (q) => q.eq("region_code", NI_ITL1_DB).eq("metric_id", "population_total"))
    )
    const engPop = await countRows(
      countQuery(supabase, "itl1_latest_all", (q) => q.eq("region_code", "E92000001").eq("metric_id", "population_total"))
    )
    console.log(`itl1 population_total rows: NI(${NI_ITL1_DB})=${niPop}, England(E92000001)=${engPop}`)
  } catch (e) {
    console.log("Spot-check failed:", e?.message ?? e)
  }

  console.log("\nDone.")
}

main().catch((e) => {
  console.error("Probe failed:", e?.message ?? e)
  process.exit(1)
})


