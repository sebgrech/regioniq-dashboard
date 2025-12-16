import { parse } from "csv-parse/sync"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

console.log("🔄 Normalizing local_elections_2022(1).csv to match 2023/2024/2025 schema...\n")

// Read reference schema from 2023
let content2023 = readFileSync(join(process.cwd(), "public/elections/local_elections_2023.csv"), "utf-8")
if (content2023.charCodeAt(0) === 0xfeff) {
  content2023 = content2023.slice(1)
}
const records2023 = parse(content2023, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
}) as Record<string, string>[]
const referenceColumns = Object.keys(records2023[0] || [])

console.log(`   Reference schema (2023): ${referenceColumns.length} columns`)

// Read 2022(1) file
let content2022 = readFileSync(join(process.cwd(), "public/elections/local_elections_2022(1).csv"), "utf-8")
if (content2022.charCodeAt(0) === 0xfeff) {
  content2022 = content2022.slice(1)
}

const records2022 = parse(content2022, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
}) as Record<string, string>[]

console.log(`   Rows in 2022(1): ${records2022.length}`)

// Normalize each row to match reference schema
const normalized = records2022.map((row) => {
  const normalizedRow: Record<string, string> = {}
  
  // Extract organisation_name from election_id (e.g., "local.aberdeen-city.2022-05-05" -> "Aberdeen City")
  const electionId = row.election_id || ""
  const orgMatch = electionId.match(/local\.([^.]+)\./)
  const organisationName = orgMatch
    ? orgMatch[1]
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : ""
  
  // Map all reference columns
  for (const col of referenceColumns) {
    if (row[col] !== undefined) {
      // Column exists in 2022(1), use it
      normalizedRow[col] = row[col]
    } else {
      // Column missing, add empty or derived value
      if (col === "organisation_name") {
        normalizedRow[col] = organisationName
      } else if (col === "gss") {
        // Try to derive from post_id or leave empty
        normalizedRow[col] = ""
      } else {
        normalizedRow[col] = ""
      }
    }
  }
  
  return normalizedRow
})

// Write normalized CSV
const csvRows = [
  referenceColumns.join(","),
  ...normalized.map((row) =>
    referenceColumns.map((key) => {
      const value = row[key] || ""
      // Escape commas and quotes in CSV
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(",")
  ),
]

const outputPath = join(process.cwd(), "public/elections/local_elections_2022_filtered_normalized.csv")
writeFileSync(outputPath, csvRows.join("\n") + "\n", "utf-8")

console.log(`\n✅ Created normalized CSV: ${outputPath}`)
console.log(`   Rows: ${normalized.length}`)
console.log(`   Columns: ${referenceColumns.length}`)
console.log(`   Schema matches 2023/2024/2025: ✅`)

// Verify data quality
const withVotes = normalized.filter((r) => r.votes_cast?.trim()).length
const withTurnout = normalized.filter((r) => r.turnout_percentage?.trim()).length
const withElected = normalized.filter((r) => r.elected?.trim()).length
const withOrg = normalized.filter((r) => r.organisation_name?.trim()).length
const withGss = normalized.filter((r) => r.gss?.trim()).length

console.log(`\n📊 Data Quality:`)
console.log(`   Rows with votes_cast: ${withVotes} (${((withVotes / normalized.length) * 100).toFixed(1)}%)`)
console.log(`   Rows with turnout_percentage: ${withTurnout} (${((withTurnout / normalized.length) * 100).toFixed(1)}%)`)
console.log(`   Rows with elected: ${withElected} (${((withElected / normalized.length) * 100).toFixed(1)}%)`)
console.log(`   Rows with organisation_name: ${withOrg} (${((withOrg / normalized.length) * 100).toFixed(1)}%)`)
console.log(`   Rows with gss: ${withGss} (${((withGss / normalized.length) * 100).toFixed(1)}%)`)
console.log(`\n⚠️  Note: gss is still missing - rows will be skipped during ingestion`)
console.log(`   But schema is now consistent with 2023/2024/2025`)

