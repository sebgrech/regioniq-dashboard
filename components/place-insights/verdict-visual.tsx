"use client"

import { cn } from "@/lib/utils"

type VerdictVisualType = "boundary" | "outputVsJobs" | "workforceSlack" | "weekdayPull"

interface VerdictVisualProps {
  type: VerdictVisualType
  payload?: { outcome?: string }
  className?: string
}

/**
 * VerdictVisual - Research-grade animated glyphs for place character
 * 
 * Design principles:
 * 1. ONE animation per glyph - no competing motion
 * 2. Motion = direction or tension, not decoration
 * 3. Default state is calm - "this place slowly does what it always does"
 * 4. Reads in <200ms without labels
 */
export function VerdictVisual({ type, payload, className }: VerdictVisualProps) {
  const isHigh = payload?.outcome === "high"
  const isLow = payload?.outcome === "low"
  
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      {type === "boundary" && <BoundaryGlyph isHigh={isHigh} />}
      {type === "outputVsJobs" && <OutputVsJobsGlyph isHigh={isHigh} />}
      {type === "workforceSlack" && <WorkforceSlackGlyph isLow={isLow} />}
      {type === "weekdayPull" && <WeekdayPullGlyph isHigh={isHigh} />}
    </div>
  )
}

/**
 * Income Capture: Pressure equilibrium
 * 
 * Metaphor: Income isn't "in or out" — it's whether spend pressure resolves locally or leaks.
 * 
 * Animation:
 * - High (captured): Inner mass slowly expands + contracts (pressure retained)
 * - Low (leaks): Outer ring gently pulses outward (pressure escaping)
 * 
 * Ultra-subtle 2.5s loop, radial breathing only
 */
