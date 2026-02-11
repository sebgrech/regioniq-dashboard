"use client"

import { VerdictVisual } from "./verdict-visual"
import { cn } from "@/lib/utils"
import {
  // Navigation & UI
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowUpDown,
  ChevronDown, ChevronRight, ChevronLeft,
  X, Check, Copy, ExternalLink, Link2,
  Search, ZoomIn, ZoomOut, RotateCcw,
  Settings2, Key, LogOut, User,
  
  // Status & Feedback
  Loader2, AlertCircle, AlertTriangle, RefreshCw,
  Sparkles, Zap, Trophy, Activity,
  TrendingUp, TrendingDown, Minus,
  
  // Content & Data
  FileText, FileSpreadsheet, Database, Code2, Terminal,
  Download, Send, Wand2, MessageSquare,
  Info, Layers, Target,
  
  // Location & Map
  MapPin, Map, MapPinned, Circle, Pentagon, Trash2, Pencil,
  Sun, Moon, Satellite, Clock, Calendar,
  
  // Building & Commerce
  Building2, Briefcase, Home, Warehouse,
  ShoppingBag, UtensilsCrossed, Dumbbell,
  Banknote, Ruler, BarChart3,
  GitCompareArrows, LayoutGrid, List,
} from "lucide-react"
import { FadeUp, Stagger, StaggerGrid, ContentReveal, LoadingOverlay, ScaleOnHover } from "@/components/ui/animate"

/**
 * Design System Prototype - Internal Reference
 * Access at: /prototype/visuals
 * 
 * Complete one-pager with:
 * - All Lucide icons used across the project
 * - Animation components and CSS animations
 * - Color palette (light/dark)
 * - Motion system tokens
 * - Typography scales
 */

// Icon item type
type IconItem = {
  icon: React.ComponentType<{ className?: string }>
  name: string
  spin?: boolean
}

// Icon categories for organized display
const ICON_CATEGORIES: Record<string, IconItem[]> = {
  "Navigation & UI": [
    { icon: ArrowLeft, name: "ArrowLeft" },
    { icon: ArrowRight, name: "ArrowRight" },
    { icon: ArrowUp, name: "ArrowUp" },
    { icon: ArrowDown, name: "ArrowDown" },
    { icon: ArrowUpDown, name: "ArrowUpDown" },
    { icon: ChevronDown, name: "ChevronDown" },
    { icon: ChevronRight, name: "ChevronRight" },
    { icon: ChevronLeft, name: "ChevronLeft" },
    { icon: X, name: "X" },
    { icon: Check, name: "Check" },
    { icon: Copy, name: "Copy" },
    { icon: ExternalLink, name: "ExternalLink" },
    { icon: Link2, name: "Link2" },
    { icon: Search, name: "Search" },
    { icon: ZoomIn, name: "ZoomIn" },
    { icon: ZoomOut, name: "ZoomOut" },
    { icon: RotateCcw, name: "RotateCcw" },
    { icon: Settings2, name: "Settings2" },
    { icon: Key, name: "Key" },
    { icon: LogOut, name: "LogOut" },
    { icon: User, name: "User" },
  ],
  "Status & Feedback": [
    { icon: Loader2, name: "Loader2", spin: true },
    { icon: AlertCircle, name: "AlertCircle" },
    { icon: AlertTriangle, name: "AlertTriangle" },
    { icon: RefreshCw, name: "RefreshCw" },
    { icon: Sparkles, name: "Sparkles" },
    { icon: Zap, name: "Zap" },
    { icon: Trophy, name: "Trophy" },
    { icon: Activity, name: "Activity" },
    { icon: TrendingUp, name: "TrendingUp" },
    { icon: TrendingDown, name: "TrendingDown" },
    { icon: Minus, name: "Minus" },
  ],
  "Content & Data": [
    { icon: FileText, name: "FileText" },
    { icon: FileSpreadsheet, name: "FileSpreadsheet" },
    { icon: Database, name: "Database" },
    { icon: Code2, name: "Code2" },
    { icon: Terminal, name: "Terminal" },
    { icon: Download, name: "Download" },
    { icon: Send, name: "Send" },
    { icon: Wand2, name: "Wand2" },
    { icon: MessageSquare, name: "MessageSquare" },
    { icon: Info, name: "Info" },
    { icon: Layers, name: "Layers" },
    { icon: Target, name: "Target" },
    { icon: LayoutGrid, name: "LayoutGrid" },
    { icon: List, name: "List" },
  ],
  "Location & Map": [
    { icon: MapPin, name: "MapPin" },
    { icon: Map, name: "Map" },
    { icon: MapPinned, name: "MapPinned" },
    { icon: Circle, name: "Circle" },
    { icon: Pentagon, name: "Pentagon" },
    { icon: Trash2, name: "Trash2" },
    { icon: Pencil, name: "Pencil" },
    { icon: Sun, name: "Sun" },
    { icon: Moon, name: "Moon" },
    { icon: Satellite, name: "Satellite" },
    { icon: Clock, name: "Clock" },
    { icon: Calendar, name: "Calendar" },
  ],
  "Building & Commerce": [
    { icon: Building2, name: "Building2" },
    { icon: Briefcase, name: "Briefcase" },
    { icon: Home, name: "Home" },
    { icon: Warehouse, name: "Warehouse" },
    { icon: ShoppingBag, name: "ShoppingBag" },
    { icon: UtensilsCrossed, name: "UtensilsCrossed" },
    { icon: Dumbbell, name: "Dumbbell" },
    { icon: Banknote, name: "Banknote" },
    { icon: Ruler, name: "Ruler" },
    { icon: BarChart3, name: "BarChart3" },
    { icon: GitCompareArrows, name: "GitCompareArrows" },
  ],
}

