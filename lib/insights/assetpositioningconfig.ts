/**
 * Asset Positioning Configuration
 * 
 * Signal interpretation matrix for generating economically defensible
 * positioning insights for any asset class in any location.
 * 
 * Design principles:
 * 1. Every place has economic character - always something investable to say
 * 2. Signals are facts, interpretation is asset-specific
 * 3. Never return empty - always generate 3-4 defensible bullets
 * 4. Avoid value judgments - "tight" not "bad"
 * 5. Anchor to data - every bullet references underlying metrics
 */

import type { TenantSector } from "@/lib/tenant-sector"

// =============================================================================
// Types
// =============================================================================

export type SignalId = 
  | "employment_density"
  | "income_capture"
  | "labour_capacity"
  | "productivity_strength"
  | "growth_composition"

export type SignalOutcome = 
  | "extreme"
  | "extreme_high"
  | "extreme_low"
  | "high"
  | "low"
  | "neutral"
  | "rising"
  | "falling"

export type AssetLens = 
  | "office"
  | "retail"
  | "industrial"
  | "residential"
  | "leisure"
  | "mixed"
  | "general"

export interface SignalInterpretation {
  text: string
  relevance: string
  why: string // Economic reasoning for this interpretation
}

export interface CoreBulletSlot {
  id: string
  signal: SignalId
  label: string
}

// =============================================================================
// Sector to Lens Mapping
// =============================================================================

export const SECTOR_TO_LENS: Record<TenantSector, AssetLens> = {
  office: "office",
  retail: "retail",
  f_and_b: "retail", // F&B uses retail lens (footfall-driven)
  industrial: "industrial",
  residential: "residential",
  leisure: "leisure",
  other: "general",
}

// =============================================================================
// Signal Priority by Asset Lens - Higher = More Important for that asset class
// =============================================================================

export const SIGNAL_PRIORITY_BY_LENS: Record<AssetLens, Record<SignalId, number>> = {
  retail: {
    employment_density: 100,    // Footfall is king for retail - worker population drives spend
    income_capture: 85,         // Spending power determines price positioning
    labour_capacity: 40,        // Staffing matters but less critical than demand
    productivity_strength: 35,  // Indirect relevance via income proxies
    growth_composition: 70,     // Growth trajectory affects long-term catchment
  },
  office: {
    employment_density: 75,     // Cluster effects matter for occupier decisions
    income_capture: 55,         // Talent quality signal
    labour_capacity: 95,        // Talent availability is key competitive factor
    productivity_strength: 100, // Productivity clusters attract knowledge workers
    growth_composition: 65,     // Employment growth signals occupier demand
  },
  industrial: {
    employment_density: 50,     // Less relevant - often peripheral locations
    income_capture: 45,         // Wage pressure indicator
    labour_capacity: 100,       // Labour availability is critical for logistics
    productivity_strength: 60,  // Indicates manufacturing vs distribution
    growth_composition: 80,     // Labour pool growth enables expansion
  },
  residential: {
    employment_density: 70,     // Job access indicates commuting patterns
    income_capture: 100,        // Affordability context is key
    labour_capacity: 80,        // Employment underpins household incomes
    productivity_strength: 55,  // Professional base indicator
    growth_composition: 90,     // Demographic trends indicate direction
  },
  leisure: {
    employment_density: 90,     // Worker populations drive weekday leisure
    income_capture: 95,         // Discretionary spend capacity
    labour_capacity: 50,        // Staffing availability
    productivity_strength: 40,  // Indirect relevance
    growth_composition: 75,     // Catchment expansion
  },
  mixed: {
    employment_density: 80,     // Supports commercial element
    income_capture: 75,         // Supports all uses
    labour_capacity: 70,        // Operational context
    productivity_strength: 65,  // Quality indicator
    growth_composition: 85,     // Development trajectory
  },
  general: {
    employment_density: 70,
    income_capture: 70,
    labour_capacity: 70,
    productivity_strength: 70,
    growth_composition: 70,
  },
}

// =============================================================================
// Core Bullet Slots - Every asset gets these 4 insights
// =============================================================================

export const CORE_BULLET_SLOTS: CoreBulletSlot[] = [
  { id: "character", signal: "employment_density", label: "Place Character" },
  { id: "spending", signal: "income_capture", label: "Demand Driver" },
  { id: "operations", signal: "labour_capacity", label: "Operational Context" },
  { id: "trajectory", signal: "growth_composition", label: "Growth Profile" },
]

// =============================================================================
// Signal Interpretation Matrix
// =============================================================================

export const SIGNAL_INTERPRETATIONS: Record<
  SignalId,
  Record<AssetLens, Partial<Record<SignalOutcome, SignalInterpretation>>>
