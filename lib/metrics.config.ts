import { Users, TrendingUp, PoundSterling, Briefcase, TrendingDown } from "lucide-react"

export interface Metric {
  id: string
  title: string
  shortTitle: string
  unit: string
  icon: any
  decimals: number
  color: string
  relatedMetrics?: string[] // IDs of related metrics to show on detail page
  showInDashboard?: boolean // Whether to show in main dashboard (default: true)
}

export interface Region {
  code: string // UI code (UKC, TLC3, TLC31, E06000001, etc.)
  dbCode: string // Database region code (ITL1 = E/S/W/N..., ITL2/3 = TL..., LAD = E/S/W/N...)
  name: string
  level: "ITL1" | "ITL2" | "ITL3" | "LAD"
  country: "England" | "Wales" | "Scotland" | "Northern Ireland"
}

// -----------------------------------------------------------------------------
// ITL1 <-> E-code mappings (for ITL1 only)
// -----------------------------------------------------------------------------

// Map E-codes to ITL1 codes
export const E_CODE_TO_ITL: Record<string, string> = {
  "E12000001": "UKC", // North East
  "E12000002": "UKD", // North West
  "E12000003": "UKE", // Yorkshire and The Humber
  "E12000004": "UKF", // East Midlands
  "E12000005": "UKG", // West Midlands
  "E12000006": "UKH", // East of England
  "E12000007": "UKI", // London
  "E12000008": "UKJ", // South East
  "E12000009": "UKK", // South West
  "S92000003": "UKM", // Scotland
  "W92000004": "UKL", // Wales
  "N92000002": "UKN", // Northern Ireland
}

// Reverse mapping for convenience (ITL1 → E-code)
export const ITL_TO_E_CODE: Record<string, string> = Object.entries(E_CODE_TO_ITL).reduce(
  (acc, [eCode, itlCode]) => {
    acc[itlCode] = eCode
    return acc
  },
  {} as Record<string, string>
)

// -----------------------------------------------------------------------------
// Metrics (aligned to Supabase metric_id values)
// -----------------------------------------------------------------------------

export const METRICS: Metric[] = [
  {
    id: "population_total",
    title: "Total Population",
    shortTitle: "Population",
    unit: "people",
    icon: Users,
    decimals: 1,
    color: "hsl(var(--chart-1))",
    relatedMetrics: ["population_16_64"],
  },
  {
    id: "population_16_64",
    title: "Population (16-64)",
    shortTitle: "Working Age",
    unit: "people",
    icon: Users,
    decimals: 1,
    color: "hsl(var(--chart-1))",
    showInDashboard: false,
  },
  {
    id: "nominal_gva_mn_gbp",
    title: "Gross Value Added",
    shortTitle: "GVA",
    unit: "£m",
    icon: TrendingUp,
    decimals: 0,
    color: "hsl(var(--chart-2))",
  },
  {
    id: "gdhi_per_head_gbp",
    title: "Disposable Income (per head)",
    shortTitle: "GDHI",
    unit: "£",
    icon: PoundSterling,
    decimals: 0,
    color: "hsl(var(--chart-3))",
  },
  {
    id: "emp_total_jobs",
    title: "Total Employment",
    shortTitle: "Employment",
    unit: "jobs",
    icon: Briefcase,
    decimals: 1,
    color: "hsl(var(--chart-4))",
    relatedMetrics: ["employment_rate_pct", "unemployment_rate_pct"],
  },
  // Related metrics (not shown in main dashboard)
  {
    id: "employment_rate_pct",
    title: "Employment Rate",
    shortTitle: "Employment Rate",
    unit: "%",
    icon: TrendingUp,
    decimals: 1,
    color: "hsl(var(--chart-5))",
    showInDashboard: false,
  },
  {
    id: "unemployment_rate_pct",
    title: "Unemployment Rate",
    shortTitle: "Unemployment Rate",
    unit: "%",
    icon: TrendingDown,
    decimals: 1,
    color: "hsl(var(--chart-5))",
    showInDashboard: false,
  },
]

// -----------------------------------------------------------------------------
// Regions (ITL1 + ITL2 + ITL3 + LAD)
// -----------------------------------------------------------------------------