// Color palette
const COLORS = {
  "Core UI": [
    { name: "primary", class: "bg-primary", text: "text-primary-foreground", label: "Primary (Deep Purple)" },
    { name: "secondary", class: "bg-secondary", text: "text-secondary-foreground", label: "Secondary (Lavender)" },
    { name: "accent", class: "bg-accent", text: "text-accent-foreground", label: "Accent (Light Purple)" },
    { name: "muted", class: "bg-muted", text: "text-muted-foreground", label: "Muted" },
    { name: "destructive", class: "bg-destructive", text: "text-destructive-foreground", label: "Destructive (Red)" },
  ],
  "Backgrounds": [
    { name: "background", class: "bg-background border", text: "text-foreground", label: "Background" },
    { name: "card", class: "bg-card border", text: "text-card-foreground", label: "Card" },
    { name: "popover", class: "bg-popover border", text: "text-popover-foreground", label: "Popover" },
  ],
  "Chart Colors": [
    { name: "chart-1", class: "bg-chart-1", text: "text-white", label: "Chart 1 (Orange)" },
    { name: "chart-2", class: "bg-chart-2", text: "text-white", label: "Chart 2 (Blue)" },
    { name: "chart-3", class: "bg-chart-3", text: "text-white", label: "Chart 3" },
    { name: "chart-4", class: "bg-chart-4", text: "text-white", label: "Chart 4 (Amber)" },
    { name: "chart-5", class: "bg-chart-5", text: "text-white", label: "Chart 5 (Red)" },
  ],
  "Semantic Colors": [
    { name: "emerald", class: "bg-emerald-500", text: "text-white", label: "Success / Positive" },
    { name: "amber", class: "bg-amber-500", text: "text-white", label: "Warning / Caution" },
    { name: "cyan", class: "bg-cyan-500", text: "text-white", label: "Info / Highlight" },
    { name: "purple", class: "bg-purple-500", text: "text-white", label: "Feature / Special" },
  ],
}