> = {
  // ---------------------------------------------------------------------------
  // EMPLOYMENT DENSITY - Jobs per working-age resident
  // ---------------------------------------------------------------------------
  employment_density: {
    office: {
      extreme: {
        text: "Major employment hub: high tenant density and competition for space",
        relevance: "tenant demand",
        why: "Employment density exceeds 1.5 jobs per working-age resident, placing this in the top 5% of UK locations. This concentration is consistent with firm clustering patterns observed near talent pools and client bases.",
      },
      high: {
        text: "Employment destination: net commuter inflow observed",
        relevance: "occupier market",
        why: "More jobs than residents indicates net commuter inflow. This pattern is typically associated with agglomeration economies, where firms co-locate for proximity to clients, suppliers, and competitors.",
      },
      low: {
        text: "Residential catchment: fewer jobs than working-age residents",
        relevance: "talent access",
        why: "Fewer jobs than residents suggests a primarily residential location. Workers here tend to commute outward to employment centres elsewhere.",
      },
      neutral: {
        text: "Balanced employment profile: mixed occupier base",
        relevance: "market positioning",
        why: "Employment roughly matches the residential population. This balanced profile is typically associated with local-serving professional services rather than major corporate headquarters.",
      },
    },
    retail: {
      extreme: {
        text: "Exceptional weekday footfall from concentrated worker population",
        relevance: "trading hours",
        why: "Employment density in the top 5% nationally indicates a large daytime population. This suggests elevated weekday footfall during lunch hours and after-work periods relative to residential-only locations.",
      },
      high: {
        text: "Above-average daytime footfall from local employment base",
        relevance: "footfall profile",
        why: "More workers than residents suggests weekday footfall patterns skewed toward daytime hours - morning commute, lunch periods, and after-work transitions.",
      },
      low: {
        text: "Residential catchment: evening and weekend spend dominant",
        relevance: "trading patterns",
        why: "A residential-dominant catchment suggests trading activity is concentrated in evenings and weekends rather than weekday lunch periods.",
      },
      neutral: {
        text: "Mixed footfall profile: steady throughout week",
        relevance: "trading consistency",
        why: "Balanced employment and residential populations suggest footfall is distributed across weekdays and weekends rather than concentrated in specific periods.",
      },
    },
    industrial: {
      extreme: {
        text: "Industrial clusters typically co-locate with service employment",
        relevance: "ecosystem maturity",
        why: "High employment density near industrial locations suggests an established commercial ecosystem with existing transport links and supply chain infrastructure.",
      },
      high: {
        text: "Employment density indicates established commercial ecosystem",
        relevance: "infrastructure",
        why: "Surrounding employment concentration is consistent with established transport infrastructure and ancillary service provision in the area.",
      },
      low: {
        text: "Peripheral character: lower employment concentration",
        relevance: "labour availability",
        why: "Low employment density suggests less competition for warehouse and logistics workers in the immediate area. Workers may commute from surrounding residential areas.",
      },
      neutral: {
        text: "Standard employment density for industrial locations",
        relevance: "market context",
        why: "Employment levels are in line with typical patterns for established industrial areas in the UK.",
      },
    },
    residential: {
      extreme: {
        text: "Daytime population outflow observed",
        relevance: "commuting patterns",
        why: "High employment concentration suggests many residents commute outward during working hours, with the area's character shifting between day and evening.",
      },
      high: {
        text: "Net commuter inflow observed during working hours",
        relevance: "amenity presence",
        why: "Net commuter inflow is typically associated with a concentration of services and amenities - childcare, gyms, convenience retail - that follow worker populations.",
      },
      low: {
        text: "Residential-dominant area",
        relevance: "character",
        why: "Primarily residential character with fewer jobs than working-age residents. This pattern is often associated with family-oriented demographics prioritising schools and community facilities.",
      },
      neutral: {
        text: "Balanced live-work ratio in catchment",
        relevance: "lifestyle profile",
        why: "Employment roughly matches resident population, suggesting many residents may access local employment without long commutes.",
      },
    },
    leisure: {
      extreme: {
        text: "High worker concentration during daytime hours",
        relevance: "daytime population",
        why: "Exceptional employment density indicates a large daytime population. Leisure activity in such locations is typically concentrated around lunch periods and after-work hours on weekdays.",
      },
      high: {
        text: "Worker population present during daytime hours",
        relevance: "daytime population",
        why: "Above-average worker population suggests weekday leisure activity patterns, with spending concentrated around lunch and after-work periods.",
      },
      low: {
        text: "Residential base: activity concentrated evenings and weekends",
        relevance: "activity patterns",
        why: "Residential-dominant catchment suggests leisure activity is concentrated in evenings and weekends rather than weekday daytime hours.",
      },
      neutral: {
        text: "Mixed residential and worker population",
        relevance: "activity diversity",
        why: "Balanced employment and residential populations suggest leisure activity is distributed across the week rather than concentrated in specific periods.",
      },
    },
    mixed: {
      extreme: {
        text: "Major employment hub with diverse commercial activity",
        relevance: "use flexibility",
        why: "Exceptional employment density indicates multiple commercial uses co-located. Activity patterns typically show commercial footfall during work hours and residential activity in evenings.",
      },
      high: {
        text: "Employment concentration with mixed activity patterns",
        relevance: "tenant diversity",
        why: "Employment concentration is typically associated with ground-floor retail and F&B presence serving the worker population.",
      },
      low: {
        text: "Residential character with convenience-focused commercial",
        relevance: "use mix",
        why: "Lower employment concentration suggests a primarily residential profile. Commercial activity in such locations tends to be convenience-focused, serving residents.",
      },
      neutral: {
        text: "Balanced employment-residential profile",
        relevance: "development context",
        why: "Employment roughly matches residential population, consistent with mixed-use patterns where neither commercial nor residential activity dominates.",
      },
    },
    general: {
      extreme: {
        text: "Major employment destination with concentrated job base",
        relevance: "economic character",
        why: "This location is in the top 5% nationally for jobs per resident, indicating a major employment centre. Commuting data suggests workers are drawn from a wide catchment area.",
      },
      high: {
        text: "Employment destination: more jobs than residents",
        relevance: "place character",
        why: "Net employment inflow characterises this location. The ratio of jobs to working-age residents exceeds the national average.",
      },
      low: {
        text: "Residential catchment: fewer jobs than working-age residents",
        relevance: "place character",
        why: "More residents than jobs indicates a primarily residential area. Many working-age residents commute elsewhere for employment.",
      },
      neutral: {
        text: "Employment broadly matches local population",
        relevance: "economic balance",
        why: "Jobs and working-age residents are roughly balanced, suggesting a relatively self-contained local economy with limited net commuter flows.",
      },
    },
  },

  // ---------------------------------------------------------------------------
  // INCOME CAPTURE - Income retention ratio
  // ---------------------------------------------------------------------------
  income_capture: {
    office: {
      extreme_high: {
        text: "Affluent commuter base: senior talent resides locally",
        relevance: "talent quality",
        why: "Resident incomes significantly exceed local output, indicating senior professionals who commute to higher-value employment elsewhere. This pattern suggests proximity to an executive talent pool.",
      },
      high: {
        text: "Above-average local incomes relative to output",
        relevance: "professional base",
        why: "Income levels relative to output suggest a professional resident base. Such areas are typically associated with local professional services - accountants, solicitors, wealth managers.",
      },
      extreme_low: {
        text: "Output centre: economic value accrues to non-resident stakeholders",
        relevance: "capital flows",
        why: "Economic output significantly exceeds resident incomes, typical of major commercial centres where value flows to shareholders and workers who commute in rather than to local residents.",
      },
      low: {
        text: "Income below local output levels",
        relevance: "income dynamics",
        why: "Resident incomes below local output suggests value created here is captured elsewhere - either by commuting workers or through ownership structures.",
      },
      neutral: {
        text: "Incomes aligned with regional output",
        relevance: "market balance",
        why: "Income and output are balanced, suggesting residents capture the value created locally. This equilibrium is typical of self-contained local economies.",
      },
    },
    retail: {
      extreme_high: {
        text: "High discretionary spend capacity: affluent residential catchment",
        relevance: "spending power",
        why: "Resident incomes are in the top tier nationally, suggesting higher discretionary spending capacity. Such catchments are typically associated with quality-focused retail and experiential offerings.",
      },
      high: {
        text: "Above-average spending power in catchment",
        relevance: "price positioning",
        why: "Incomes relative to the catchment size are above the national average, suggesting higher per-capita spending capacity than typical locations.",
      },
      extreme_low: {
        text: "Worker spend may dominate local retail activity",
        relevance: "format strategy",
        why: "Low resident incomes suggest spending in this area is likely dominated by commuting workers rather than local households.",
      },
      low: {
        text: "Below-average household incomes in catchment",
        relevance: "pricing context",
        why: "Below-average incomes suggest constrained discretionary spending capacity. Value-focused positioning is common in such catchments.",
      },
      neutral: {
        text: "Spending power in line with economic base",
        relevance: "market context",
        why: "Income levels match local economic output. Spending patterns are likely consistent with national averages for similar locations.",
      },
    },
    industrial: {
      extreme_high: {
        text: "High local incomes relative to industrial wage levels",
        relevance: "wage context",
        why: "High local incomes may create wage expectations above typical logistics pay scales. Industrial locations in affluent areas often draw workers from further afield.",
      },
      high: {
        text: "Above-average local income levels",
        relevance: "workforce context",
        why: "Income levels suggest the local workforce has alternatives to industrial employment. Labour availability depends on wider catchment commuting patterns.",
      },
      extreme_low: {
        text: "Production hub: low resident incomes",
        relevance: "labour catchment",
        why: "Low local incomes are typical of major production locations. The workforce profile suggests industrial wages may be competitive relative to local alternatives.",
      },
      low: {
        text: "Below-average local income levels",
        relevance: "workforce context",
        why: "Below-average incomes suggest industrial wages may be more competitive relative to local alternatives than in higher-income areas.",
      },
      neutral: {
        text: "Standard income profile for industrial locations",
        relevance: "cost context",
        why: "Income levels are typical of industrial catchments nationally. Labour market conditions are likely consistent with sector norms.",
      },
    },
    residential: {
      extreme_high: {
        text: "Top-tier household incomes in catchment",
        relevance: "income profile",
        why: "Resident incomes are in the top tier nationally, suggesting household budgets are less stretched relative to typical housing costs than in comparable locations.",
      },
      high: {
        text: "Above-average household incomes",
        relevance: "affordability context",
        why: "Resident incomes exceed local output, indicating professional earners commuting to higher-value employment. Housing costs are likely more affordable relative to household earnings than the national average.",
      },
      extreme_low: {
        text: "Low household incomes in catchment",
        relevance: "affordability context",
        why: "Limited local incomes suggest household budgets are constrained. Housing in such areas is typically value-focused.",
      },
      low: {
        text: "Below-average household incomes",
        relevance: "income context",
        why: "Below-average incomes suggest tighter household budgets. Housing costs represent a higher proportion of income than in more affluent areas.",
      },
      neutral: {
        text: "Income profile in line with national average",
        relevance: "market context",
        why: "Income levels are consistent with the national average, suggesting typical affordability dynamics for this type of location.",
      },
    },
    leisure: {
      extreme_high: {
        text: "Affluent catchment: high discretionary income levels",
        relevance: "spending capacity",
        why: "High incomes suggest elevated discretionary spending capacity. Such catchments are typically associated with quality-focused leisure and experiential offerings.",
      },
      high: {
        text: "Above-average discretionary income in catchment",
        relevance: "spending capacity",
        why: "Above-average incomes suggest higher discretionary spending capacity than the national average. Leisure participation tends to correlate with disposable income.",
      },
      extreme_low: {
        text: "Limited discretionary income in catchment",
        relevance: "spending context",
        why: "Limited discretionary income suggests constrained leisure budgets. Value-focused formats are common in such catchments.",
      },
      low: {
        text: "Below-average discretionary income levels",
        relevance: "pricing context",
        why: "Below-average incomes suggest constrained leisure budgets relative to the national average.",
      },
      neutral: {
        text: "Typical income levels for leisure participation",
        relevance: "market context",
        why: "Income levels are consistent with national averages, suggesting typical leisure spending patterns.",
      },
    },
    mixed: {
      extreme_high: {
        text: "Affluent catchment with high income levels",
        relevance: "spending context",
        why: "High incomes suggest elevated spending capacity across categories. Such catchments are typically associated with quality-focused offerings in both residential and commercial uses.",
      },
      high: {
        text: "Above-average incomes across catchment",
        relevance: "spending context",
        why: "Healthy incomes suggest spending power across categories. Ground-floor commercial in such areas tends to include quality-focused operators.",
      },
      extreme_low: {
        text: "Low income levels across catchment",
        relevance: "market context",
        why: "Limited incomes suggest constrained spending capacity. Mixed-use in such locations is typically value-focused across all components.",
      },
      low: {
        text: "Below-average income levels in catchment",
        relevance: "market context",
        why: "Below-average incomes suggest constrained spending capacity. Competitive pricing is typical in such catchments.",
      },
      neutral: {
        text: "Standard income profile in catchment",
        relevance: "market context",
        why: "Income levels are consistent with national averages, suggesting typical market positioning for both residential and commercial components.",
      },
    },
    general: {
      extreme_high: {
        text: "Affluent residential area: incomes exceed local output per head",
        relevance: "spending power",
        why: "Residents here earn significantly more than local economic output would suggest, typically because they commute to higher-value employment elsewhere.",
      },
      high: {
        text: "Above-average resident incomes relative to local output",
        relevance: "purchasing power",
        why: "Incomes exceed what local jobs alone would generate, suggesting a professional commuter population earning income elsewhere.",
      },
      extreme_low: {
        text: "Major output centre: value flows to non-resident stakeholders",
        relevance: "economic structure",
        why: "Economic output greatly exceeds resident incomes, characteristic of commercial centres where value accrues to businesses, shareholders, and commuting workers rather than local residents.",
      },
      low: {
        text: "Resident incomes lower than local output suggests",
        relevance: "income dynamics",
        why: "Incomes below output indicates local residents don't fully capture the value created here. This may reflect ownership structures or workforce commuting patterns.",
      },
      neutral: {
        text: "Resident incomes broadly aligned with local output",
        relevance: "economic balance",
        why: "Income and output are balanced, suggesting residents capture the economic value created locally. This pattern is typical of self-contained local economies.",
      },
    },
  },

  // ---------------------------------------------------------------------------
  // LABOUR CAPACITY - Workforce tightness
  // ---------------------------------------------------------------------------
  labour_capacity: {
    office: {
      high: {
        text: "Tight labour market: low unemployment observed",
        relevance: "talent competition",
        why: "Low unemployment and high participation rates indicate intense competition for talent. This pattern is associated with recruitment challenges and upward wage pressure.",
      },
      low: {
        text: "Labour availability: higher unemployment than average",
        relevance: "workforce availability",
        why: "Available workforce capacity suggests recruitment may be less challenging than in tighter labour markets.",
      },
      rising: {
        text: "Labour market tightening: unemployment falling",
        relevance: "trend",
        why: "Falling unemployment and rising participation suggest increasing competition for talent over time.",
      },
      falling: {
        text: "Labour market loosening: unemployment rising",
        relevance: "trend",
        why: "Rising unemployment suggests workforce availability is increasing. Recruitment may become less challenging over time.",
      },
      neutral: {
        text: "Balanced labour market conditions",
        relevance: "market context",
        why: "Labour supply and demand are roughly balanced, consistent with national averages for similar locations.",
      },
    },
    retail: {
      high: {
        text: "Tight labour market: low unemployment observed",
        relevance: "workforce context",
        why: "Tight labour markets are typically associated with staffing challenges in retail and hospitality sectors, which rely on readily available workforce.",
      },
      low: {
        text: "Higher workforce availability than average",
        relevance: "workforce context",
        why: "Available workforce capacity suggests staffing may be less challenging than in areas with tighter labour markets.",
      },
      rising: {
        text: "Labour market tightening over time",
        relevance: "trend",
        why: "Tightening labour market trends are typically associated with rising wage pressure over time.",
      },
      falling: {
        text: "Workforce availability improving",
        relevance: "trend",
        why: "Loosening labour market suggests workforce availability is increasing over time.",
      },
      neutral: {
        text: "Standard labour market conditions",
        relevance: "workforce context",
        why: "Labour market conditions are consistent with national averages. No unusual workforce dynamics observed.",
      },
    },
    industrial: {
      high: {
        text: "Tight labour market: low unemployment observed",
        relevance: "workforce context",
        why: "Tight labour markets are typically associated with competition for warehouse and logistics workers. Automation tends to be more prevalent in such locations.",
      },
      low: {
        text: "Labour pool available in catchment",
        relevance: "workforce availability",
        why: "Available workforce capacity suggests a larger pool of potential workers for distribution operations than in tighter labour markets.",
      },
      rising: {
        text: "Labour supply constraints emerging",
        relevance: "trend",
        why: "Tightening labour market trends suggest increasing competition for workers over time.",
      },
      falling: {
        text: "Labour capacity expanding",
        relevance: "trend",
        why: "Growing workforce availability suggests a larger pool of potential workers over time.",
      },
      neutral: {
        text: "Typical workforce availability",
        relevance: "workforce context",
        why: "Labour market conditions are consistent with sector norms nationally.",
      },
    },
    residential: {
      high: {
        text: "Low unemployment: strong employment base",
        relevance: "employment context",
        why: "Tight labour market indicates most working-age residents are employed. Low unemployment is typically associated with stable household incomes.",
      },
      low: {
        text: "Higher unemployment than average",
        relevance: "employment context",
        why: "Higher unemployment suggests a proportion of residents face income uncertainty. Household budgets may be more constrained than in areas with tighter labour markets.",
      },
      rising: {
        text: "Employment improving: unemployment falling",
        relevance: "trend",
        why: "Tightening labour market suggests improving employment prospects over time. Household incomes may be trending upward.",
      },
      falling: {
        text: "Employment softening: unemployment rising",
        relevance: "trend",
        why: "Loosening labour market suggests employment conditions are weakening. Household incomes may come under pressure.",
      },
      neutral: {
        text: "Stable employment conditions",
        relevance: "employment context",
        why: "Employment conditions are consistent with national averages. No unusual labour market dynamics observed.",
      },
    },
    leisure: {
      high: {
        text: "Tight labour market: low unemployment observed",
        relevance: "workforce context",
        why: "Tight labour markets are typically associated with hospitality staffing challenges, as the sector relies on available workforce.",
      },
      low: {
        text: "Higher workforce availability than average",
        relevance: "workforce context",
        why: "Available workforce capacity suggests staffing may be less challenging than in areas with tighter labour markets.",
      },
      rising: {
        text: "Labour market tightening over time",
        relevance: "trend",
        why: "Tightening labour market suggests increasing competition for hospitality workers over time.",
      },
      falling: {
        text: "Labour market loosening over time",
        relevance: "trend",
        why: "Loosening labour market suggests workforce availability is increasing. Staffing conditions may be easing.",
      },
      neutral: {
        text: "Standard labour market conditions",
        relevance: "workforce context",
        why: "Labour market conditions are consistent with national averages for leisure and hospitality sectors.",
      },
    },
    mixed: {
      high: {
        text: "Tight labour market across sectors",
        relevance: "workforce context",
        why: "Low unemployment affects all sectors. Tight labour markets are typically associated with staffing challenges across retail, leisure, and service activities.",
      },
      low: {
        text: "Higher workforce availability than average",
        relevance: "workforce context",
        why: "Available workforce capacity suggests staffing may be less challenging across commercial uses than in areas with tighter labour markets.",
      },
      rising: {
        text: "Labour market tightening over time",
        relevance: "trend",
        why: "Tightening labour market suggests increasing competition for workers across sectors over time.",
      },
      falling: {
        text: "Labour market loosening over time",
        relevance: "trend",
        why: "Loosening labour market suggests workforce availability is increasing across sectors.",
      },
      neutral: {
        text: "Standard labour market conditions",
        relevance: "workforce context",
        why: "Labour market conditions are consistent with national averages. No unusual workforce dynamics observed.",
      },
    },
    general: {
      high: {
        text: "Tight labour market: low unemployment observed",
        relevance: "workforce dynamics",
        why: "Low unemployment and high participation indicate a competitive labour market. This pattern is typically associated with recruitment challenges and wage pressure.",
      },
      low: {
        text: "Higher unemployment than national average",
        relevance: "labour availability",
        why: "Higher unemployment or lower participation indicates available workforce capacity relative to tighter labour markets.",
      },
      rising: {
        text: "Labour market tightening: unemployment falling",
        relevance: "trend",
        why: "The labour market is tightening over time. Unemployment is falling and participation rising.",
      },
      falling: {
        text: "Labour market loosening: unemployment rising",
        relevance: "trend",
        why: "Workforce availability is increasing. Unemployment is rising or participation falling.",
      },
      neutral: {
        text: "Labour market capacity is balanced",
        relevance: "workforce context",
        why: "Supply and demand for labour are roughly balanced, consistent with national averages.",
      },
    },
  },

  // ---------------------------------------------------------------------------
  // PRODUCTIVITY STRENGTH - GVA per job
  // ---------------------------------------------------------------------------
  productivity_strength: {
    office: {
      extreme: {
        text: "Ultra-high productivity: finance, energy, or specialist clusters",
        relevance: "sector composition",
        why: "Productivity in the top percentile nationally indicates specialist high-value clusters - typically finance, energy, or professional services concentrations.",
      },
      high: {
        text: "Productivity-led economy: knowledge-intensive employment",
        relevance: "sector composition",
        why: "Above-average productivity signals knowledge-intensive employment. Such locations typically include professional services, tech, and other high value-add sectors.",
      },
      low: {
        text: "Volume-driven employment: labour-intensive operations",
        relevance: "sector composition",
        why: "Below-average productivity indicates labour-intensive employment. Typical sectors include contact centres, back-office operations, and administrative functions.",
      },
      neutral: {
        text: "Productivity in line with national average",
        relevance: "sector context",
        why: "Productivity matches the national average, suggesting a typical sector mix without unusual concentration in high or low value-add activities.",
      },
    },
    retail: {
      extreme: {
        text: "High productivity correlates with high incomes",
        relevance: "spending context",
        why: "Exceptional productivity typically correlates with high incomes. Such catchments are associated with quality-focused retail and experiential offerings.",
      },
      high: {
        text: "Above-average productivity in catchment",
        relevance: "spending context",
        why: "Above-average productivity suggests professional incomes. Such catchments tend to include quality-focused retail formats.",
      },
      low: {
        text: "Below-average productivity in catchment",
        relevance: "spending context",
        why: "Lower productivity suggests more modest incomes. Value-focused retail formats are more common in such catchments.",
      },
      neutral: {
        text: "Standard productivity profile",
        relevance: "market context",
        why: "Typical productivity suggests a standard income profile consistent with national averages.",
      },
    },
    industrial: {
      extreme: {
        text: "High-value manufacturing or R&D cluster",
        relevance: "sector composition",
        why: "Exceptional productivity in an industrial context indicates high-value manufacturing, R&D, or advanced logistics. These sectors typically require specific building specifications.",
      },
      high: {
        text: "Value-add manufacturing and logistics operations",
        relevance: "sector composition",
        why: "Above-average productivity suggests value-add rather than pure distribution. Typical occupiers include light manufacturing, assembly, or logistics operations with complex value chains.",
      },
      low: {
        text: "Volume logistics and distribution operations",
        relevance: "sector composition",
        why: "Below-average productivity is typical of pure distribution operations that focus on volume throughput rather than value-add.",
      },
      neutral: {
        text: "Typical productivity for sector",
        relevance: "sector context",
        why: "Productivity matches sector norms nationally. This suggests a typical mix of industrial activities for the location.",
      },
    },
    residential: {
      extreme: {
        text: "High productivity indicates professional employment base",
        relevance: "income context",
        why: "Ultra-high productivity typically indicates professional clusters. Residents in such areas tend to include senior professionals with above-average incomes.",
      },
      high: {
        text: "Professional resident base indicated",
        relevance: "income context",
        why: "Above-average productivity suggests a professional workforce. Such areas are typically associated with employed professionals in higher-income occupations.",
      },
      low: {
        text: "Below-average productivity in catchment",
        relevance: "income context",
        why: "Lower productivity suggests more modest incomes. Household budgets in such areas tend to be more constrained than in higher-productivity locations.",
      },
      neutral: {
        text: "Average occupational mix",
        relevance: "resident profile",
        why: "Typical productivity suggests a standard occupational mix consistent with national averages.",
      },
    },
    leisure: {
      extreme: {
        text: "High productivity correlates with high discretionary incomes",
        relevance: "spending context",
        why: "Exceptional productivity typically correlates with high discretionary incomes. Such catchments are associated with quality-focused leisure offerings.",
      },
      high: {
        text: "Above-average productivity in catchment",
        relevance: "spending context",
        why: "Above-average productivity suggests above-average discretionary incomes. Such catchments tend to include quality-focused leisure offerings.",
      },
      low: {
        text: "Below-average productivity in catchment",
        relevance: "spending context",
        why: "Lower productivity suggests more constrained discretionary incomes. Value-focused leisure formats are more common in such catchments.",
      },
      neutral: {
        text: "Standard productivity profile",
        relevance: "market context",
        why: "Typical productivity suggests typical discretionary spending patterns consistent with national averages.",
      },
    },
    mixed: {
      extreme: {
        text: "High-value economy with above-average incomes",
        relevance: "spending context",
        why: "Exceptional productivity is typically associated with higher incomes across the catchment. Such locations tend to include quality-focused offerings across uses.",
      },
      high: {
        text: "Above-average productivity across catchment",
        relevance: "spending context",
        why: "Above-average productivity indicates a higher-income catchment. Such locations tend to include quality-focused operators across uses.",
      },
      low: {
        text: "Below-average productivity in catchment",
        relevance: "spending context",
        why: "Lower productivity suggests more constrained household budgets. Value-focused positioning is typical across uses in such locations.",
      },
      neutral: {
        text: "Standard productivity profile",
        relevance: "market context",
        why: "Typical productivity suggests a standard income profile consistent with national averages across uses.",
      },
    },
    general: {
      extreme: {
        text: "Ultra-high productivity economy with specialist clusters",
        relevance: "economic base",
        why: "Productivity in the top percentile nationally indicates specialist high-value economic activity. This is typically associated with exceptional incomes in the catchment.",
      },
      high: {
        text: "High value-add economy with productivity-led growth",
        relevance: "economic quality",
        why: "Above-average productivity indicates knowledge-intensive economic activity. This typically correlates with professional employment and higher incomes.",
      },
      low: {
        text: "Volume-driven employment base with labour-led growth",
        relevance: "economic structure",
        why: "Below-average productivity indicates labour-intensive economic activity. Economic growth in such areas depends on employment volume rather than value-add per worker.",
      },
      neutral: {
        text: "Productivity broadly in line with national average",
        relevance: "economic context",
        why: "Productivity matches the national average, suggesting a typical sector mix and employment profile.",
      },
    },
  },

  // ---------------------------------------------------------------------------
  // GROWTH COMPOSITION - Population vs Employment growth
  // ---------------------------------------------------------------------------
  growth_composition: {
    office: {
      high: {
        text: "Employment growth outpacing population growth",
        relevance: "growth pattern",
        why: "Employment growing faster than population indicates increasing commuter inflow over time. This pattern is associated with expanding commercial activity.",
      },
      low: {
        text: "Population growth outpacing employment growth",
        relevance: "growth pattern",
        why: "Population outpacing employment suggests residential expansion. This pattern is associated with growing local service requirements.",
      },
      neutral: {
        text: "Balanced growth trajectory",
        relevance: "growth pattern",
        why: "Population and employment are growing at similar rates. The economic character of the location is stable, with limited change in commuter dynamics.",
      },
    },
    retail: {
      high: {
        text: "Expanding worker base over time",
        relevance: "footfall trends",
        why: "Employment outpacing population indicates a growing worker population. This pattern is associated with increasing weekday footfall over time.",
      },
      low: {
        text: "Expanding residential catchment over time",
        relevance: "catchment trends",
        why: "Population outpacing employment indicates a growing residential catchment. This pattern is associated with increasing evening and weekend activity.",
      },
      neutral: {
        text: "Stable growth profile",
        relevance: "growth pattern",
        why: "Balanced population and employment growth suggests stable trading patterns over time.",
      },
    },
    industrial: {
      high: {
        text: "Employment growth indicates economic expansion",
        relevance: "growth pattern",
        why: "Employment outpacing population indicates economic expansion. This pattern is typically associated with growing logistics and supply chain activity.",
      },
      low: {
        text: "Growing labour pool in catchment",
        relevance: "workforce trends",
        why: "Population outpacing employment indicates a growing potential workforce over time.",
      },
      neutral: {
        text: "Steady growth fundamentals",
        relevance: "growth pattern",
        why: "Balanced growth suggests stable supply-demand dynamics over time.",
      },
    },
    residential: {
      high: {
        text: "Job creation may attract in-migration",
        relevance: "demographic trends",
        why: "Employment outpacing population suggests economic opportunity that may attract residents over time. Areas with strong job growth tend to experience in-migration.",
      },
      low: {
        text: "Population growth outpacing job creation",
        relevance: "demographic trends",
        why: "Population outpacing employment indicates residential expansion driven by factors beyond employment proximity - such as lifestyle, affordability, or demographic trends.",
      },
      neutral: {
        text: "Consistent demographic trajectory",
        relevance: "demographic trends",
        why: "Population and employment are growing together, suggesting stable demographic patterns.",
      },
    },
    leisure: {
      high: {
        text: "Growing workforce in catchment",
        relevance: "catchment trends",
        why: "Employment outpacing population suggests a growing worker population over time. This pattern is associated with increasing weekday leisure activity.",
      },
      low: {
        text: "Expanding residential base in catchment",
        relevance: "catchment trends",
        why: "Population outpacing employment suggests a growing residential catchment. This pattern is associated with increasing evening and weekend leisure activity.",
      },
      neutral: {
        text: "Stable growth trajectory",
        relevance: "growth pattern",
        why: "Balanced population and employment growth suggests stable catchment composition over time.",
      },
    },
    mixed: {
      high: {
        text: "Employment-led growth pattern",
        relevance: "growth pattern",
        why: "Employment outpacing population suggests growing commercial activity over time. This pattern is associated with increasing worker footfall.",
      },
      low: {
        text: "Population-led growth pattern",
        relevance: "growth pattern",
        why: "Population outpacing employment suggests growing residential catchment over time. This pattern is associated with residential-focused activity.",
      },
      neutral: {
        text: "Balanced growth pattern",
        relevance: "growth pattern",
        why: "Population and employment are growing together, suggesting stable mixed-use dynamics.",
      },
    },
    general: {
      high: {
        text: "Employment growth outpacing population growth",
        relevance: "growth composition",
        why: "Jobs are growing faster than the resident population. This indicates increasing economic activity and likely growing commuter inflow over time.",
      },
      low: {
        text: "Population growth outpacing employment growth",
        relevance: "growth composition",
        why: "Population is growing faster than jobs. This indicates residential expansion that may be outpacing local economic activity.",
      },
      neutral: {
        text: "Growth balanced across population and employment",
        relevance: "growth balance",
        why: "Population and employment are growing at similar rates. The economic character of the location is stable over time.",
      },
    },
  },
}