export const REGIONS: Region[] = [
  // ========================================================================
  // ITL1 REGIONS
  // ========================================================================

  // England ITL1
  {
    code: "UKC",
    dbCode: "E12000001",
    name: "North East",
    level: "ITL1",
    country: "England",
  },
  {
    code: "UKD",
    dbCode: "E12000002",
    name: "North West",
    level: "ITL1",
    country: "England",
  },
  {
    code: "UKE",
    dbCode: "E12000003",
    name: "Yorkshire and The Humber",
    level: "ITL1",
    country: "England",
  },
  {
    code: "UKF",
    dbCode: "E12000004",
    name: "East Midlands",
    level: "ITL1",
    country: "England",
  },
  {
    code: "UKG",
    dbCode: "E12000005",
    name: "West Midlands",
    level: "ITL1",
    country: "England",
  },
  {
    code: "UKH",
    dbCode: "E12000006",
    name: "East of England",
    level: "ITL1",
    country: "England",
  },
  {
    code: "UKI",
    dbCode: "E12000007",
    name: "London",
    level: "ITL1",
    country: "England",
  },
  {
    code: "UKJ",
    dbCode: "E12000008",
    name: "South East",
    level: "ITL1",
    country: "England",
  },
  {
    code: "UKK",
    dbCode: "E12000009",
    name: "South West",
    level: "ITL1",
    country: "England",
  },

  // Devolved nations ITL1
  {
    code: "UKM",
    dbCode: "S92000003",
    name: "Scotland",
    level: "ITL1",
    country: "Scotland",
  },
  {
    code: "UKL",
    dbCode: "W92000004",
    name: "Wales",
    level: "ITL1",
    country: "Wales",
  },
  {
    code: "UKN",
    dbCode: "N92000002",
    name: "Northern Ireland",
    level: "ITL1",
    country: "Northern Ireland",
  },

  // ========================================================================
  // ITL2 REGIONS (45 regions)
  // ========================================================================

  // ITL2 - England (36 regions)
  { code: "TLC3", dbCode: "TLC3", name: "Tees Valley", level: "ITL2", country: "England" },
  { code: "TLC4", dbCode: "TLC4", name: "Northumberland, Durham and Tyne & Wear", level: "ITL2", country: "England" },

  { code: "TLD1", dbCode: "TLD1", name: "Cumbria", level: "ITL2", country: "England" },
  { code: "TLD3", dbCode: "TLD3", name: "Greater Manchester", level: "ITL2", country: "England" },
  { code: "TLD4", dbCode: "TLD4", name: "Lancashire", level: "ITL2", country: "England" },
  { code: "TLD6", dbCode: "TLD6", name: "Cheshire", level: "ITL2", country: "England" },
  { code: "TLD7", dbCode: "TLD7", name: "Merseyside", level: "ITL2", country: "England" },

  { code: "TLE1", dbCode: "TLE1", name: "East Yorkshire and Northern Lincolnshire", level: "ITL2", country: "England" },
  { code: "TLE2", dbCode: "TLE2", name: "North Yorkshire", level: "ITL2", country: "England" },
  { code: "TLE3", dbCode: "TLE3", name: "South Yorkshire", level: "ITL2", country: "England" },
  { code: "TLE4", dbCode: "TLE4", name: "West Yorkshire", level: "ITL2", country: "England" },

  { code: "TLF1", dbCode: "TLF1", name: "Derbyshire and Nottinghamshire", level: "ITL2", country: "England" },
  { code: "TLF2", dbCode: "TLF2", name: "Leicestershire, Rutland and Northamptonshire", level: "ITL2", country: "England" },
  { code: "TLF3", dbCode: "TLF3", name: "Lincolnshire", level: "ITL2", country: "England" },

  { code: "TLG1", dbCode: "TLG1", name: "Herefordshire, Worcestershire and Warwickshire", level: "ITL2", country: "England" },
  { code: "TLG2", dbCode: "TLG2", name: "Shropshire and Staffordshire", level: "ITL2", country: "England" },
  { code: "TLG3", dbCode: "TLG3", name: "West Midlands", level: "ITL2", country: "England" },

  { code: "TLH2", dbCode: "TLH2", name: "Bedfordshire and Hertfordshire", level: "ITL2", country: "England" },
  { code: "TLH3", dbCode: "TLH3", name: "Essex", level: "ITL2", country: "England" },
  { code: "TLH4", dbCode: "TLH4", name: "Cambridgeshire and Peterborough", level: "ITL2", country: "England" },
  { code: "TLH5", dbCode: "TLH5", name: "Norfolk", level: "ITL2", country: "England" },
  { code: "TLH6", dbCode: "TLH6", name: "Suffolk", level: "ITL2", country: "England" },

  { code: "TLI3", dbCode: "TLI3", name: "Inner London - West", level: "ITL2", country: "England" },
  { code: "TLI4", dbCode: "TLI4", name: "Inner London - East", level: "ITL2", country: "England" },
  { code: "TLI5", dbCode: "TLI5", name: "Outer London - East and North East", level: "ITL2", country: "England" },
  { code: "TLI6", dbCode: "TLI6", name: "Outer London - South", level: "ITL2", country: "England" },
  { code: "TLI7", dbCode: "TLI7", name: "Outer London - West and North West", level: "ITL2", country: "England" },

  { code: "TLJ1", dbCode: "TLJ1", name: "Berkshire, Buckinghamshire and Oxfordshire", level: "ITL2", country: "England" },
  { code: "TLJ2", dbCode: "TLJ2", name: "Surrey, East and West Sussex", level: "ITL2", country: "England" },
  { code: "TLJ3", dbCode: "TLJ3", name: "Hampshire and Isle of Wight", level: "ITL2", country: "England" },
  { code: "TLJ4", dbCode: "TLJ4", name: "Kent", level: "ITL2", country: "England" },

  { code: "TLK3", dbCode: "TLK3", name: "Cornwall and Isles of Scilly", level: "ITL2", country: "England" },
  { code: "TLK4", dbCode: "TLK4", name: "Devon", level: "ITL2", country: "England" },
  { code: "TLK5", dbCode: "TLK5", name: "West of England", level: "ITL2", country: "England" },
  { code: "TLK6", dbCode: "TLK6", name: "North Somerset, Somerset and Dorset", level: "ITL2", country: "England" },
  { code: "TLK7", dbCode: "TLK7", name: "Gloucestershire and Wiltshire", level: "ITL2", country: "England" },

  // ITL2 - Wales (3 regions)
  { code: "TLL3", dbCode: "TLL3", name: "North Wales", level: "ITL2", country: "Wales" },
  { code: "TLL4", dbCode: "TLL4", name: "Mid and South West Wales", level: "ITL2", country: "Wales" },
  { code: "TLL5", dbCode: "TLL5", name: "South East Wales", level: "ITL2", country: "Wales" },

  // ITL2 - Scotland (6 regions)
  { code: "TLM0", dbCode: "TLM0", name: "Eastern Scotland", level: "ITL2", country: "Scotland" },
  { code: "TLM1", dbCode: "TLM1", name: "East Central Scotland", level: "ITL2", country: "Scotland" },
  { code: "TLM2", dbCode: "TLM2", name: "Highlands and Islands", level: "ITL2", country: "Scotland" },
  { code: "TLM3", dbCode: "TLM3", name: "West Central Scotland", level: "ITL2", country: "Scotland" },
  { code: "TLM5", dbCode: "TLM5", name: "North Eastern Scotland", level: "ITL2", country: "Scotland" },
  { code: "TLM9", dbCode: "TLM9", name: "Southern Scotland", level: "ITL2", country: "Scotland" },

  // ITL2 - Northern Ireland (1 region)
  { code: "TLN0", dbCode: "TLN0", name: "Northern Ireland", level: "ITL2", country: "Northern Ireland" },

  // ========================================================================
  // ITL3 REGIONS (182 regions)
  // ========================================================================

  // ITL3 - England (141 regions)
  { code: "TLC31", dbCode: "TLC31", name: "Hartlepool and Stockton-on-Tees", level: "ITL3", country: "England" },
  { code: "TLC32", dbCode: "TLC32", name: "South Teesside", level: "ITL3", country: "England" },
  { code: "TLC33", dbCode: "TLC33", name: "Darlington", level: "ITL3", country: "England" },
  { code: "TLC41", dbCode: "TLC41", name: "Durham", level: "ITL3", country: "England" },
  { code: "TLC42", dbCode: "TLC42", name: "Northumberland", level: "ITL3", country: "England" },
  { code: "TLC43", dbCode: "TLC43", name: "Tyneside", level: "ITL3", country: "England" },
  { code: "TLC44", dbCode: "TLC44", name: "Sunderland", level: "ITL3", country: "England" },
  { code: "TLD13", dbCode: "TLD13", name: "Cumberland", level: "ITL3", country: "England" },
  { code: "TLD14", dbCode: "TLD14", name: "Westmorland and Furness", level: "ITL3", country: "England" },
  { code: "TLD33", dbCode: "TLD33", name: "Manchester", level: "ITL3", country: "England" },
  { code: "TLD34", dbCode: "TLD34", name: "Greater Manchester South West", level: "ITL3", country: "England" },
  { code: "TLD35", dbCode: "TLD35", name: "Greater Manchester South East", level: "ITL3", country: "England" },
  { code: "TLD36", dbCode: "TLD36", name: "Greater Manchester North West", level: "ITL3", country: "England" },
  { code: "TLD37", dbCode: "TLD37", name: "Greater Manchester North East", level: "ITL3", country: "England" },
  { code: "TLD41", dbCode: "TLD41", name: "Blackburn with Darwen", level: "ITL3", country: "England" },
  { code: "TLD42", dbCode: "TLD42", name: "Blackpool", level: "ITL3", country: "England" },
  { code: "TLD44", dbCode: "TLD44", name: "Lancaster and Wyre", level: "ITL3", country: "England" },
  { code: "TLD45", dbCode: "TLD45", name: "Mid Lancashire", level: "ITL3", country: "England" },
  { code: "TLD46", dbCode: "TLD46", name: "East Lancashire", level: "ITL3", country: "England" },
  { code: "TLD47", dbCode: "TLD47", name: "Chorley and West Lancashire", level: "ITL3", country: "England" },
  { code: "TLD61", dbCode: "TLD61", name: "Warrington", level: "ITL3", country: "England" },
  { code: "TLD62", dbCode: "TLD62", name: "Cheshire East", level: "ITL3", country: "England" },
  { code: "TLD63", dbCode: "TLD63", name: "Cheshire West and Chester", level: "ITL3", country: "England" },
  { code: "TLD71", dbCode: "TLD71", name: "East Merseyside", level: "ITL3", country: "England" },
  { code: "TLD72", dbCode: "TLD72", name: "Liverpool", level: "ITL3", country: "England" },
  { code: "TLD73", dbCode: "TLD73", name: "Sefton", level: "ITL3", country: "England" },
  { code: "TLD74", dbCode: "TLD74", name: "Wirral", level: "ITL3", country: "England" },
  { code: "TLE11", dbCode: "TLE11", name: "Kingston upon Hull, City of", level: "ITL3", country: "England" },
  { code: "TLE12", dbCode: "TLE12", name: "East Riding of Yorkshire", level: "ITL3", country: "England" },
  { code: "TLE13", dbCode: "TLE13", name: "North and North East Lincolnshire", level: "ITL3", country: "England" },
  { code: "TLE21", dbCode: "TLE21", name: "York", level: "ITL3", country: "England" },
  { code: "TLE22", dbCode: "TLE22", name: "North Yorkshire", level: "ITL3", country: "England" },
  { code: "TLE33", dbCode: "TLE33", name: "Barnsley", level: "ITL3", country: "England" },
  { code: "TLE34", dbCode: "TLE34", name: "Rotherham", level: "ITL3", country: "England" },
  { code: "TLE35", dbCode: "TLE35", name: "Doncaster", level: "ITL3", country: "England" },
  { code: "TLE36", dbCode: "TLE36", name: "Sheffield", level: "ITL3", country: "England" },
  { code: "TLE41", dbCode: "TLE41", name: "Bradford", level: "ITL3", country: "England" },
  { code: "TLE42", dbCode: "TLE42", name: "Leeds", level: "ITL3", country: "England" },
  { code: "TLE44", dbCode: "TLE44", name: "Calderdale and Kirklees", level: "ITL3", country: "England" },
  { code: "TLE45", dbCode: "TLE45", name: "Wakefield", level: "ITL3", country: "England" },
  { code: "TLF11", dbCode: "TLF11", name: "Derby", level: "ITL3", country: "England" },
  { code: "TLF12", dbCode: "TLF12", name: "East Derbyshire", level: "ITL3", country: "England" },
  { code: "TLF13", dbCode: "TLF13", name: "South and West Derbyshire", level: "ITL3", country: "England" },
  { code: "TLF14", dbCode: "TLF14", name: "Nottingham", level: "ITL3", country: "England" },
  { code: "TLF15", dbCode: "TLF15", name: "North Nottinghamshire", level: "ITL3", country: "England" },
  { code: "TLF16", dbCode: "TLF16", name: "South Nottinghamshire", level: "ITL3", country: "England" },
  { code: "TLF21", dbCode: "TLF21", name: "Leicester", level: "ITL3", country: "England" },
  { code: "TLF22", dbCode: "TLF22", name: "Leicestershire CC and Rutland", level: "ITL3", country: "England" },
  { code: "TLF24", dbCode: "TLF24", name: "West Northamptonshire", level: "ITL3", country: "England" },
  { code: "TLF25", dbCode: "TLF25", name: "North Northamptonshire", level: "ITL3", country: "England" },
  { code: "TLF30", dbCode: "TLF30", name: "Lincolnshire CC", level: "ITL3", country: "England" },
  { code: "TLG11", dbCode: "TLG11", name: "Herefordshire, County of", level: "ITL3", country: "England" },
  { code: "TLG12", dbCode: "TLG12", name: "Worcestershire CC", level: "ITL3", country: "England" },
  { code: "TLG13", dbCode: "TLG13", name: "Warwickshire CC", level: "ITL3", country: "England" },
  { code: "TLG21", dbCode: "TLG21", name: "Telford and Wrekin", level: "ITL3", country: "England" },
  { code: "TLG22", dbCode: "TLG22", name: "Shropshire", level: "ITL3", country: "England" },
  { code: "TLG23", dbCode: "TLG23", name: "Stoke-on-Trent", level: "ITL3", country: "England" },
  { code: "TLG24", dbCode: "TLG24", name: "Staffordshire CC", level: "ITL3", country: "England" },
  { code: "TLG31", dbCode: "TLG31", name: "Birmingham", level: "ITL3", country: "England" },
  { code: "TLG32", dbCode: "TLG32", name: "Solihull", level: "ITL3", country: "England" },
  { code: "TLG33", dbCode: "TLG33", name: "Coventry", level: "ITL3", country: "England" },
  { code: "TLG36", dbCode: "TLG36", name: "Dudley", level: "ITL3", country: "England" },
  { code: "TLG37", dbCode: "TLG37", name: "Sandwell", level: "ITL3", country: "England" },
  { code: "TLG38", dbCode: "TLG38", name: "Walsall", level: "ITL3", country: "England" },
  { code: "TLG39", dbCode: "TLG39", name: "Wolverhampton", level: "ITL3", country: "England" },
  { code: "TLH21", dbCode: "TLH21", name: "Luton", level: "ITL3", country: "England" },
  { code: "TLH24", dbCode: "TLH24", name: "Bedford", level: "ITL3", country: "England" },
  { code: "TLH25", dbCode: "TLH25", name: "Central Bedfordshire", level: "ITL3", country: "England" },
  { code: "TLH26", dbCode: "TLH26", name: "North and East Hertfordshire", level: "ITL3", country: "England" },
  { code: "TLH27", dbCode: "TLH27", name: "South West Hertfordshire", level: "ITL3", country: "England" },
  { code: "TLH31", dbCode: "TLH31", name: "Southend-on-Sea", level: "ITL3", country: "England" },
  { code: "TLH32", dbCode: "TLH32", name: "Thurrock", level: "ITL3", country: "England" },
  { code: "TLH34", dbCode: "TLH34", name: "Essex Haven Gateway", level: "ITL3", country: "England" },
  { code: "TLH35", dbCode: "TLH35", name: "West Essex", level: "ITL3", country: "England" },
  { code: "TLH36", dbCode: "TLH36", name: "Heart of Essex", level: "ITL3", country: "England" },
  { code: "TLH37", dbCode: "TLH37", name: "Essex Thames Gateway", level: "ITL3", country: "England" },
  { code: "TLH41", dbCode: "TLH41", name: "Peterborough", level: "ITL3", country: "England" },
  { code: "TLH42", dbCode: "TLH42", name: "Cambridgeshire CC", level: "ITL3", country: "England" },
  { code: "TLH51", dbCode: "TLH51", name: "Norwich and East Norfolk", level: "ITL3", country: "England" },
  { code: "TLH52", dbCode: "TLH52", name: "North and West Norfolk", level: "ITL3", country: "England" },
  { code: "TLH53", dbCode: "TLH53", name: "Breckland and South Norfolk", level: "ITL3", country: "England" },
  { code: "TLH61", dbCode: "TLH61", name: "Babergh and Mid Suffolk", level: "ITL3", country: "England" },
  { code: "TLH62", dbCode: "TLH62", name: "Ipswich", level: "ITL3", country: "England" },
  { code: "TLH63", dbCode: "TLH63", name: "East Suffolk", level: "ITL3", country: "England" },
  { code: "TLH64", dbCode: "TLH64", name: "West Suffolk", level: "ITL3", country: "England" },
  { code: "TLI33", dbCode: "TLI33", name: "Kensington & Chelsea and Hammersmith & Fulham", level: "ITL3", country: "England" },
  { code: "TLI34", dbCode: "TLI34", name: "Wandsworth", level: "ITL3", country: "England" },
  { code: "TLI35", dbCode: "TLI35", name: "Westminster and City of London", level: "ITL3", country: "England" },
  { code: "TLI36", dbCode: "TLI36", name: "Camden", level: "ITL3", country: "England" },
  { code: "TLI41", dbCode: "TLI41", name: "Hackney and Newham", level: "ITL3", country: "England" },
  { code: "TLI42", dbCode: "TLI42", name: "Tower Hamlets", level: "ITL3", country: "England" },
  { code: "TLI43", dbCode: "TLI43", name: "Haringey and Islington", level: "ITL3", country: "England" },
  { code: "TLI44", dbCode: "TLI44", name: "Lewisham and Southwark", level: "ITL3", country: "England" },
  { code: "TLI45", dbCode: "TLI45", name: "Lambeth", level: "ITL3", country: "England" },
  { code: "TLI51", dbCode: "TLI51", name: "Bexley and Greenwich", level: "ITL3", country: "England" },
  { code: "TLI52", dbCode: "TLI52", name: "Barking & Dagenham and Havering", level: "ITL3", country: "England" },
  { code: "TLI53", dbCode: "TLI53", name: "Redbridge and Waltham Forest", level: "ITL3", country: "England" },
  { code: "TLI54", dbCode: "TLI54", name: "Enfield", level: "ITL3", country: "England" },
  { code: "TLI61", dbCode: "TLI61", name: "Bromley", level: "ITL3", country: "England" },
  { code: "TLI62", dbCode: "TLI62", name: "Croydon", level: "ITL3", country: "England" },
  { code: "TLI63", dbCode: "TLI63", name: "Merton, Kingston upon Thames and Sutton", level: "ITL3", country: "England" },
  { code: "TLI71", dbCode: "TLI71", name: "Barnet", level: "ITL3", country: "England" },
  { code: "TLI72", dbCode: "TLI72", name: "Brent", level: "ITL3", country: "England" },
  { code: "TLI73", dbCode: "TLI73", name: "Ealing", level: "ITL3", country: "England" },
  { code: "TLI74", dbCode: "TLI74", name: "Harrow and Hillingdon", level: "ITL3", country: "England" },
  { code: "TLI75", dbCode: "TLI75", name: "Hounslow and Richmond upon Thames", level: "ITL3", country: "England" },
  { code: "TLJ12", dbCode: "TLJ12", name: "Milton Keynes", level: "ITL3", country: "England" },
  { code: "TLJ13", dbCode: "TLJ13", name: "Buckinghamshire", level: "ITL3", country: "England" },
  { code: "TLJ14", dbCode: "TLJ14", name: "Oxfordshire CC", level: "ITL3", country: "England" },
  { code: "TLJ15", dbCode: "TLJ15", name: "Berkshire East", level: "ITL3", country: "England" },
  { code: "TLJ16", dbCode: "TLJ16", name: "Berkshire West", level: "ITL3", country: "England" },
  { code: "TLJ21", dbCode: "TLJ21", name: "Brighton and Hove", level: "ITL3", country: "England" },
  { code: "TLJ22", dbCode: "TLJ22", name: "East Sussex CC", level: "ITL3", country: "England" },
  { code: "TLJ25", dbCode: "TLJ25", name: "West Surrey", level: "ITL3", country: "England" },
  { code: "TLJ26", dbCode: "TLJ26", name: "East Surrey", level: "ITL3", country: "England" },
  { code: "TLJ27", dbCode: "TLJ27", name: "West Sussex (South West)", level: "ITL3", country: "England" },
  { code: "TLJ28", dbCode: "TLJ28", name: "West Sussex (North East)", level: "ITL3", country: "England" },
  { code: "TLJ31", dbCode: "TLJ31", name: "Portsmouth", level: "ITL3", country: "England" },
  { code: "TLJ32", dbCode: "TLJ32", name: "Southampton", level: "ITL3", country: "England" },
  { code: "TLJ34", dbCode: "TLJ34", name: "Isle of Wight", level: "ITL3", country: "England" },
  { code: "TLJ35", dbCode: "TLJ35", name: "South Hampshire", level: "ITL3", country: "England" },
  { code: "TLJ36", dbCode: "TLJ36", name: "Central Hampshire", level: "ITL3", country: "England" },
  { code: "TLJ37", dbCode: "TLJ37", name: "North Hampshire", level: "ITL3", country: "England" },
  { code: "TLJ41", dbCode: "TLJ41", name: "Medway", level: "ITL3", country: "England" },
  { code: "TLJ43", dbCode: "TLJ43", name: "Kent Thames Gateway", level: "ITL3", country: "England" },
  { code: "TLJ44", dbCode: "TLJ44", name: "East Kent", level: "ITL3", country: "England" },
  { code: "TLJ45", dbCode: "TLJ45", name: "Mid Kent", level: "ITL3", country: "England" },
  { code: "TLJ46", dbCode: "TLJ46", name: "West Kent", level: "ITL3", country: "England" },
  { code: "TLK30", dbCode: "TLK30", name: "Cornwall and Isles of Scilly", level: "ITL3", country: "England" },
  { code: "TLK41", dbCode: "TLK41", name: "Plymouth", level: "ITL3", country: "England" },
  { code: "TLK42", dbCode: "TLK42", name: "Torbay", level: "ITL3", country: "England" },
  { code: "TLK43", dbCode: "TLK43", name: "Devon CC", level: "ITL3", country: "England" },
  { code: "TLK51", dbCode: "TLK51", name: "Bristol, City of", level: "ITL3", country: "England" },
  { code: "TLK52", dbCode: "TLK52", name: "Bath & North East Somerset and South Gloucestershire", level: "ITL3", country: "England" },
  { code: "TLK61", dbCode: "TLK61", name: "North Somerset", level: "ITL3", country: "England" },
  { code: "TLK62", dbCode: "TLK62", name: "Somerset", level: "ITL3", country: "England" },
  { code: "TLK63", dbCode: "TLK63", name: "Bournemouth, Christchurch and Poole", level: "ITL3", country: "England" },
  { code: "TLK64", dbCode: "TLK64", name: "Dorset", level: "ITL3", country: "England" },
  { code: "TLK71", dbCode: "TLK71", name: "Swindon", level: "ITL3", country: "England" },
  { code: "TLK72", dbCode: "TLK72", name: "Wiltshire", level: "ITL3", country: "England" },
  { code: "TLK73", dbCode: "TLK73", name: "Gloucestershire CC", level: "ITL3", country: "England" },

  // ITL3 - Wales (12 regions)
  { code: "TLL31", dbCode: "TLL31", name: "Isle of Anglesey", level: "ITL3", country: "Wales" },
  { code: "TLL32", dbCode: "TLL32", name: "Gwynedd", level: "ITL3", country: "Wales" },
  { code: "TLL33", dbCode: "TLL33", name: "Conwy and Denbighshire", level: "ITL3", country: "Wales" },
  { code: "TLL34", dbCode: "TLL34", name: "Flintshire and Wrexham", level: "ITL3", country: "Wales" },
  { code: "TLL41", dbCode: "TLL41", name: "Mid Wales", level: "ITL3", country: "Wales" },
  { code: "TLL42", dbCode: "TLL42", name: "South West Wales", level: "ITL3", country: "Wales" },
  { code: "TLL43", dbCode: "TLL43", name: "Swansea", level: "ITL3", country: "Wales" },
  { code: "TLL44", dbCode: "TLL44", name: "Neath Port Talbot", level: "ITL3", country: "Wales" },
  { code: "TLL51", dbCode: "TLL51", name: "Central Valleys and Bridgend", level: "ITL3", country: "Wales" },
  { code: "TLL52", dbCode: "TLL52", name: "Cardiff and Vale of Glamorgan", level: "ITL3", country: "Wales" },
  { code: "TLL53", dbCode: "TLL53", name: "Gwent Valleys", level: "ITL3", country: "Wales" },
  { code: "TLL54", dbCode: "TLL54", name: "Monmouthshire and Newport", level: "ITL3", country: "Wales" },

  // ITL3 - Scotland (18 regions)
  { code: "TLM01", dbCode: "TLM01", name: "Clackmannanshire and Fife", level: "ITL3", country: "Scotland" },
  { code: "TLM02", dbCode: "TLM02", name: "Perth and Kinross, and Stirling", level: "ITL3", country: "Scotland" },
  { code: "TLM03", dbCode: "TLM03", name: "Angus and Dundee City", level: "ITL3", country: "Scotland" },
  { code: "TLM11", dbCode: "TLM11", name: "East Lothian and Midlothian", level: "ITL3", country: "Scotland" },
  { code: "TLM12", dbCode: "TLM12", name: "Falkirk", level: "ITL3", country: "Scotland" },
  { code: "TLM13", dbCode: "TLM13", name: "City of Edinburgh", level: "ITL3", country: "Scotland" },
  { code: "TLM14", dbCode: "TLM14", name: "West Lothian", level: "ITL3", country: "Scotland" },
  { code: "TLM20", dbCode: "TLM20", name: "Highlands and Islands", level: "ITL3", country: "Scotland" },
  { code: "TLM31", dbCode: "TLM31", name: "East Dunbartonshire and West Dunbartonshire", level: "ITL3", country: "Scotland" },
  { code: "TLM32", dbCode: "TLM32", name: "Glasgow City", level: "ITL3", country: "Scotland" },
  { code: "TLM33", dbCode: "TLM33", name: "Inverclyde, East Renfrewshire, and Renfrewshire", level: "ITL3", country: "Scotland" },
  { code: "TLM34", dbCode: "TLM34", name: "North Lanarkshire", level: "ITL3", country: "Scotland" },
  { code: "TLM50", dbCode: "TLM50", name: "Aberdeen City and Aberdeenshire", level: "ITL3", country: "Scotland" },
  { code: "TLM91", dbCode: "TLM91", name: "Scottish Borders", level: "ITL3", country: "Scotland" },
  { code: "TLM92", dbCode: "TLM92", name: "Dumfries and Galloway", level: "ITL3", country: "Scotland" },
  { code: "TLM93", dbCode: "TLM93", name: "North Ayrshire and East Ayrshire", level: "ITL3", country: "Scotland" },
  { code: "TLM94", dbCode: "TLM94", name: "South Ayrshire", level: "ITL3", country: "Scotland" },
  { code: "TLM95", dbCode: "TLM95", name: "South Lanarkshire", level: "ITL3", country: "Scotland" },

  // ITL3 - Northern Ireland (11 regions)
  { code: "TLN06", dbCode: "TLN06", name: "Belfast", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN07", dbCode: "TLN07", name: "Armagh City, Banbridge and Craigavon", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN08", dbCode: "TLN08", name: "Newry, Mourne and Down", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN09", dbCode: "TLN09", name: "Ards and North Down", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN0A", dbCode: "TLN0A", name: "Derry City and Strabane", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN0B", dbCode: "TLN0B", name: "Mid Ulster", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN0C", dbCode: "TLN0C", name: "Causeway Coast and Glens", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN0D", dbCode: "TLN0D", name: "Antrim and Newtownabbey", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN0E", dbCode: "TLN0E", name: "Lisburn and Castlereagh", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN0F", dbCode: "TLN0F", name: "Mid and East Antrim", level: "ITL3", country: "Northern Ireland" },
  { code: "TLN0G", dbCode: "TLN0G", name: "Fermanagh and Omagh", level: "ITL3", country: "Northern Ireland" },

  // ========================================================================
  // LAD REGIONS (354 regions)
  // ========================================================================

  // England (302 LADs)
  { code: "E06000001", dbCode: "E06000001", name: "Hartlepool", level: "LAD", country: "England" },
  { code: "E06000002", dbCode: "E06000002", name: "Middlesbrough", level: "LAD", country: "England" },
  { code: "E06000003", dbCode: "E06000003", name: "Redcar and Cleveland", level: "LAD", country: "England" },
  { code: "E06000004", dbCode: "E06000004", name: "Stockton-on-Tees", level: "LAD", country: "England" },
  { code: "E06000005", dbCode: "E06000005", name: "Darlington", level: "LAD", country: "England" },
  { code: "E06000006", dbCode: "E06000006", name: "Halton", level: "LAD", country: "England" },
  { code: "E06000007", dbCode: "E06000007", name: "Warrington", level: "LAD", country: "England" },
  { code: "E06000008", dbCode: "E06000008", name: "Blackburn with Darwen", level: "LAD", country: "England" },
  { code: "E06000009", dbCode: "E06000009", name: "Blackpool", level: "LAD", country: "England" },
  { code: "E06000010", dbCode: "E06000010", name: "Kingston upon Hull, City of", level: "LAD", country: "England" },
  { code: "E06000011", dbCode: "E06000011", name: "East Riding of Yorkshire", level: "LAD", country: "England" },
  { code: "E06000012", dbCode: "E06000012", name: "North East Lincolnshire", level: "LAD", country: "England" },
  { code: "E06000013", dbCode: "E06000013", name: "North Lincolnshire", level: "LAD", country: "England" },
  { code: "E06000014", dbCode: "E06000014", name: "York", level: "LAD", country: "England" },
  { code: "E06000015", dbCode: "E06000015", name: "Derby", level: "LAD", country: "England" },
  { code: "E06000016", dbCode: "E06000016", name: "Leicester", level: "LAD", country: "England" },
  { code: "E06000017", dbCode: "E06000017", name: "Rutland", level: "LAD", country: "England" },
  { code: "E06000018", dbCode: "E06000018", name: "Nottingham", level: "LAD", country: "England" },
  { code: "E06000019", dbCode: "E06000019", name: "Herefordshire, County of", level: "LAD", country: "England" },
  { code: "E06000020", dbCode: "E06000020", name: "Telford and Wrekin", level: "LAD", country: "England" },
  { code: "E06000021", dbCode: "E06000021", name: "Stoke-on-Trent", level: "LAD", country: "England" },
  { code: "E06000022", dbCode: "E06000022", name: "Bath and North East Somerset", level: "LAD", country: "England" },
  { code: "E06000023", dbCode: "E06000023", name: "Bristol, City of", level: "LAD", country: "England" },
  { code: "E06000024", dbCode: "E06000024", name: "North Somerset", level: "LAD", country: "England" },
  { code: "E06000025", dbCode: "E06000025", name: "South Gloucestershire", level: "LAD", country: "England" },
  { code: "E06000026", dbCode: "E06000026", name: "Plymouth", level: "LAD", country: "England" },
  { code: "E06000027", dbCode: "E06000027", name: "Torbay", level: "LAD", country: "England" },
  { code: "E06000030", dbCode: "E06000030", name: "Swindon", level: "LAD", country: "England" },
  { code: "E06000031", dbCode: "E06000031", name: "Peterborough", level: "LAD", country: "England" },
  { code: "E06000032", dbCode: "E06000032", name: "Luton", level: "LAD", country: "England" },
  { code: "E06000033", dbCode: "E06000033", name: "Southend-on-Sea", level: "LAD", country: "England" },
  { code: "E06000034", dbCode: "E06000034", name: "Thurrock", level: "LAD", country: "England" },
  { code: "E06000035", dbCode: "E06000035", name: "Medway", level: "LAD", country: "England" },
  { code: "E06000036", dbCode: "E06000036", name: "Bracknell Forest", level: "LAD", country: "England" },
  { code: "E06000037", dbCode: "E06000037", name: "West Berkshire", level: "LAD", country: "England" },
  { code: "E06000038", dbCode: "E06000038", name: "Reading", level: "LAD", country: "England" },
  { code: "E06000039", dbCode: "E06000039", name: "Slough", level: "LAD", country: "England" },
  { code: "E06000040", dbCode: "E06000040", name: "Windsor and Maidenhead", level: "LAD", country: "England" },
  { code: "E06000041", dbCode: "E06000041", name: "Wokingham", level: "LAD", country: "England" },
  { code: "E06000042", dbCode: "E06000042", name: "Milton Keynes", level: "LAD", country: "England" },
  { code: "E06000043", dbCode: "E06000043", name: "Brighton and Hove", level: "LAD", country: "England" },
  { code: "E06000044", dbCode: "E06000044", name: "Portsmouth", level: "LAD", country: "England" },
  { code: "E06000045", dbCode: "E06000045", name: "Southampton", level: "LAD", country: "England" },
  { code: "E06000046", dbCode: "E06000046", name: "Isle of Wight", level: "LAD", country: "England" },
  { code: "E06000047", dbCode: "E06000047", name: "County Durham", level: "LAD", country: "England" },
  { code: "E06000049", dbCode: "E06000049", name: "Cheshire East", level: "LAD", country: "England" },
  { code: "E06000050", dbCode: "E06000050", name: "Cheshire West and Chester", level: "LAD", country: "England" },
  { code: "E06000051", dbCode: "E06000051", name: "Shropshire", level: "LAD", country: "England" },
  { code: "E06000052", dbCode: "E06000052", name: "Cornwall", level: "LAD", country: "England" },
  { code: "E06000053", dbCode: "E06000053", name: "Isles of Scilly", level: "LAD", country: "England" },
  { code: "E06000054", dbCode: "E06000054", name: "Wiltshire", level: "LAD", country: "England" },
  { code: "E06000055", dbCode: "E06000055", name: "Bedford", level: "LAD", country: "England" },
  { code: "E06000056", dbCode: "E06000056", name: "Central Bedfordshire", level: "LAD", country: "England" },
  { code: "E06000057", dbCode: "E06000057", name: "Northumberland", level: "LAD", country: "England" },
  { code: "E06000058", dbCode: "E06000058", name: "Bournemouth, Christchurch and Poole", level: "LAD", country: "England" },
  { code: "E06000059", dbCode: "E06000059", name: "Dorset", level: "LAD", country: "England" },
  { code: "E06000060", dbCode: "E06000060", name: "Buckinghamshire", level: "LAD", country: "England" },
  { code: "E06000061", dbCode: "E06000061", name: "North Northamptonshire", level: "LAD", country: "England" },
  { code: "E06000062", dbCode: "E06000062", name: "West Northamptonshire", level: "LAD", country: "England" },
  { code: "E06000063", dbCode: "E06000063", name: "Cumberland", level: "LAD", country: "England" },
  { code: "E06000064", dbCode: "E06000064", name: "Westmorland and Furness", level: "LAD", country: "England" },
  { code: "E06000065", dbCode: "E06000065", name: "North Yorkshire", level: "LAD", country: "England" },
  { code: "E06000066", dbCode: "E06000066", name: "Somerset", level: "LAD", country: "England" },
  { code: "E07000008", dbCode: "E07000008", name: "Cambridge", level: "LAD", country: "England" },
  { code: "E07000009", dbCode: "E07000009", name: "East Cambridgeshire", level: "LAD", country: "England" },
  { code: "E07000010", dbCode: "E07000010", name: "Fenland", level: "LAD", country: "England" },
  { code: "E07000011", dbCode: "E07000011", name: "Huntingdonshire", level: "LAD", country: "England" },
  { code: "E07000012", dbCode: "E07000012", name: "South Cambridgeshire", level: "LAD", country: "England" },
  { code: "E07000032", dbCode: "E07000032", name: "Amber Valley", level: "LAD", country: "England" },
  { code: "E07000033", dbCode: "E07000033", name: "Bolsover", level: "LAD", country: "England" },
  { code: "E07000034", dbCode: "E07000034", name: "Chesterfield", level: "LAD", country: "England" },
  { code: "E07000035", dbCode: "E07000035", name: "Derbyshire Dales", level: "LAD", country: "England" },
  { code: "E07000036", dbCode: "E07000036", name: "Erewash", level: "LAD", country: "England" },
  { code: "E07000037", dbCode: "E07000037", name: "High Peak", level: "LAD", country: "England" },
  { code: "E07000038", dbCode: "E07000038", name: "North East Derbyshire", level: "LAD", country: "England" },
  { code: "E07000039", dbCode: "E07000039", name: "South Derbyshire", level: "LAD", country: "England" },
  { code: "E07000040", dbCode: "E07000040", name: "East Devon", level: "LAD", country: "England" },
  { code: "E07000041", dbCode: "E07000041", name: "Exeter", level: "LAD", country: "England" },
  { code: "E07000042", dbCode: "E07000042", name: "Mid Devon", level: "LAD", country: "England" },
  { code: "E07000043", dbCode: "E07000043", name: "North Devon", level: "LAD", country: "England" },
  { code: "E07000044", dbCode: "E07000044", name: "South Hams", level: "LAD", country: "England" },
  { code: "E07000045", dbCode: "E07000045", name: "Teignbridge", level: "LAD", country: "England" },
  { code: "E07000046", dbCode: "E07000046", name: "Torridge", level: "LAD", country: "England" },
  { code: "E07000047", dbCode: "E07000047", name: "West Devon", level: "LAD", country: "England" },
  { code: "E07000061", dbCode: "E07000061", name: "Eastbourne", level: "LAD", country: "England" },
  { code: "E07000062", dbCode: "E07000062", name: "Hastings", level: "LAD", country: "England" },
  { code: "E07000063", dbCode: "E07000063", name: "Lewes", level: "LAD", country: "England" },
  { code: "E07000064", dbCode: "E07000064", name: "Rother", level: "LAD", country: "England" },
  { code: "E07000065", dbCode: "E07000065", name: "Wealden", level: "LAD", country: "England" },
  { code: "E07000066", dbCode: "E07000066", name: "Basildon", level: "LAD", country: "England" },
  { code: "E07000067", dbCode: "E07000067", name: "Braintree", level: "LAD", country: "England" },
  { code: "E07000068", dbCode: "E07000068", name: "Brentwood", level: "LAD", country: "England" },
  { code: "E07000069", dbCode: "E07000069", name: "Castle Point", level: "LAD", country: "England" },
  { code: "E07000070", dbCode: "E07000070", name: "Chelmsford", level: "LAD", country: "England" },
  { code: "E07000071", dbCode: "E07000071", name: "Colchester", level: "LAD", country: "England" },
  { code: "E07000072", dbCode: "E07000072", name: "Epping Forest", level: "LAD", country: "England" },
  { code: "E07000073", dbCode: "E07000073", name: "Harlow", level: "LAD", country: "England" },
  { code: "E07000074", dbCode: "E07000074", name: "Maldon", level: "LAD", country: "England" },
  { code: "E07000075", dbCode: "E07000075", name: "Rochford", level: "LAD", country: "England" },
  { code: "E07000076", dbCode: "E07000076", name: "Tendring", level: "LAD", country: "England" },
  { code: "E07000077", dbCode: "E07000077", name: "Uttlesford", level: "LAD", country: "England" },
  { code: "E07000078", dbCode: "E07000078", name: "Cheltenham", level: "LAD", country: "England" },
  { code: "E07000079", dbCode: "E07000079", name: "Cotswold", level: "LAD", country: "England" },
  { code: "E07000080", dbCode: "E07000080", name: "Forest of Dean", level: "LAD", country: "England" },
  { code: "E07000081", dbCode: "E07000081", name: "Gloucester", level: "LAD", country: "England" },
  { code: "E07000082", dbCode: "E07000082", name: "Stroud", level: "LAD", country: "England" },
  { code: "E07000083", dbCode: "E07000083", name: "Tewkesbury", level: "LAD", country: "England" },
  { code: "E07000084", dbCode: "E07000084", name: "Basingstoke and Deane", level: "LAD", country: "England" },
  { code: "E07000085", dbCode: "E07000085", name: "East Hampshire", level: "LAD", country: "England" },
  { code: "E07000086", dbCode: "E07000086", name: "Eastleigh", level: "LAD", country: "England" },
  { code: "E07000087", dbCode: "E07000087", name: "Fareham", level: "LAD", country: "England" },
  { code: "E07000088", dbCode: "E07000088", name: "Gosport", level: "LAD", country: "England" },
  { code: "E07000089", dbCode: "E07000089", name: "Hart", level: "LAD", country: "England" },
  { code: "E07000090", dbCode: "E07000090", name: "Havant", level: "LAD", country: "England" },
  { code: "E07000091", dbCode: "E07000091", name: "New Forest", level: "LAD", country: "England" },
  { code: "E07000092", dbCode: "E07000092", name: "Rushmoor", level: "LAD", country: "England" },
  { code: "E07000093", dbCode: "E07000093", name: "Test Valley", level: "LAD", country: "England" },
  { code: "E07000094", dbCode: "E07000094", name: "Winchester", level: "LAD", country: "England" },
  { code: "E07000095", dbCode: "E07000095", name: "Broxbourne", level: "LAD", country: "England" },
  { code: "E07000096", dbCode: "E07000096", name: "Dacorum", level: "LAD", country: "England" },
  { code: "E07000098", dbCode: "E07000098", name: "Hertsmere", level: "LAD", country: "England" },
  { code: "E07000099", dbCode: "E07000099", name: "North Hertfordshire", level: "LAD", country: "England" },
  { code: "E07000102", dbCode: "E07000102", name: "Three Rivers", level: "LAD", country: "England" },
  { code: "E07000103", dbCode: "E07000103", name: "Watford", level: "LAD", country: "England" },
  { code: "E07000105", dbCode: "E07000105", name: "Ashford", level: "LAD", country: "England" },
  { code: "E07000106", dbCode: "E07000106", name: "Canterbury", level: "LAD", country: "England" },
  { code: "E07000107", dbCode: "E07000107", name: "Dartford", level: "LAD", country: "England" },
  { code: "E07000108", dbCode: "E07000108", name: "Dover", level: "LAD", country: "England" },
  { code: "E07000109", dbCode: "E07000109", name: "Gravesham", level: "LAD", country: "England" },
  { code: "E07000110", dbCode: "E07000110", name: "Maidstone", level: "LAD", country: "England" },
  { code: "E07000111", dbCode: "E07000111", name: "Sevenoaks", level: "LAD", country: "England" },
  { code: "E07000112", dbCode: "E07000112", name: "Folkestone and Hythe", level: "LAD", country: "England" },
  { code: "E07000113", dbCode: "E07000113", name: "Swale", level: "LAD", country: "England" },
  { code: "E07000114", dbCode: "E07000114", name: "Thanet", level: "LAD", country: "England" },
  { code: "E07000115", dbCode: "E07000115", name: "Tonbridge and Malling", level: "LAD", country: "England" },
  { code: "E07000116", dbCode: "E07000116", name: "Tunbridge Wells", level: "LAD", country: "England" },
  { code: "E07000117", dbCode: "E07000117", name: "Burnley", level: "LAD", country: "England" },
  { code: "E07000118", dbCode: "E07000118", name: "Chorley", level: "LAD", country: "England" },
  { code: "E07000119", dbCode: "E07000119", name: "Fylde", level: "LAD", country: "England" },
  { code: "E07000120", dbCode: "E07000120", name: "Hyndburn", level: "LAD", country: "England" },
  { code: "E07000121", dbCode: "E07000121", name: "Lancaster", level: "LAD", country: "England" },
  { code: "E07000122", dbCode: "E07000122", name: "Pendle", level: "LAD", country: "England" },
  { code: "E07000123", dbCode: "E07000123", name: "Preston", level: "LAD", country: "England" },
  { code: "E07000124", dbCode: "E07000124", name: "Ribble Valley", level: "LAD", country: "England" },
  { code: "E07000125", dbCode: "E07000125", name: "Rossendale", level: "LAD", country: "England" },
  { code: "E07000126", dbCode: "E07000126", name: "South Ribble", level: "LAD", country: "England" },
  { code: "E07000127", dbCode: "E07000127", name: "West Lancashire", level: "LAD", country: "England" },
  { code: "E07000128", dbCode: "E07000128", name: "Wyre", level: "LAD", country: "England" },
  { code: "E07000129", dbCode: "E07000129", name: "Blaby", level: "LAD", country: "England" },
  { code: "E07000130", dbCode: "E07000130", name: "Charnwood", level: "LAD", country: "England" },
  { code: "E07000131", dbCode: "E07000131", name: "Harborough", level: "LAD", country: "England" },
  { code: "E07000132", dbCode: "E07000132", name: "Hinckley and Bosworth", level: "LAD", country: "England" },
  { code: "E07000133", dbCode: "E07000133", name: "Melton", level: "LAD", country: "England" },
  { code: "E07000134", dbCode: "E07000134", name: "North West Leicestershire", level: "LAD", country: "England" },
  { code: "E07000135", dbCode: "E07000135", name: "Oadby and Wigston", level: "LAD", country: "England" },
  { code: "E07000136", dbCode: "E07000136", name: "Boston", level: "LAD", country: "England" },
  { code: "E07000137", dbCode: "E07000137", name: "East Lindsey", level: "LAD", country: "England" },
  { code: "E07000138", dbCode: "E07000138", name: "Lincoln", level: "LAD", country: "England" },
  { code: "E07000139", dbCode: "E07000139", name: "North Kesteven", level: "LAD", country: "England" },
  { code: "E07000140", dbCode: "E07000140", name: "South Holland", level: "LAD", country: "England" },
  { code: "E07000141", dbCode: "E07000141", name: "South Kesteven", level: "LAD", country: "England" },
  { code: "E07000142", dbCode: "E07000142", name: "West Lindsey", level: "LAD", country: "England" },
  { code: "E07000143", dbCode: "E07000143", name: "Breckland", level: "LAD", country: "England" },
  { code: "E07000144", dbCode: "E07000144", name: "Broadland", level: "LAD", country: "England" },
  { code: "E07000145", dbCode: "E07000145", name: "Great Yarmouth", level: "LAD", country: "England" },
  { code: "E07000146", dbCode: "E07000146", name: "King's Lynn and West Norfolk", level: "LAD", country: "England" },
  { code: "E07000147", dbCode: "E07000147", name: "North Norfolk", level: "LAD", country: "England" },
  { code: "E07000148", dbCode: "E07000148", name: "Norwich", level: "LAD", country: "England" },
  { code: "E07000149", dbCode: "E07000149", name: "South Norfolk", level: "LAD", country: "England" },
  { code: "E07000170", dbCode: "E07000170", name: "Ashfield", level: "LAD", country: "England" },
  { code: "E07000171", dbCode: "E07000171", name: "Bassetlaw", level: "LAD", country: "England" },
  { code: "E07000172", dbCode: "E07000172", name: "Broxtowe", level: "LAD", country: "England" },
  { code: "E07000173", dbCode: "E07000173", name: "Gedling", level: "LAD", country: "England" },
  { code: "E07000174", dbCode: "E07000174", name: "Mansfield", level: "LAD", country: "England" },
  { code: "E07000175", dbCode: "E07000175", name: "Newark and Sherwood", level: "LAD", country: "England" },
  { code: "E07000176", dbCode: "E07000176", name: "Rushcliffe", level: "LAD", country: "England" },
  { code: "E07000177", dbCode: "E07000177", name: "Cherwell", level: "LAD", country: "England" },
  { code: "E07000178", dbCode: "E07000178", name: "Oxford", level: "LAD", country: "England" },
  { code: "E07000179", dbCode: "E07000179", name: "South Oxfordshire", level: "LAD", country: "England" },
  { code: "E07000180", dbCode: "E07000180", name: "Vale of White Horse", level: "LAD", country: "England" },
  { code: "E07000181", dbCode: "E07000181", name: "West Oxfordshire", level: "LAD", country: "England" },
  { code: "E07000192", dbCode: "E07000192", name: "Cannock Chase", level: "LAD", country: "England" },
  { code: "E07000193", dbCode: "E07000193", name: "East Staffordshire", level: "LAD", country: "England" },
  { code: "E07000194", dbCode: "E07000194", name: "Lichfield", level: "LAD", country: "England" },
  { code: "E07000195", dbCode: "E07000195", name: "Newcastle-under-Lyme", level: "LAD", country: "England" },
  { code: "E07000196", dbCode: "E07000196", name: "South Staffordshire", level: "LAD", country: "England" },
  { code: "E07000197", dbCode: "E07000197", name: "Stafford", level: "LAD", country: "England" },
  { code: "E07000198", dbCode: "E07000198", name: "Staffordshire Moorlands", level: "LAD", country: "England" },
  { code: "E07000199", dbCode: "E07000199", name: "Tamworth", level: "LAD", country: "England" },
  { code: "E07000200", dbCode: "E07000200", name: "Babergh", level: "LAD", country: "England" },
  { code: "E07000202", dbCode: "E07000202", name: "Ipswich", level: "LAD", country: "England" },
  { code: "E07000203", dbCode: "E07000203", name: "Mid Suffolk", level: "LAD", country: "England" },
  { code: "E07000207", dbCode: "E07000207", name: "Elmbridge", level: "LAD", country: "England" },
  { code: "E07000208", dbCode: "E07000208", name: "Epsom and Ewell", level: "LAD", country: "England" },
  { code: "E07000209", dbCode: "E07000209", name: "Guildford", level: "LAD", country: "England" },
  { code: "E07000210", dbCode: "E07000210", name: "Mole Valley", level: "LAD", country: "England" },
  { code: "E07000211", dbCode: "E07000211", name: "Reigate and Banstead", level: "LAD", country: "England" },
  { code: "E07000212", dbCode: "E07000212", name: "Runnymede", level: "LAD", country: "England" },
  { code: "E07000213", dbCode: "E07000213", name: "Spelthorne", level: "LAD", country: "England" },
  { code: "E07000214", dbCode: "E07000214", name: "Surrey Heath", level: "LAD", country: "England" },
  { code: "E07000215", dbCode: "E07000215", name: "Tandridge", level: "LAD", country: "England" },
  { code: "E07000216", dbCode: "E07000216", name: "Waverley", level: "LAD", country: "England" },
  { code: "E07000217", dbCode: "E07000217", name: "Woking", level: "LAD", country: "England" },
  { code: "E07000218", dbCode: "E07000218", name: "North Warwickshire", level: "LAD", country: "England" },
  { code: "E07000219", dbCode: "E07000219", name: "Nuneaton and Bedworth", level: "LAD", country: "England" },
  { code: "E07000220", dbCode: "E07000220", name: "Rugby", level: "LAD", country: "England" },
  { code: "E07000221", dbCode: "E07000221", name: "Stratford-on-Avon", level: "LAD", country: "England" },
  { code: "E07000222", dbCode: "E07000222", name: "Warwick", level: "LAD", country: "England" },
  { code: "E07000223", dbCode: "E07000223", name: "Adur", level: "LAD", country: "England" },
  { code: "E07000224", dbCode: "E07000224", name: "Arun", level: "LAD", country: "England" },
  { code: "E07000225", dbCode: "E07000225", name: "Chichester", level: "LAD", country: "England" },
  { code: "E07000226", dbCode: "E07000226", name: "Crawley", level: "LAD", country: "England" },
  { code: "E07000227", dbCode: "E07000227", name: "Horsham", level: "LAD", country: "England" },
  { code: "E07000228", dbCode: "E07000228", name: "Mid Sussex", level: "LAD", country: "England" },
  { code: "E07000229", dbCode: "E07000229", name: "Worthing", level: "LAD", country: "England" },
  { code: "E07000234", dbCode: "E07000234", name: "Bromsgrove", level: "LAD", country: "England" },
  { code: "E07000235", dbCode: "E07000235", name: "Malvern Hills", level: "LAD", country: "England" },
  { code: "E07000236", dbCode: "E07000236", name: "Redditch", level: "LAD", country: "England" },
  { code: "E07000237", dbCode: "E07000237", name: "Worcester", level: "LAD", country: "England" },
  { code: "E07000238", dbCode: "E07000238", name: "Wychavon", level: "LAD", country: "England" },
  { code: "E07000239", dbCode: "E07000239", name: "Wyre Forest", level: "LAD", country: "England" },
  { code: "E07000240", dbCode: "E07000240", name: "St Albans", level: "LAD", country: "England" },
  { code: "E07000241", dbCode: "E07000241", name: "Welwyn Hatfield", level: "LAD", country: "England" },
  { code: "E07000242", dbCode: "E07000242", name: "East Hertfordshire", level: "LAD", country: "England" },
  { code: "E07000243", dbCode: "E07000243", name: "Stevenage", level: "LAD", country: "England" },
  { code: "E07000244", dbCode: "E07000244", name: "East Suffolk", level: "LAD", country: "England" },
  { code: "E07000245", dbCode: "E07000245", name: "West Suffolk", level: "LAD", country: "England" },
  { code: "E08000001", dbCode: "E08000001", name: "Bolton", level: "LAD", country: "England" },
  { code: "E08000002", dbCode: "E08000002", name: "Bury", level: "LAD", country: "England" },
  { code: "E08000003", dbCode: "E08000003", name: "Manchester", level: "LAD", country: "England" },
  { code: "E08000004", dbCode: "E08000004", name: "Oldham", level: "LAD", country: "England" },
  { code: "E08000005", dbCode: "E08000005", name: "Rochdale", level: "LAD", country: "England" },
  { code: "E08000006", dbCode: "E08000006", name: "Salford", level: "LAD", country: "England" },
  { code: "E08000007", dbCode: "E08000007", name: "Stockport", level: "LAD", country: "England" },
  { code: "E08000008", dbCode: "E08000008", name: "Tameside", level: "LAD", country: "England" },
  { code: "E08000009", dbCode: "E08000009", name: "Trafford", level: "LAD", country: "England" },
  { code: "E08000010", dbCode: "E08000010", name: "Wigan", level: "LAD", country: "England" },
  { code: "E08000011", dbCode: "E08000011", name: "Knowsley", level: "LAD", country: "England" },
  { code: "E08000012", dbCode: "E08000012", name: "Liverpool", level: "LAD", country: "England" },
  { code: "E08000013", dbCode: "E08000013", name: "St. Helens", level: "LAD", country: "England" },
  { code: "E08000014", dbCode: "E08000014", name: "Sefton", level: "LAD", country: "England" },
  { code: "E08000015", dbCode: "E08000015", name: "Wirral", level: "LAD", country: "England" },
  { code: "E08000016", dbCode: "E08000016", name: "Barnsley", level: "LAD", country: "England" },
  { code: "E08000017", dbCode: "E08000017", name: "Doncaster", level: "LAD", country: "England" },
  { code: "E08000018", dbCode: "E08000018", name: "Rotherham", level: "LAD", country: "England" },
  { code: "E08000019", dbCode: "E08000019", name: "Sheffield", level: "LAD", country: "England" },
  { code: "E08000021", dbCode: "E08000021", name: "Newcastle upon Tyne", level: "LAD", country: "England" },
  { code: "E08000022", dbCode: "E08000022", name: "North Tyneside", level: "LAD", country: "England" },
  { code: "E08000023", dbCode: "E08000023", name: "South Tyneside", level: "LAD", country: "England" },
  { code: "E08000024", dbCode: "E08000024", name: "Sunderland", level: "LAD", country: "England" },
  { code: "E08000025", dbCode: "E08000025", name: "Birmingham", level: "LAD", country: "England" },
  { code: "E08000026", dbCode: "E08000026", name: "Coventry", level: "LAD", country: "England" },
  { code: "E08000027", dbCode: "E08000027", name: "Dudley", level: "LAD", country: "England" },
  { code: "E08000028", dbCode: "E08000028", name: "Sandwell", level: "LAD", country: "England" },
  { code: "E08000029", dbCode: "E08000029", name: "Solihull", level: "LAD", country: "England" },
  { code: "E08000030", dbCode: "E08000030", name: "Walsall", level: "LAD", country: "England" },
  { code: "E08000031", dbCode: "E08000031", name: "Wolverhampton", level: "LAD", country: "England" },
  { code: "E08000032", dbCode: "E08000032", name: "Bradford", level: "LAD", country: "England" },
  { code: "E08000033", dbCode: "E08000033", name: "Calderdale", level: "LAD", country: "England" },
  { code: "E08000034", dbCode: "E08000034", name: "Kirklees", level: "LAD", country: "England" },
  { code: "E08000035", dbCode: "E08000035", name: "Leeds", level: "LAD", country: "England" },
  { code: "E08000036", dbCode: "E08000036", name: "Wakefield", level: "LAD", country: "England" },
  { code: "E08000037", dbCode: "E08000037", name: "Gateshead", level: "LAD", country: "England" },
  { code: "E09000001", dbCode: "E09000001", name: "City of London", level: "LAD", country: "England" },
  { code: "E09000002", dbCode: "E09000002", name: "Barking and Dagenham", level: "LAD", country: "England" },
  { code: "E09000003", dbCode: "E09000003", name: "Barnet", level: "LAD", country: "England" },
  { code: "E09000004", dbCode: "E09000004", name: "Bexley", level: "LAD", country: "England" },
  { code: "E09000005", dbCode: "E09000005", name: "Brent", level: "LAD", country: "England" },
  { code: "E09000006", dbCode: "E09000006", name: "Bromley", level: "LAD", country: "England" },
  { code: "E09000007", dbCode: "E09000007", name: "Camden", level: "LAD", country: "England" },
  { code: "E09000008", dbCode: "E09000008", name: "Croydon", level: "LAD", country: "England" },
  { code: "E09000009", dbCode: "E09000009", name: "Ealing", level: "LAD", country: "England" },
  { code: "E09000010", dbCode: "E09000010", name: "Enfield", level: "LAD", country: "England" },
  { code: "E09000011", dbCode: "E09000011", name: "Greenwich", level: "LAD", country: "England" },
  { code: "E09000012", dbCode: "E09000012", name: "Hackney", level: "LAD", country: "England" },
  { code: "E09000013", dbCode: "E09000013", name: "Hammersmith and Fulham", level: "LAD", country: "England" },
  { code: "E09000014", dbCode: "E09000014", name: "Haringey", level: "LAD", country: "England" },
  { code: "E09000015", dbCode: "E09000015", name: "Harrow", level: "LAD", country: "England" },
  { code: "E09000016", dbCode: "E09000016", name: "Havering", level: "LAD", country: "England" },
  { code: "E09000017", dbCode: "E09000017", name: "Hillingdon", level: "LAD", country: "England" },
  { code: "E09000018", dbCode: "E09000018", name: "Hounslow", level: "LAD", country: "England" },
  { code: "E09000019", dbCode: "E09000019", name: "Islington", level: "LAD", country: "England" },
  { code: "E09000020", dbCode: "E09000020", name: "Kensington and Chelsea", level: "LAD", country: "England" },
  { code: "E09000021", dbCode: "E09000021", name: "Kingston upon Thames", level: "LAD", country: "England" },
  { code: "E09000022", dbCode: "E09000022", name: "Lambeth", level: "LAD", country: "England" },
  { code: "E09000023", dbCode: "E09000023", name: "Lewisham", level: "LAD", country: "England" },
  { code: "E09000024", dbCode: "E09000024", name: "Merton", level: "LAD", country: "England" },
  { code: "E09000025", dbCode: "E09000025", name: "Newham", level: "LAD", country: "England" },
  { code: "E09000026", dbCode: "E09000026", name: "Redbridge", level: "LAD", country: "England" },
  { code: "E09000027", dbCode: "E09000027", name: "Richmond upon Thames", level: "LAD", country: "England" },
  { code: "E09000028", dbCode: "E09000028", name: "Southwark", level: "LAD", country: "England" },
  { code: "E09000029", dbCode: "E09000029", name: "Sutton", level: "LAD", country: "England" },
  { code: "E09000030", dbCode: "E09000030", name: "Tower Hamlets", level: "LAD", country: "England" },
  { code: "E09000031", dbCode: "E09000031", name: "Waltham Forest", level: "LAD", country: "England" },
  { code: "E09000032", dbCode: "E09000032", name: "Wandsworth", level: "LAD", country: "England" },
  { code: "E09000033", dbCode: "E09000033", name: "Westminster", level: "LAD", country: "England" },

  // Scotland (32 LADs)
  { code: "S12000005", dbCode: "S12000005", name: "Clackmannanshire", level: "LAD", country: "Scotland" },
  { code: "S12000006", dbCode: "S12000006", name: "Dumfries and Galloway", level: "LAD", country: "Scotland" },
  { code: "S12000008", dbCode: "S12000008", name: "East Ayrshire", level: "LAD", country: "Scotland" },
  { code: "S12000010", dbCode: "S12000010", name: "East Lothian", level: "LAD", country: "Scotland" },
  { code: "S12000011", dbCode: "S12000011", name: "East Renfrewshire", level: "LAD", country: "Scotland" },
  { code: "S12000013", dbCode: "S12000013", name: "Na h-Eileanan Siar", level: "LAD", country: "Scotland" },
  { code: "S12000014", dbCode: "S12000014", name: "Falkirk", level: "LAD", country: "Scotland" },
  { code: "S12000017", dbCode: "S12000017", name: "Highland", level: "LAD", country: "Scotland" },
  { code: "S12000018", dbCode: "S12000018", name: "Inverclyde", level: "LAD", country: "Scotland" },
  { code: "S12000019", dbCode: "S12000019", name: "Midlothian", level: "LAD", country: "Scotland" },
  { code: "S12000020", dbCode: "S12000020", name: "Moray", level: "LAD", country: "Scotland" },
  { code: "S12000021", dbCode: "S12000021", name: "North Ayrshire", level: "LAD", country: "Scotland" },
  { code: "S12000023", dbCode: "S12000023", name: "Orkney Islands", level: "LAD", country: "Scotland" },
  { code: "S12000026", dbCode: "S12000026", name: "Scottish Borders", level: "LAD", country: "Scotland" },
  { code: "S12000027", dbCode: "S12000027", name: "Shetland Islands", level: "LAD", country: "Scotland" },
  { code: "S12000028", dbCode: "S12000028", name: "South Ayrshire", level: "LAD", country: "Scotland" },
  { code: "S12000029", dbCode: "S12000029", name: "South Lanarkshire", level: "LAD", country: "Scotland" },
  { code: "S12000030", dbCode: "S12000030", name: "Stirling", level: "LAD", country: "Scotland" },
  { code: "S12000033", dbCode: "S12000033", name: "Aberdeen City", level: "LAD", country: "Scotland" },
  { code: "S12000034", dbCode: "S12000034", name: "Aberdeenshire", level: "LAD", country: "Scotland" },
  { code: "S12000035", dbCode: "S12000035", name: "Argyll and Bute", level: "LAD", country: "Scotland" },
  { code: "S12000036", dbCode: "S12000036", name: "City of Edinburgh", level: "LAD", country: "Scotland" },
  { code: "S12000038", dbCode: "S12000038", name: "Renfrewshire", level: "LAD", country: "Scotland" },
  { code: "S12000039", dbCode: "S12000039", name: "West Dunbartonshire", level: "LAD", country: "Scotland" },
  { code: "S12000040", dbCode: "S12000040", name: "West Lothian", level: "LAD", country: "Scotland" },
  { code: "S12000041", dbCode: "S12000041", name: "Angus", level: "LAD", country: "Scotland" },
  { code: "S12000042", dbCode: "S12000042", name: "Dundee City", level: "LAD", country: "Scotland" },
  { code: "S12000045", dbCode: "S12000045", name: "East Dunbartonshire", level: "LAD", country: "Scotland" },
  { code: "S12000047", dbCode: "S12000047", name: "Fife", level: "LAD", country: "Scotland" },
  { code: "S12000048", dbCode: "S12000048", name: "Perth and Kinross", level: "LAD", country: "Scotland" },
  { code: "S12000049", dbCode: "S12000049", name: "Glasgow City", level: "LAD", country: "Scotland" },
  { code: "S12000050", dbCode: "S12000050", name: "North Lanarkshire", level: "LAD", country: "Scotland" },

  // Wales (23 LADs)
  { code: "W06000001", dbCode: "W06000001", name: "Isle of Anglesey", level: "LAD", country: "Wales" },
  { code: "W06000002", dbCode: "W06000002", name: "Gwynedd", level: "LAD", country: "Wales" },
  { code: "W06000003", dbCode: "W06000003", name: "Conwy", level: "LAD", country: "Wales" },
  { code: "W06000004", dbCode: "W06000004", name: "Denbighshire", level: "LAD", country: "Wales" },
  { code: "W06000005", dbCode: "W06000005", name: "Flintshire", level: "LAD", country: "Wales" },
  { code: "W06000006", dbCode: "W06000006", name: "Wrexham", level: "LAD", country: "Wales" },
  { code: "W06000008", dbCode: "W06000008", name: "Ceredigion", level: "LAD", country: "Wales" },
  { code: "W06000009", dbCode: "W06000009", name: "Pembrokeshire", level: "LAD", country: "Wales" },
  { code: "W06000010", dbCode: "W06000010", name: "Carmarthenshire", level: "LAD", country: "Wales" },
  { code: "W06000011", dbCode: "W06000011", name: "Swansea", level: "LAD", country: "Wales" },
  { code: "W06000012", dbCode: "W06000012", name: "Neath Port Talbot", level: "LAD", country: "Wales" },
  { code: "W06000013", dbCode: "W06000013", name: "Bridgend", level: "LAD", country: "Wales" },
  { code: "W06000014", dbCode: "W06000014", name: "Vale of Glamorgan", level: "LAD", country: "Wales" },
  { code: "W06000015", dbCode: "W06000015", name: "Cardiff", level: "LAD", country: "Wales" },
  { code: "W06000016", dbCode: "W06000016", name: "Rhondda Cynon Taf", level: "LAD", country: "Wales" },
  { code: "W06000018", dbCode: "W06000018", name: "Caerphilly", level: "LAD", country: "Wales" },
  { code: "W06000019", dbCode: "W06000019", name: "Blaenau Gwent", level: "LAD", country: "Wales" },
  { code: "W06000020", dbCode: "W06000020", name: "Torfaen", level: "LAD", country: "Wales" },
  { code: "W06000021", dbCode: "W06000021", name: "Monmouthshire", level: "LAD", country: "Wales" },
  { code: "W06000022", dbCode: "W06000022", name: "Newport", level: "LAD", country: "Wales" },
  { code: "W06000023", dbCode: "W06000023", name: "Powys", level: "LAD", country: "Wales" },
  { code: "W06000024", dbCode: "W06000024", name: "Merthyr Tydfil", level: "LAD", country: "Wales" },

  // Northern Ireland (11 LADs)
  { code: "N09000001", dbCode: "N09000001", name: "Antrim and Newtownabbey", level: "LAD", country: "Northern Ireland" },
  { code: "N09000002", dbCode: "N09000002", name: "Armagh City, Banbridge and Craigavon", level: "LAD", country: "Northern Ireland" },
  { code: "N09000003", dbCode: "N09000003", name: "Belfast", level: "LAD", country: "Northern Ireland" },
  { code: "N09000004", dbCode: "N09000004", name: "Causeway Coast and Glens", level: "LAD", country: "Northern Ireland" },
  { code: "N09000005", dbCode: "N09000005", name: "Derry City and Strabane", level: "LAD", country: "Northern Ireland" },
  { code: "N09000006", dbCode: "N09000006", name: "Fermanagh and Omagh", level: "LAD", country: "Northern Ireland" },
  { code: "N09000007", dbCode: "N09000007", name: "Lisburn and Castlereagh", level: "LAD", country: "Northern Ireland" },
  { code: "N09000008", dbCode: "N09000008", name: "Mid and East Antrim", level: "LAD", country: "Northern Ireland" },
  { code: "N09000009", dbCode: "N09000009", name: "Mid Ulster", level: "LAD", country: "Northern Ireland" },
  { code: "N09000010", dbCode: "N09000010", name: "Newry, Mourne and Down", level: "LAD", country: "Northern Ireland" },
  { code: "N09000011", dbCode: "N09000011", name: "Ards and North Down", level: "LAD", country: "Northern Ireland" },
]

// -----------------------------------------------------------------------------
// Scenarios & Years
// -----------------------------------------------------------------------------

export const SCENARIOS = ["baseline", "upside", "downside"] as const

export const YEARS = {
  min: 2010,
  max: 2050,
  forecastStart: 2024,
} as const

export type Scenario = (typeof SCENARIOS)[number]

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// Helper: convert UI region code → DB region code for queries
// Supports ITL1 (UK*), ITL2 (TL*), ITL3 (TL*), and LAD (E/S/W/N*)
export function getDbRegionCode(code: string): string {
  // If code already looks like a DB code, normalise via REGIONS
  if (
    code.startsWith("E") || code.startsWith("S") || code.startsWith("W") ||
    code.startsWith("N") || code.startsWith("TL")
  ) {
    const region = REGIONS.find(r => r.dbCode === code || r.code === code)
    return region?.dbCode ?? code
  }

  // Otherwise treat as UI code (UK*, TL*) and look up
  const region = REGIONS.find(r => r.code === code)
  if (region) return region.dbCode

  // Fallback for ITL1 via mapping
  return ITL_TO_E_CODE[code] || code
}

// Helper: convert DB region code → UI region code
// For ITL1 DB codes (E/S/W/N) → UK*; for ITL2/3 TL* codes and LAD codes (E/S/W/N*), returns the code unchanged (as they are the UI code too).
export function getUIRegionCode(code: string): string {
  // Map E/S/W/N ITL1 codes to UK*
  if (code in E_CODE_TO_ITL) {
    return E_CODE_TO_ITL[code]
  }
  
  // Otherwise, for TL* and LAD codes, the DB code is the UI code
  return code
}

// Helper: get Region object by either UI code or DB code
export function getRegion(code: string): Region | undefined {
  return REGIONS.find(r => r.code === code || r.dbCode === code)
}

// Helper: get the appropriate Supabase table name based on UI region level
// (Used by both client data-service and server-side export routes.)
export function getTableName(regionCode: string): string {
  const region = REGIONS.find(r => r.code === regionCode)
  const level = region?.level || "ITL1"

  switch (level) {
    case "ITL1":
      return "itl1_latest_all"
    case "ITL2":
      return "itl2_latest_all"
    case "ITL3":
      return "itl3_latest_all"
    case "LAD":
      return "lad_latest_all"
    default:
      return "itl1_latest_all"
  }
}