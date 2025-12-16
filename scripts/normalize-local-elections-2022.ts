import { parse } from "csv-parse/sync"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

// Read the 2022 CSV
function normalize2022Data() {
  console.log("🔍 Analyzing local_elections_2022.csv structure...\n")
  
  let content = readFileSync(join(process.cwd(), "public/elections/local_elections_2022.csv"), "utf-8")
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }
  
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[]
  
  console.log(`   Total rows in 2022 file: ${records.length}`)
  
  // Filter to only 2022 local elections
  const local2022 = records.filter((row) => {
    const electionId = row.election_id || ""
    const electionDate = row.election_date || ""
    return (
      electionId.toLowerCase().includes("local.") &&
      electionDate.includes("2022")
    )
  })
  
  console.log(`   2022 local election rows: ${local2022.length}`)
  
  if (local2022.length === 0) {
    console.log("\n⚠️  No 2022 local elections found in the file")
    console.log("   The file appears to contain historical data but not 2022 local elections")
    return
  }
  
  // Check what columns we have vs what we need
  const requiredColumns = [
    "gss",
    "votes_cast",
    "elected",
    "turnout_percentage",
    "organisation_name",
  ]
  
  const availableColumns = Object.keys(local2022[0] || {})
  const missingColumns = requiredColumns.filter((col) => !availableColumns.includes(col))
  
  console.log(`\n   Available columns: ${availableColumns.length}`)
  console.log(`   Missing required columns: ${missingColumns.length > 0 ? missingColumns.join(", ") : "None"}`)
  
  if (missingColumns.length > 0) {
    console.log("\n⚠️  2022 data is missing required columns for processing")
    console.log("   Missing: " + missingColumns.join(", "))
    console.log("\n   Creating normalized CSV with empty values for missing columns...")
    console.log("   This ensures structure consistency, but rows will be skipped during ingestion")
    
    // Create normalized version with all columns matching 2023/2024 structure
    const normalized = local2022.map((row) => {
      // Extract LAD name from election_id (e.g., "local.gedling.2022-01-06" -> "Gedling")
      const electionId = row.election_id || ""
      const ladNameMatch = electionId.match(/local\.([^.]+)\./)
      const organisationName = ladNameMatch
        ? ladNameMatch[1]
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
        : ""
      
      return {
        person_id: row.person_id || "",
        person_name: row.person_name || "",
        election_id: row.election_id || "",
        ballot_paper_id: row.ballot_paper_id || "",
        election_date: row.election_date || "",
        election_current: row.election_current || "",
        party_name: row.party_name || "",
        party_id: row.party_id || "",
        post_label: row.post_label || "",
        cancelled_poll: row.cancelled_poll || "",
        seats_contested: row.seats_contested || "",
        by_election: "", // Not in 2022 data
        by_election_reason: "", // Not in 2022 data
        gss: "", // Missing - critical field
        post_id: "", // Not in 2022 data
        candidates_locked: "", // Not in 2022 data
        nuts1: "", // Not in 2022 data
        organisation_name: organisationName, // Derived from election_id
        votes_cast: "", // Missing - critical field
        elected: "", // Missing - critical field
        tied_vote_winner: "", // Not in 2022 data
        rank: "", // Not in 2022 data
        turnout_reported: "", // Not in 2022 data
        spoilt_ballots: "", // Not in 2022 data
        total_electorate: "", // Not in 2022 data
        turnout_percentage: "", // Missing - critical field
        results_source: "", // Not in 2022 data
      }
    })
    
    // Write normalized CSV
    const header = [
      "person_id",
      "person_name",
      "election_id",
      "ballot_paper_id",
      "election_date",
      "election_current",
      "party_name",
      "party_id",
      "post_label",
      "cancelled_poll",
      "seats_contested",
      "by_election",
      "by_election_reason",
      "gss",
      "post_id",
      "candidates_locked",
      "nuts1",
      "organisation_name",
      "votes_cast",
      "elected",
      "tied_vote_winner",
      "rank",
      "turnout_reported",
      "spoilt_ballots",
      "total_electorate",
      "turnout_percentage",
      "results_source",
    ]
    
    const csvRows = [
      header.join(","),
      ...normalized.map((row) =>
        header.map((key) => {
          const value = row[key as keyof typeof row] || ""
          // Escape commas and quotes in CSV
          if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(",")
      ),
    ]
    
    const outputPath = join(process.cwd(), "public/elections/local_elections_2022_normalized.csv")
    writeFileSync(outputPath, csvRows.join("\n") + "\n", "utf-8")
    
    console.log(`\n✅ Created normalized CSV: ${outputPath}`)
    console.log(`   Rows: ${normalized.length}`)
    console.log(`   Note: Missing critical fields (gss, votes_cast, elected, turnout_percentage)`)
    console.log(`   These rows will be skipped during ingestion`)
    return
  }
  
  // If we have all required columns, create normalized version
  console.log("\n✅ All required columns present - creating normalized CSV...")
  
  const normalized = local2022.map((row) => {
    return {
      person_id: row.person_id || "",
      person_name: row.person_name || "",
      election_id: row.election_id || "",
      ballot_paper_id: row.ballot_paper_id || "",
      election_date: row.election_date || "",
      election_current: row.election_current || "",
      party_name: row.party_name || "",
      party_id: row.party_id || "",
      post_label: row.post_label || "",
      cancelled_poll: row.cancelled_poll || "",
      seats_contested: row.seats_contested || "",
      by_election: row.by_election || "",
      by_election_reason: row.by_election_reason || "",
      gss: row.gss || "",
      post_id: row.post_id || "",
      candidates_locked: row.candidates_locked || "",
      nuts1: row.nuts1 || "",
      organisation_name: row.organisation_name || "",
      votes_cast: row.votes_cast || "",
      elected: row.elected || "",
      tied_vote_winner: row.tied_vote_winner || "",
      rank: row.rank || "",
      turnout_reported: row.turnout_reported || "",
      spoilt_ballots: row.spoilt_ballots || "",
      total_electorate: row.total_electorate || "",
      turnout_percentage: row.turnout_percentage || "",
      results_source: row.results_source || "",
    }
  })
  
  // Write normalized CSV
  const header = Object.keys(normalized[0])
  const csvRows = [
    header.join(","),
    ...normalized.map((row) =>
      header.map((key) => {
        const value = row[key as keyof typeof row] || ""
        // Escape commas and quotes in CSV
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(",")
    ),
  ]
  
  const outputPath = join(process.cwd(), "public/elections/local_elections_2022_normalized.csv")
  writeFileSync(outputPath, csvRows.join("\n") + "\n", "utf-8")
  
  console.log(`✅ Created normalized CSV: ${outputPath}`)
  console.log(`   Rows: ${normalized.length}`)
}

normalize2022Data()