// =============================================================================
// Asset Lens Resolver
// =============================================================================

/**
 * Resolves the appropriate interpretation lens based on asset metadata.
 * Handles compound types like "Prime Office and Retail" by matching first keyword.
 * Always returns a valid lens (never null).
 */
export function resolveAssetLens(
  assetClass: string | null,
  assetType: string | null,
  tenantSector: TenantSector | null
): AssetLens {
  // Priority 1: Explicit tenant sector (if not "other")
  if (tenantSector && tenantSector !== "other") {
    return SECTOR_TO_LENS[tenantSector]
  }
  
  // Priority 2: Infer from asset type/class string
  const type = (assetType || assetClass || "").toLowerCase()
  
  // Compound types: "Prime Office and Retail" -> use first match in priority order
  // Office first (typically higher value/more specific)
  if (type.includes("office")) return "office"
  
  // Industrial/logistics (specific use case)
  if (type.includes("industrial") || type.includes("logistics") || type.includes("warehouse") || type.includes("distribution")) {
    return "industrial"
  }
  
  // Retail and F&B (footfall-driven)
  if (type.includes("retail") || type.includes("shop") || type.includes("high street")) return "retail"
  if (type.includes("f&b") || type.includes("food") || type.includes("restaurant") || type.includes("cafe") || type.includes("hospitality")) {
    return "retail"
  }
  
  // Residential variants
  if (type.includes("resi") || type.includes("btl") || type.includes("pbsa") || type.includes("student") || type.includes("apartment") || type.includes("housing")) {
    return "residential"
  }
  
  // Leisure
  if (type.includes("leisure") || type.includes("gym") || type.includes("hotel") || type.includes("cinema") || type.includes("entertainment")) {
    return "leisure"
  }
  
  // Mixed use
  if (type.includes("mixed")) return "mixed"
  
  // Default: general lens (always has interpretations)
  return "general"
}
