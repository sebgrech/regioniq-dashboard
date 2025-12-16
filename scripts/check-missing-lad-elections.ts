import { readFileSync } from "fs"
import { join } from "path"
import { REGIONS } from "../lib/metrics.config"

const elections = JSON.parse(
  readFileSync(join(process.cwd(), "public/processed/lad_elections.json"), "utf-8")
)

const electionsLads = new Set(Object.keys(elections))
const allLads = REGIONS.filter((r) => r.level === "LAD").map((r) => r.code)
const missing = allLads.filter((lad) => !electionsLads.has(lad))

console.log(`Total LADs in config: ${allLads.length}`)
console.log(`LADs with election data: ${electionsLads.size}`)
console.log(`LADs missing election data: ${missing.length}`)

// Group by country
const byCountry = {
  England: missing.filter((l) => l.startsWith("E")),
  Scotland: missing.filter((l) => l.startsWith("S")),
  Wales: missing.filter((l) => l.startsWith("W")),
  "Northern Ireland": missing.filter((l) => l.startsWith("N")),
}

console.log("\nMissing by country:")
for (const [country, lads] of Object.entries(byCountry)) {
  console.log(`  ${country}: ${lads.length}`)
}

// Get names for missing LADs
console.log("\nMissing LADs with names:")
missing.slice(0, 50).forEach((code) => {
  const region = REGIONS.find((r) => r.code === code)
  console.log(`  ${code}: ${region?.name || "Unknown"}`)
})

if (missing.length > 50) {
  console.log(`\n... and ${missing.length - 50} more`)
}

// Write full list to file
import { writeFileSync } from "fs"
const missingWithNames = missing.map((code) => {
  const region = REGIONS.find((r) => r.code === code)
  return { code, name: region?.name || "Unknown", country: region?.country || "Unknown" }
})

writeFileSync(
  join(process.cwd(), "missing-lad-elections.json"),
  JSON.stringify(missingWithNames, null, 2),
  "utf-8"
)
console.log(`\n✅ Full list written to missing-lad-elections.json`)