// Motion tokens
const MOTION_TOKENS = {
  "Durations": [
    { name: "--duration-instant", value: "50ms", desc: "Immediate feedback" },
    { name: "--duration-fast", value: "150ms", desc: "Quick interactions" },
    { name: "--duration-base", value: "250ms", desc: "Standard transitions" },
    { name: "--duration-slow", value: "400ms", desc: "Complex animations" },
    { name: "--duration-slower", value: "600ms", desc: "Page transitions" },
  ],
  "Easing Curves": [
    { name: "--ease-out-expo", value: "cubic-bezier(0.16, 1, 0.3, 1)", desc: "Primary - snappy, responsive" },
    { name: "--ease-out-cubic", value: "cubic-bezier(0.33, 1, 0.68, 1)", desc: "Softer deceleration" },
    { name: "--ease-in-out", value: "cubic-bezier(0.65, 0, 0.35, 1)", desc: "Symmetric, for toggles" },
    { name: "--ease-spring", value: "cubic-bezier(0.34, 1.56, 0.64, 1)", desc: "Bouncy, for delight" },
    { name: "--ease-bounce", value: "cubic-bezier(0.34, 1.3, 0.64, 1)", desc: "Subtle bounce" },
  ],
}

// CSS Animation classes
const CSS_ANIMATIONS = [
  { name: "animate-fade-up", desc: "Primary entrance - fade + translate up" },
  { name: "animate-fade-in-scale", desc: "Modal/popover entrance" },
  { name: "animate-slide-in-up", desc: "Toast/drawer entrance from bottom" },
  { name: "animate-content-reveal", desc: "Skeleton to content crossfade" },
  { name: "animate-shake", desc: "Error feedback" },
  { name: "animate-success", desc: "Success pop effect" },
  { name: "skeleton-wave", desc: "Premium shimmer loading" },
  { name: "skeleton-pulse", desc: "Subtle opacity pulse" },
  { name: "interactive-lift", desc: "Card hover - lift + shadow" },
  { name: "interactive-scale", desc: "Button hover - scale" },
  { name: "interactive-glow", desc: "Border glow on hover" },
  { name: "btn-press", desc: "Stripe-style button feedback" },
]

