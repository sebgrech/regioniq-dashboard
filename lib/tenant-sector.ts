// =============================================================================
// Tenant Sector Inference
// =============================================================================
// Infers the tenant sector from tenant name to enable asset-specific
// economic context tailoring.

export type TenantSector =
  | "retail"
  | "office"
  | "residential"
  | "leisure"
  | "industrial"
  | "f_and_b"
  | "other"

// Sector display labels
export const SECTOR_LABELS: Record<TenantSector, string> = {
  retail: "Retail",
  office: "Office",
  residential: "Residential",
  leisure: "Leisure",
  industrial: "Industrial",
  f_and_b: "F&B",
  other: "Other",
}

// Pattern matching rules for sector inference
// Order matters - more specific patterns should come first
const SECTOR_PATTERNS: { patterns: string[]; sector: TenantSector }[] = [
  // Leisure / Fitness
  {
    patterns: [
      "pilates",
      "yoga",
      "gym",
      "fitness",
      "spa",
      "health club",
      "david lloyd",
      "pure gym",
      "nuffield",
      "virgin active",
      "anytime fitness",
      "mind and motion",
    ],
    sector: "leisure",
  },
  // F&B
  {
    patterns: [
      "restaurant",
      "bakery",
      "cafe",
      "coffee",
      "pizza",
      "burger",
      "nando",
      "wagamama",
      "greggs",
      "costa",
      "starbucks",
      "pret",
      "cornish bakery",
      "itsu",
      "eat",
      "leon",
      "subway",
      "mcdonald",
      "kfc",
      "pub",
      "bar",
      "tavern",
    ],
    sector: "f_and_b",
  },
  // Office / Serviced
  {
    patterns: [
      "serviced office",
      "regus",
      "iwg",
      "wework",
      "hana",
      "spaces",
      "flexible workspace",
      "coworking",
    ],
    sector: "office",
  },
  // Residential / Student
  {
    patterns: [
      "student",
      "pbsa",
      "unite",
      "scape",
      "housing association",
      "residential",
      "apartments",
      "btr",
      "build to rent",
    ],
    sector: "residential",
  },
  // Industrial / Logistics
  {
    patterns: [
      "logistics",
      "warehouse",
      "amazon",
      "dhl",
      "fedex",
      "ups",
      "hermes",
      "yodel",
      "royal mail",
      "distribution",
      "fulfilment",
      "industrial",
    ],
    sector: "industrial",
  },
  // Retail - larger pattern set as default catch-all for shops
  {
    patterns: [
      "new look",
      "primark",
      "boots",
      "tesco",
      "sainsbury",
      "asda",
      "morrisons",
      "aldi",
      "lidl",
      "waitrose",
      "marks & spencer",
      "m&s",
      "next",
      "h&m",
      "zara",
      "topshop",
      "river island",
      "sports direct",
      "jd sports",
      "dr martens",
      "castle fine art",
      "waterstones",
      "whsmith",
      "superdrug",
      "savers",
      "poundland",
      "home bargains",
      "b&m",
      "wilko",
      "the range",
      "argos",
      "currys",
      "pure brides",
      "retail",
      "retailers",
      "shop",
      "store",
    ],
    sector: "retail",
  },
]

/**
 * Infers the tenant sector from the tenant name.
 * 
 * @param tenant - The tenant name from the OM (e.g., "New Look Retailers Limited")
 * @returns The inferred sector, or "other" if no match found
 * 
 * @example
 * inferTenantSector("New Look Retailers Limited") // => "retail"
 * inferTenantSector("Mind and Motion Limited") // => "leisure"
 * inferTenantSector("Cornish Bakery") // => "f_and_b"
 */
export function inferTenantSector(tenant: string | null | undefined): TenantSector {
  if (!tenant) return "other"

  const lowerTenant = tenant.toLowerCase()

  for (const { patterns, sector } of SECTOR_PATTERNS) {
    for (const pattern of patterns) {
      if (lowerTenant.includes(pattern)) {
        return sector
      }
    }
  }

  return "other"
}

/**
 * Returns an appropriate icon name for the sector.
 * These map to Lucide icon names.
 */
export function getSectorIconName(sector: TenantSector): string {
  switch (sector) {
    case "retail":
      return "ShoppingBag"
    case "office":
      return "Briefcase"
    case "residential":
      return "Home"
    case "leisure":
      return "Dumbbell"
    case "industrial":
      return "Warehouse"
    case "f_and_b":
      return "UtensilsCrossed"
    default:
      return "Building2"
  }
}
