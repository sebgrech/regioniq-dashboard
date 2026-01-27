"use client"

import { VerdictVisual } from "./verdict-visual"

/**
 * Prototype component to preview all verdict visual states
 * Access at: /prototype/visuals
 * 
 * Design principles applied:
 * 1. ONE animation per glyph - no competing motion
 * 2. Motion = direction or tension, not decoration
 * 3. Default state is calm - "this place slowly does what it always does"
 * 4. Reads in <200ms without labels
 */
export function VerdictVisualPrototype() {
  const visuals = [
    { 
      type: "boundary" as const, 
      label: "Income Capture", 
      signal: "income_capture",
      metaphor: "Pressure equilibrium - spend pressure resolves locally or leaks",
      animation: "Radial breathing: inner mass expands (captured) vs outer ring pulses (leaks)"
    },
    { 
      type: "outputVsJobs" as const, 
      label: "Productivity", 
      signal: "productivity_strength",
      metaphor: "Decoupling - output growth separating from job growth",
      animation: "One stem rises, connector stretches to show divergence"
    },
    { 
      type: "workforceSlack" as const, 
      label: "Labour Capacity", 
      signal: "labour_capacity",
      metaphor: "Elastic tension - labour markets tighten like elastic",
      animation: "Bands bow inward + micro vibration (tight) vs relaxed straight (slack)"
    },
    { 
      type: "weekdayPull" as const, 
      label: "Employment Density", 
      signal: "employment_density",
      metaphor: "Directional flow - where workers go during the day",
      animation: "4 particles flow inward to office or outward from house"
    },
  ]

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Verdict Visual Prototypes</h1>
        <p className="text-muted-foreground mb-4">
          Research-grade animated glyphs for place character
        </p>
        
        {/* Design principles */}
        <div className="mb-8 p-4 rounded-lg bg-muted/30 border text-sm">
          <h3 className="font-semibold mb-2">Global Animation Rules</h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>1. <strong>One animation per glyph</strong> — no competing motion inside a single visual</li>
            <li>2. <strong>Motion = direction or tension</strong> — if it doesn&apos;t encode meaning, remove it</li>
            <li>3. <strong>Default state is calm</strong> — &quot;this place is slowly doing what it always does&quot;</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {visuals.map(({ type, label, signal, metaphor, animation }) => (
            <div key={type} className="space-y-4 p-4 rounded-xl border bg-card">
              <div className="border-b pb-3">
                <h2 className="font-semibold text-lg">{label}</h2>
                <p className="text-xs text-muted-foreground font-mono mb-2">{signal}</p>
                <p className="text-xs text-muted-foreground italic">{metaphor}</p>
                <p className="text-xs text-primary/70 mt-1">{animation}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {/* High state */}
                <div className="flex flex-col items-center p-4 rounded-xl bg-muted/20">
                  <span className="text-xs text-muted-foreground mb-3 font-medium">
                    {type === "workforceSlack" ? "high (tight)" : "high"}
                  </span>
                  <VerdictVisual 
                    type={type} 
                    payload={{ outcome: "high" }} 
                  />
                </div>
                
                {/* Low state */}
                <div className="flex flex-col items-center p-4 rounded-xl bg-muted/20">
                  <span className="text-xs text-muted-foreground mb-3 font-medium">
                    {type === "workforceSlack" ? "low (slack)" : "low"}
                  </span>
                  <VerdictVisual 
                    type={type} 
                    payload={{ outcome: "low" }} 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Signal to Visual Mapping Reference */}
        <div className="mt-8 p-6 rounded-xl bg-muted/30 border">
          <h3 className="font-semibold mb-4">Label Language</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Research-style descriptive captions, not verdicts. Reads like analysis, not recommendations.
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-mono text-xs text-muted-foreground">income_capture</span>
              <p className="text-primary">&quot;Local retention dominant&quot; / &quot;Leakage to neighbouring centres&quot;</p>
            </div>
            <div>
              <span className="font-mono text-xs text-muted-foreground">productivity_strength</span>
              <p className="text-primary">&quot;Output growth leads&quot; / &quot;Jobs growth leads&quot;</p>
            </div>
            <div>
              <span className="font-mono text-xs text-muted-foreground">labour_capacity</span>
              <p className="text-primary">&quot;Labour capacity available&quot; / &quot;Labour market tight&quot;</p>
            </div>
            <div>
              <span className="font-mono text-xs text-muted-foreground">employment_density</span>
              <p className="text-primary">&quot;Employment destination&quot; / &quot;Residential catchment&quot;</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
