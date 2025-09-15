import { Users, TrendingUp, PoundSterling, Briefcase } from "lucide-react"

export interface Metric {
  id: string
  title: string
  shortTitle: string
  unit: string
  icon: any
  decimals: number
  color: string
}

export interface Region {
  code: string        // ITL code for UI display (UKI, UKJ, etc.)
  dbCode: string      // E-code for database queries (E12000007, etc.)
  name: string
  level: string
  country: string
}

// Map E-codes to ITL codes
export const E_CODE_TO_ITL: Record<string, string> = {
  "E12000001": "UKC",  // North East
  "E12000002": "UKD",  // North West
  "E12000003": "UKE",  // Yorkshire and The Humber
  "E12000004": "UKF",  // East Midlands
  "E12000005": "UKG",  // West Midlands
  "E12000006": "UKH",  // East of England
  "E12000007": "UKI",  // London
  "E12000008": "UKJ",  // South East
  "E12000009": "UKK",  // South West
  "S92000003": "UKM",  // Scotland
  "W92000004": "UKL",  // Wales
  "N92000002": "UKN",  // Northern Ireland
}

// Reverse mapping for convenience
export const ITL_TO_E_CODE: Record<string, string> = Object.entries(E_CODE_TO_ITL).reduce(
  (acc, [eCode, itlCode]) => ({ ...acc, [itlCode]: eCode }),
  {}
)

// Updated METRICS with exact metric_id values from your Supabase
export const METRICS: Metric[] = [
  {
    id: "population_total",  // Exact match to Supabase metric_id
    title: "Population",
    shortTitle: "Population",
    unit: "people",
    icon: Users,
    decimals: 1,
    color: "hsl(var(--chart-1))",
  },
  {
    id: "nominal_gva_mn_gbp",  // Exact match to Supabase metric_id
    title: "Gross Value Added",
    shortTitle: "GVA",
    unit: "£m",
    icon: TrendingUp,
    decimals: 0,
    color: "hsl(var(--chart-2))",
  },
  {
    id: "gdhi_per_head_gbp",  // Exact match to Supabase metric_id
    title: "Gross Disposable Household Income per Head",
    shortTitle: "GDHI per Head",
    unit: "£",
    icon: PoundSterling,
    decimals: 0,
    color: "hsl(var(--chart-3))",
  },
  {
    id: "emp_total_jobs",  // Exact match to Supabase metric_id
    title: "Total Employment",
    shortTitle: "Employment",
    unit: "jobs",
    icon: Briefcase,
    decimals: 1,
    color: "hsl(var(--chart-4))",
  },
]

// Updated REGIONS with both ITL codes (for UI) and E-codes (for database)
export const REGIONS: Region[] = [
  // England ITL1 regions
  { 
    code: "UKI", 
    dbCode: "E12000007",
    name: "London", 
    level: "ITL1", 
    country: "England" 
  },
  { 
    code: "UKC", 
    dbCode: "E12000001",
    name: "North East", 
    level: "ITL1", 
    country: "England" 
  },
  { 
    code: "UKD", 
    dbCode: "E12000002",
    name: "North West", 
    level: "ITL1", 
    country: "England" 
  },
  { 
    code: "UKE", 
    dbCode: "E12000003",
    name: "Yorkshire and The Humber", 
    level: "ITL1", 
    country: "England" 
  },
  { 
    code: "UKF", 
    dbCode: "E12000004",
    name: "East Midlands", 
    level: "ITL1", 
    country: "England" 
  },
  { 
    code: "UKG", 
    dbCode: "E12000005",
    name: "West Midlands", 
    level: "ITL1", 
    country: "England" 
  },
  { 
    code: "UKH", 
    dbCode: "E12000006",
    name: "East of England", 
    level: "ITL1", 
    country: "England" 
  },
  { 
    code: "UKJ", 
    dbCode: "E12000008",
    name: "South East", 
    level: "ITL1", 
    country: "England" 
  },
  { 
    code: "UKK", 
    dbCode: "E12000009",
    name: "South West", 
    level: "ITL1", 
    country: "England" 
  },
  // Scotland, Wales, Northern Ireland
  { 
    code: "UKM", 
    dbCode: "S92000003",
    name: "Scotland", 
    level: "ITL1", 
    country: "Scotland" 
  },
  { 
    code: "UKL", 
    dbCode: "W92000004",
    name: "Wales", 
    level: "ITL1", 
    country: "Wales" 
  },
  { 
    code: "UKN", 
    dbCode: "N92000002",
    name: "Northern Ireland", 
    level: "ITL1", 
    country: "Northern Ireland" 
  },
]

export const SCENARIOS = ["baseline", "upside", "downside"] as const

export const YEARS = {
  min: 2010,
  max: 2050,  // Updated to match your data range
  forecastStart: 2024,
} as const

export type Scenario = (typeof SCENARIOS)[number]

// Helper function to convert ITL code to E-code for database queries
export function getDbRegionCode(itlCode: string): string {
  // First check if it's already an E-code
  if (itlCode.startsWith("E") || itlCode.startsWith("S") || itlCode.startsWith("W") || itlCode.startsWith("N")) {
    return itlCode
  }
  
  // Otherwise convert from ITL to E-code
  const region = REGIONS.find(r => r.code === itlCode)
  return region?.dbCode || ITL_TO_E_CODE[itlCode] || itlCode
}

// Helper function to convert E-code to ITL code for UI display
export function getUIRegionCode(eCode: string): string {
  // First check if it's already an ITL code
  if (eCode.startsWith("UK")) {
    return eCode
  }
  
  // Otherwise convert from E-code to ITL
  return E_CODE_TO_ITL[eCode] || eCode
}

// Helper function to get region by either code type
export function getRegion(code: string): Region | undefined {
  return REGIONS.find(r => r.code === code || r.dbCode === code)
}