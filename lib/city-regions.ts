/**
 * City Regions Configuration
 * 
 * Maps major UK city names to their constituent LAD (Local Authority District) codes.
 * Generated from master_2025_geography_lookup.csv
 * 
 * Last generated: 2025-12-17T15:43:13.221Z
 */

export const CITY_REGIONS: Record<string, string[]> = {
  "Aberdeen": [
    "S12000033"
  ],

  "Belfast": [
    "N09000003"
  ],

  "Birmingham": [
    "E08000025"
  ],

  "Bristol": [
    "E06000023"
  ],

  "Cardiff": [
    "W06000015"
  ],

  "Coventry": [
    "E08000026"
  ],

  "Derby": [
    "E06000015"
  ],

  "Dundee": [
    "S12000042"
  ],

  "Edinburgh": [
    "S12000036"
  ],

  "Glasgow": [
    "S12000049"
  ],

  "Leeds": [
    "E08000035"
  ],

  "Leicester": [
    "E06000016"
  ],

  "Liverpool": [
    "E08000012"
  ],

  "London": [
    "E09000001",
    "E09000002",
    "E09000003",
    "E09000004",
    "E09000005",
    "E09000006",
    "E09000007",
    "E09000008",
    "E09000009",
    "E09000010",
    "E09000011",
    "E09000012",
    "E09000013",
    "E09000014",
    "E09000015",
    "E09000016",
    "E09000017",
    "E09000018",
    "E09000019",
    "E09000020",
    "E09000021",
    "E09000022",
    "E09000023",
    "E09000024",
    "E09000025",
    "E09000026",
    "E09000027",
    "E09000028",
    "E09000029",
    "E09000030",
    "E09000031",
    "E09000032",
    "E09000033"
  ],

  "Manchester": [
    "E08000001",
    "E08000002",
    "E08000003",
    "E08000004",
    "E08000005",
    "E08000006",
    "E08000007",
    "E08000008",
    "E08000009",
    "E08000010"
  ],

  "Newcastle": [
    "E08000021"
  ],

  "Norwich": [
    "E07000148"
  ],

  "Nottingham": [
    "E06000018"
  ],

  "Plymouth": [
    "E06000026"
  ],

  "Portsmouth": [
    "E06000044"
  ],

  "Reading": [
    "E06000038"
  ],

  "Sheffield": [
    "E08000019"
  ],

  "Southampton": [
    "E06000045"
  ],

  "Stoke-on-Trent": [
    "E06000021"
  ],

  "Swansea": [
    "W06000011"
  ],
}

/**
 * Get LAD codes for a city
 * @param cityName - Name of the city (e.g., "Manchester", "London")
 * @returns Array of LAD codes, or empty array if city not found
 */
export function getCityLads(cityName: string): string[] {
  return CITY_REGIONS[cityName] || []
}

/**
 * Check if a LAD code belongs to a city
 * @param ladCode - LAD code to check
 * @param cityName - Name of the city
 * @returns True if LAD belongs to the city
 */
export function isLadInCity(ladCode: string, cityName: string): boolean {
  const cityLads = CITY_REGIONS[cityName]
  return cityLads ? cityLads.includes(ladCode) : false
}

/**
 * Get city name for a LAD code
 * @param ladCode - LAD code to look up
 * @returns City name if found, null otherwise
 */
export function getCityForLad(ladCode: string): string | null {
  for (const [city, lads] of Object.entries(CITY_REGIONS)) {
    if (lads.includes(ladCode)) {
      return city
    }
  }
  return null
}