// Verdict visuals for glyphs section
const VERDICT_VISUALS = [
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
    label: "Labour Availability", 
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

export function VerdictVisualPrototype() {
  return (
    <div className="p-8 space-y-12 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-6 border-b">
          <h1 className="text-3xl font-bold mb-2">RegionIQ Design System</h1>
          <p className="text-muted-foreground text-lg">
            Internal reference for icons, animations, colors, and motion primitives
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════
            SECTION 1: ICONS
            ═══════════════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Icons (Lucide React)
          </h2>
          <p className="text-muted-foreground mb-6">
            All icons used across the project, organized by category. Import from <code className="px-1.5 py-0.5 bg-muted rounded text-sm">lucide-react</code>.
          </p>

          <div className="space-y-8">
            {Object.entries(ICON_CATEGORIES).map(([category, icons]) => (
              <div key={category}>
                <h3 className="text-lg font-medium mb-3 text-muted-foreground">{category}</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {icons.map(({ icon: Icon, name, spin }) => (
                    <div
                      key={name}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                    >
                      <Icon className={cn("h-5 w-5 text-foreground", spin && "animate-spin")} />
                      <span className="text-[10px] text-muted-foreground group-hover:text-foreground text-center leading-tight">
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════
            SECTION 2: COLORS
            ═══════════════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-accent" />
            Color Palette
          </h2>
          <p className="text-muted-foreground mb-6">
            Theme-aware colors using CSS variables. All colors adapt to light/dark mode automatically.
          </p>

          <div className="space-y-8">
            {Object.entries(COLORS).map(([category, colors]) => (
              <div key={category}>
                <h3 className="text-lg font-medium mb-3 text-muted-foreground">{category}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {colors.map(({ name, class: bgClass, text, label }) => (
                    <div key={name} className="flex flex-col">
                      <div className={cn("h-16 rounded-t-lg flex items-center justify-center", bgClass)}>
                        <span className={cn("text-xs font-medium", text)}>{label}</span>
                      </div>
                      <div className="bg-card border border-t-0 rounded-b-lg p-2">
                        <code className="text-xs text-muted-foreground">{name}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Opacity variants */}
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-3 text-muted-foreground">Opacity Variants</h3>
            <div className="flex flex-wrap gap-2">
              {[10, 15, 20, 30, 40, 50, 60, 70, 80].map((opacity) => (
                <div key={opacity} className="flex flex-col items-center">
                  <div 
                    className={`w-12 h-12 rounded-lg bg-primary/${opacity}`}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1">/{opacity}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════
            SECTION 3: MOTION SYSTEM
            ═══════════════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Motion System
          </h2>
          <p className="text-muted-foreground mb-6">
            Linear/Stripe-grade animation tokens for consistent, polished motion across the UI.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(MOTION_TOKENS).map(([category, tokens]) => (
              <div key={category} className="rounded-xl border bg-card p-4">
                <h3 className="font-medium mb-3">{category}</h3>
                <div className="space-y-2">
                  {tokens.map(({ name, value, desc }) => (
                    <div key={name} className="flex items-start gap-3 text-sm">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                        {value}
                      </code>
                      <div>
                        <span className="font-medium text-foreground">{name}</span>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════
            SECTION 4: CSS ANIMATIONS
            ═══════════════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            CSS Animation Classes
          </h2>
          <p className="text-muted-foreground mb-6">
            Ready-to-use animation classes defined in <code className="px-1.5 py-0.5 bg-muted rounded text-sm">globals.css</code>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CSS_ANIMATIONS.map(({ name, desc }) => (
              <div key={name} className="rounded-lg border bg-card p-3">
                <code className="text-sm font-medium text-primary">.{name}</code>
                <p className="text-xs text-muted-foreground mt-1">{desc}</p>
              </div>
            ))}
          </div>

          {/* Live animation demos */}
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Live Demos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Fade Up */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h4 className="text-sm font-medium">Fade Up</h4>
                <FadeUp delay={0}>
                  <div className="h-12 rounded-lg bg-primary/20 flex items-center justify-center text-xs">
                    FadeUp Component
                  </div>
                </FadeUp>
              </div>

              {/* Skeleton Wave */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h4 className="text-sm font-medium">Skeleton Wave</h4>
                <div className="h-12 rounded-lg skeleton-wave" />
              </div>

              {/* Interactive Lift */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h4 className="text-sm font-medium">Interactive Lift</h4>
                <div className="h-12 rounded-lg bg-primary/20 interactive-lift flex items-center justify-center text-xs cursor-pointer">
                  Hover me
                </div>
              </div>

              {/* Loading Overlay */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h4 className="text-sm font-medium">Loading Overlay</h4>
                <LoadingOverlay isLoading={true} showSpinner>
                  <div className="h-12 rounded-lg bg-primary/20 flex items-center justify-center text-xs">
                    Content dimmed
                  </div>
                </LoadingOverlay>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════
            SECTION 5: ANIMATION COMPONENTS
            ═══════════════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            Animation Components
          </h2>
          <p className="text-muted-foreground mb-6">
            React components from <code className="px-1.5 py-0.5 bg-muted rounded text-sm">@/components/ui/animate</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-medium mb-2">FadeUp</h3>
              <p className="text-xs text-muted-foreground mb-3">Primary entrance animation with customizable delay and duration.</p>
              <code className="text-xs bg-muted p-2 rounded block">
                {`<FadeUp delay={100} duration="base">...</FadeUp>`}
              </code>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-medium mb-2">Stagger</h3>
              <p className="text-xs text-muted-foreground mb-3">Auto-staggers children with fade-up animation.</p>
              <code className="text-xs bg-muted p-2 rounded block">
                {`<Stagger interval={30}>...</Stagger>`}
              </code>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-medium mb-2">StaggerGrid</h3>
              <p className="text-xs text-muted-foreground mb-3">Grid layout with staggered children.</p>
              <code className="text-xs bg-muted p-2 rounded block">
                {`<StaggerGrid columns={4} gap="md">...</StaggerGrid>`}
              </code>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-medium mb-2">ContentReveal</h3>
              <p className="text-xs text-muted-foreground mb-3">Crossfade from skeleton to content.</p>
              <code className="text-xs bg-muted p-2 rounded block">
                {`<ContentReveal isLoading={false}>...</ContentReveal>`}
              </code>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-medium mb-2">LoadingOverlay</h3>
              <p className="text-xs text-muted-foreground mb-3">Dims content while loading (optimistic UI).</p>
              <code className="text-xs bg-muted p-2 rounded block">
                {`<LoadingOverlay isLoading showSpinner>...</LoadingOverlay>`}
              </code>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-medium mb-2">ScaleOnHover</h3>
              <p className="text-xs text-muted-foreground mb-3">Simple scale effect wrapper.</p>
              <code className="text-xs bg-muted p-2 rounded block">
                {`<ScaleOnHover scale={1.02}>...</ScaleOnHover>`}
              </code>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════
            SECTION 6: VERDICT GLYPHS
            ═══════════════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Verdict Visual Glyphs
          </h2>
          <p className="text-muted-foreground mb-4">
            Research-grade animated glyphs for place character. Each encodes economic signals through motion.
          </p>
          
          {/* Design principles */}
          <div className="mb-6 p-4 rounded-lg bg-muted/30 border text-sm">
            <h3 className="font-semibold mb-2">Animation Rules</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>1. <strong>One animation per glyph</strong> — no competing motion inside a single visual</li>
              <li>2. <strong>Motion = direction or tension</strong> — if it doesn&apos;t encode meaning, remove it</li>
              <li>3. <strong>Default state is calm</strong> — &quot;this place is slowly doing what it always does&quot;</li>
              <li>4. <strong>Reads in &lt;200ms</strong> — instant comprehension without labels</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {VERDICT_VISUALS.map(({ type, label, signal, metaphor, animation }) => (
              <div key={type} className="space-y-4 p-4 rounded-xl border bg-card">
                <div className="border-b pb-3">
                  <h3 className="font-semibold text-lg">{label}</h3>
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
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════
            SECTION 7: TYPOGRAPHY
            ═══════════════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Typography
          </h2>
          <p className="text-muted-foreground mb-6">
            Plus Jakarta Sans for UI, Geist Mono for code. All sizes follow Tailwind defaults.
          </p>

          <div className="space-y-4 rounded-xl border bg-card p-6">
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-muted-foreground w-16">3xl</span>
              <span className="text-3xl font-bold">RegionIQ Dashboard</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-muted-foreground w-16">2xl</span>
              <span className="text-2xl font-semibold">Section Heading</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-muted-foreground w-16">xl</span>
              <span className="text-xl font-semibold">Card Title</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-muted-foreground w-16">lg</span>
              <span className="text-lg font-medium">Subsection</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-muted-foreground w-16">base</span>
              <span className="text-base">Body text for paragraphs and descriptions.</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-muted-foreground w-16">sm</span>
              <span className="text-sm text-muted-foreground">Secondary text and labels</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-muted-foreground w-16">xs</span>
              <span className="text-xs text-muted-foreground">Captions and metadata</span>
            </div>
            <div className="flex items-baseline gap-4 pt-4 border-t">
              <span className="text-xs text-muted-foreground w-16">mono</span>
              <code className="font-mono text-sm bg-muted px-2 py-1 rounded">const code = "example"</code>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════════════
            SECTION 8: BORDER RADIUS
            ═══════════════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Circle className="h-6 w-6 text-primary" />
            Border Radius
          </h2>
          
          <div className="flex flex-wrap gap-4">
            {[
              { name: "none", class: "rounded-none" },
              { name: "sm", class: "rounded-sm" },
              { name: "md", class: "rounded-md" },
              { name: "lg", class: "rounded-lg" },
              { name: "xl", class: "rounded-xl" },
              { name: "2xl", class: "rounded-2xl" },
              { name: "full", class: "rounded-full" },
            ].map(({ name, class: className }) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <div className={cn("w-16 h-16 bg-primary", className)} />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t text-center text-sm text-muted-foreground">
          <p>RegionIQ Design System v1.0</p>
          <p className="text-xs mt-1">Last updated: February 2026</p>
        </footer>
      </div>
    </div>
  )
}
