import { parse } from "csv-parse/sync"
import { readFileSync } from "fs"
import { join } from "path"

console.log("📊 Schema Comparison Analysis\n")

// Required fields for ingestion
const REQUIRED_FIELDS = ["gss", "votes_cast", "elected", "turnout_percentage", "organisation_name"]

// Parse all files
const files = {
  "2022(1)": "public/elections/local_elections_2022(1).csv",
  "2023": "public/elections/local_elections_2023.csv",
  "2024": "public/elections/local_elections_2024.csv",
  "2025": "public/elections/local_elections_2025.csv",
}

interface SchemaInfo {
  columns: string[]
  hasRequired: boolean
  missingRequired: string[]
  extraColumns: string[]
}

const schemas: Record<string, SchemaInfo> = {}

for (const [name, path] of Object.entries(files)) {
  let content = readFileSync(join(process.cwd(), path), "utf-8")
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }
  
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[]
  
  const columns = Object.keys(records[0] || {})
  const missingRequired = REQUIRED_FIELDS.filter((f) => !columns.includes(f))
  const hasRequired = missingRequired.length === 0
  
  schemas[name] = {
    columns,
    hasRequired,
    missingRequired,
    extraColumns: [],
  }
}

// Use 2023 as reference schema
const referenceSchema = schemas["2023"].columns

console.log("Schema Comparison:\n")
for (const [name, info] of Object.entries(schemas)) {
  console.log(`${name}:`)
  console.log(`  Columns: ${info.columns.length}`)
  console.log(`  Has all required fields: ${info.hasRequired ? "✅" : "❌"}`)
  if (info.missingRequired.length > 0) {
    console.log(`  Missing required: ${info.missingRequired.join(", ")}`)
  }
  
  const missingFromRef = referenceSchema.filter((c) => !info.columns.includes(c))
  const extraFromRef = info.columns.filter((c) => !referenceSchema.includes(c))
  
  if (missingFromRef.length > 0) {
    console.log(`  Missing from 2023 schema: ${missingFromRef.join(", ")}`)
  }
  if (extraFromRef.length > 0) {
    console.log(`  Extra columns not in 2023: ${extraFromRef.join(", ")}`)
  }
  console.log()
}

console.log("\n📋 RECOMMENDATION:\n")
console.log("✅ Use 2023/2024/2025 schema (27 columns) as the standard because:")
console.log("   1. Contains all required fields: gss, votes_cast, elected, turnout_percentage, organisation_name")
console.log("   2. Has complete data (not empty like 2022(1))")
console.log("   3. Includes useful metadata (by_election, nuts1, post_id, etc.)")
console.log("   4. Already working with ingestion script")
console.log()
console.log("❌ Do NOT use 2022(1) schema (20 columns) because:")
console.log("   1. Missing critical field: gss (ward code)")
console.log("   2. Missing critical field: organisation_name")
console.log("   3. votes_cast and turnout_percentage appear to be empty")
console.log("   4. Cannot be processed by current ingestion script")
console.log()
console.log("💡 Action: Normalize 2022(1) to match 2023/2024/2025 schema")