function BoundaryGlyph({ isHigh }: { isHigh: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
        {/* Outer boundary - stable or breathing outward */}
        <circle 
          cx="36" cy="36" 
          r="24" 
          fill="none" 
          strokeWidth="2"
          className="stroke-primary/30"
        >
          {/* Low state: outer ring breathes outward (leakage) */}
          {!isHigh && (
            <animate
              attributeName="r"
              values="24;27;24"
              dur="2.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          )}
        </circle>
        
        {/* Inner mass - the "pressure" */}
        <circle 
          cx="36" cy="36" 
          className={cn(
            isHigh ? "fill-primary" : "fill-primary/20"
          )}
        >
          {isHigh ? (
            /* High state: inner mass expands/contracts (pressure retained locally) */
            <animate
              attributeName="r"
              values="12;15;12"
              dur="2.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          ) : (
            /* Low state: inner core stays small and stable */
            <animate
              attributeName="r"
              values="8;8;8"
              dur="2.5s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        
        {/* Subtle opacity pulse for the active element */}
        {isHigh ? (
          <circle cx="36" cy="36" r="12" className="fill-primary">
            <animate
              attributeName="opacity"
              values="0.8;1;0.8"
              dur="2.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
            />
            <animate
              attributeName="r"
              values="12;15;12"
              dur="2.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
            />
          </circle>
        ) : (
          /* Leakage indicator - faint expanding ring */
          <circle 
            cx="36" cy="36" 
            r="24" 
            fill="none" 
            strokeWidth="1"
            className="stroke-primary/20"
          >
            <animate
              attributeName="r"
              values="24;30;24"
              dur="2.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
            />
            <animate
              attributeName="opacity"
              values="0.3;0;0.3"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>
      
      {/* Research-style descriptive caption */}
      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/20">
        {isHigh ? "Local retention dominant" : "Leakage to neighbouring centres"}
      </span>
    </div>
  )
}

/**
 * Productivity: Decoupling visual
 * 
 * Metaphor: Productivity strength = output growth decoupling from job growth
 * 
 * Visual: Two vertical stems connected by a thin line. Distance = signal.
 * 
 * Animation:
 * - High productivity: Output stem rises, connector stretches
 * - Low productivity: Jobs stem rises, connector stretches other way
 * 
 * Only ONE stem animates; other remains static
 */
function OutputVsJobsGlyph({ isHigh }: { isHigh: boolean }) {
  // Base positions
  const stemWidth = 8
  const outputX = 22
  const jobsX = 50
  const baseY = 48
  const baseHeight = 20
  const extendedHeight = 36
  
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="64" viewBox="0 0 72 64" className="flex-shrink-0">
        {/* Output stem (left) - animates if high */}
        <rect 
          x={outputX - stemWidth/2} 
          width={stemWidth}
          rx="2"
          className={cn(
            isHigh ? "fill-primary" : "fill-primary/30"
          )}
        >
          <animate
            attributeName="y"
            values={isHigh ? `${baseY - baseHeight};${baseY - extendedHeight};${baseY - baseHeight}` : `${baseY - baseHeight};${baseY - baseHeight};${baseY - baseHeight}`}
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
          <animate
            attributeName="height"
            values={isHigh ? `${baseHeight};${extendedHeight};${baseHeight}` : `${baseHeight};${baseHeight};${baseHeight}`}
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
        </rect>
        
        {/* Jobs stem (right) - animates if low */}
        <rect 
          x={jobsX - stemWidth/2} 
          width={stemWidth}
          rx="2"
          className={cn(
            !isHigh ? "fill-primary" : "fill-primary/30"
          )}
        >
          <animate
            attributeName="y"
            values={!isHigh ? `${baseY - baseHeight};${baseY - extendedHeight};${baseY - baseHeight}` : `${baseY - baseHeight};${baseY - baseHeight};${baseY - baseHeight}`}
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
          <animate
            attributeName="height"
            values={!isHigh ? `${baseHeight};${extendedHeight};${baseHeight}` : `${baseHeight};${baseHeight};${baseHeight}`}
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
        </rect>
        
        {/* Connector line - stretches to show decoupling */}
        <line 
          x1={outputX} 
          x2={jobsX}
          strokeWidth="2"
          strokeDasharray="4 2"
          className="stroke-primary/40"
        >
          <animate
            attributeName="y1"
            values={isHigh 
              ? `${baseY - baseHeight};${baseY - extendedHeight};${baseY - baseHeight}` 
              : `${baseY - baseHeight};${baseY - baseHeight};${baseY - baseHeight}`
            }
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
          <animate
            attributeName="y2"
            values={!isHigh 
              ? `${baseY - baseHeight};${baseY - extendedHeight};${baseY - baseHeight}` 
              : `${baseY - baseHeight};${baseY - baseHeight};${baseY - baseHeight}`
            }
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
        </line>
        
        {/* Labels */}
        <text x={outputX} y="58" textAnchor="middle" className="fill-muted-foreground text-[8px] font-medium">
          GVA
        </text>
        <text x={jobsX} y="58" textAnchor="middle" className="fill-muted-foreground text-[8px] font-medium">
          Jobs
        </text>
      </svg>
      
      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/20">
        {isHigh ? "Output growth leads" : "Jobs growth leads"}
      </span>
    </div>
  )
}

/**
 * Labour Capacity: Elastic tension
 * 
 * Metaphor: Labour markets tighten like elastic — once stretched, they resist further pull.
 * 
 * Visual: Three horizontal bands that compress/expand under tension
 * 
 * Animation:
 * - High (tight): Bands compress inward (scaleX) with opacity pulse
 * - Low (slack): Bands at rest, subtle breathing
 */
function WorkforceSlackGlyph({ isLow }: { isLow: boolean }) {
  const hasCapacity = isLow
  const bandY = [12, 26, 40]
  
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="72" height="56" viewBox="0 0 72 56" className="flex-shrink-0">
        {bandY.map((y, i) => {
          const delay = i * 0.3
          
          return (
            <g key={i}>
              {/* Band background */}
              <rect
                x="10"
                y={y}
                width="52"
                height="10"
                rx="5"
                className="fill-primary/10"
              />
              
              {/* Active band */}
              <rect
                x="10"
                y={y}
                width="52"
                height="10"
                rx="5"
                className={cn(
                  hasCapacity ? "fill-primary/30" : "fill-primary/70"
                )}
              >
                {hasCapacity ? (
                  /* Slack: subtle opacity breathing */
                  <animate
                    attributeName="opacity"
                    values="0.3;0.45;0.3"
                    dur="3s"
                    begin={`${delay}s`}
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                  />
                ) : (
                  /* Tight: compress horizontally (tension effect) */
                  <>
                    <animate
                      attributeName="x"
                      values="10;14;10"
                      dur="2.5s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                      calcMode="spline"
                      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                    />
                    <animate
                      attributeName="width"
                      values="52;44;52"
                      dur="2.5s"
                      begin={`${delay}s`}
                      repeatCount="indefinite"
                      calcMode="spline"
                      keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                    />
                  </>
                )}
              </rect>
              
              {/* Tension indicator - center compression line for tight state */}
              {!hasCapacity && (
                <line
                  x1="36"
                  y1={y + 2}
                  x2="36"
                  y2={y + 8}
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="stroke-white/50"
                >
                  <animate
                    attributeName="opacity"
                    values="0;0.6;0"
                    dur="2.5s"
                    begin={`${delay}s`}
                    repeatCount="indefinite"
                  />
                </line>
              )}
            </g>
          )
        })}
      </svg>
      
      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/20">
        {hasCapacity ? "Labour capacity available" : "Labour market tight"}
      </span>
    </div>
  )
}

/**
 * Employment Density / Weekday Pull: Directional flow
 * 
 * Metaphor: Where workers go during the day
 * 
 * Visual: Central hub (house or office) with particles flowing in one direction
 * 
 * Animation:
 * - High (jobs draw in): particles flow FROM outer markers INTO the office (center)
 * - Low (workers export): particles flow FROM the house (center) TO outer markers
 * 
 * Particles connect hub ↔ markers directly (no gap)
 */
function WeekdayPullGlyph({ isHigh }: { isHigh: boolean }) {
  // 4 lanes, single particle each
  const lanes = [
    { angle: 45, delay: 0 },
    { angle: 135, delay: 0.5 },
    { angle: 225, delay: 1.0 },
    { angle: 315, delay: 1.5 },
  ]
  
  const cx = 40
  const cy = 40
  const outerR = 32  // Position of outer markers
  const duration = 2.2
  
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="80" height="80" viewBox="0 0 80 80" className="flex-shrink-0">
        {/* Outer markers - where particles start (high) or end (low) */}
        {lanes.map(({ angle }, i) => {
          const rad = (angle * Math.PI) / 180
          const x = cx + Math.cos(rad) * outerR
          const y = cy + Math.sin(rad) * outerR
          return (
            <circle
              key={`marker-${i}`}
              cx={x}
              cy={y}
              r="6"
              className={cn(
                isHigh 
                  ? "fill-primary/10 stroke-primary/20" // Origin markers (faint)
                  : "fill-primary/20 stroke-primary/30" // Destination markers (slightly stronger)
              )}
              strokeWidth="1.5"
            />
          )
        })}
        
        {/* Animated particles - travel between hub edge and outer markers */}
        {lanes.map(({ angle, delay }) => {
          const rad = (angle * Math.PI) / 180
          const outerX = cx + Math.cos(rad) * outerR
          const outerY = cy + Math.sin(rad) * outerR
          // Stop at hub edge (r=14), not center - so particles don't overlap hub
          const hubEdgeR = 16
          const innerX = cx + Math.cos(rad) * hubEdgeR
          const innerY = cy + Math.sin(rad) * hubEdgeR
          
          // Particles travel between hub edge and outer markers
          const fromX = isHigh ? outerX : innerX
          const fromY = isHigh ? outerY : innerY
          const toX = isHigh ? innerX : outerX
          const toY = isHigh ? innerY : outerY
          
          return (
            <circle
              key={`particle-${angle}`}
              r="4"
              className="fill-primary"
            >
              <animate
                attributeName="cx"
                values={`${fromX};${toX}`}
                dur={`${duration}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
                calcMode="spline"
                keySplines="0.4 0 0.2 1"
              />
              <animate
                attributeName="cy"
                values={`${fromY};${toY}`}
                dur={`${duration}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
                calcMode="spline"
                keySplines="0.4 0 0.2 1"
              />
              {/* Fade: appear at origin, solid during travel, fade at destination */}
              <animate
                attributeName="opacity"
                values="0;0.9;0.9;0"
                keyTimes="0;0.1;0.85;1"
                dur={`${duration}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
              />
              {/* Shrink as it reaches destination */}
              <animate
                attributeName="r"
                values={isHigh ? "4;4;2" : "2;4;4"}
                keyTimes="0;0.7;1"
                dur={`${duration}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
              />
            </circle>
          )
        })}
        
        {/* Center hub - drawn AFTER particles so hub is on top */}
        <circle 
          cx={cx} cy={cy} 
          r="14"
          className={cn(
            isHigh ? "fill-primary" : "fill-primary/15 stroke-primary/40"
          )}
          strokeWidth={isHigh ? 0 : 2}
        />
        
        {/* Hub icon - on top of everything */}
        {isHigh ? (
          /* Office building */
          <g>
            <rect x="33" y="32" width="14" height="16" rx="1" className="fill-white" />
            <rect x="35" y="34" width="3" height="3" className="fill-primary" />
            <rect x="42" y="34" width="3" height="3" className="fill-primary" />
            <rect x="35" y="39" width="3" height="3" className="fill-primary" />
            <rect x="42" y="39" width="3" height="3" className="fill-primary" />
            <rect x="38" y="44" width="4" height="4" className="fill-primary" />
          </g>
        ) : (
          /* House - light purple tint with white door */
          <g>
            <path d="M40 30 L50 38 L50 48 L30 48 L30 38 Z" className="fill-primary/40" />
            <path d="M40 28 L52 38 L50 38 L40 30 L30 38 L28 38 Z" className="fill-primary/50" />
            <rect x="37" y="42" width="6" height="6" className="fill-white" />
          </g>
        )}
      </svg>
      
      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary dark:bg-primary/20">
        {isHigh ? "Employment destination" : "Residential catchment"}
      </span>
    </div>
  )
}
