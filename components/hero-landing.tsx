"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, MapPin, Search, Check, ChevronDown } from "lucide-react"
import { REGIONS, type Region } from "@/lib/metrics.config"

// Group regions by country for the picker (include LAD level for local identification)
const GROUPED_REGIONS = REGIONS.filter(r => ["ITL1", "ITL2", "ITL3", "LAD"].includes(r.level)).reduce(
  (acc, region) => {
    const country = region.country
    if (!acc[country]) acc[country] = []
    acc[country].push(region)
    return acc
  },
  {} as Record<string, Region[]>
)

type Anchor = {
  x: number // %
  y: number // %
  delay: number // seconds
  size: number // px
}

// Fewer points reads more premium (less "busy") while still signaling coverage.
const ANCHORS: Anchor[] = [
  { x: 44, y: 28, delay: 0.0, size: 6 }, // Glasgow
  { x: 48, y: 33, delay: 0.5, size: 5 }, // Edinburgh
  { x: 58, y: 62, delay: 1.1, size: 6 }, // Manchester
  { x: 60, y: 70, delay: 1.6, size: 6 }, // Birmingham
  { x: 66, y: 82, delay: 2.2, size: 7 }, // London
  { x: 64, y: 90, delay: 2.8, size: 5 }, // Cardiff
]

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

/**
 * Paste this file as:
 *   app/page.tsx            (if this is your landing)
 * or
 *   app/login/page.tsx      (if this is your auth route)
 *
 * Assets expected in /public:
 *   /gb1.svg
 */
export default function LandingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)

  const [loaded, setLoaded] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [hasAuthHashTokens] = useState(() => {
    if (typeof window === "undefined") return false
    const hash = window.location.hash
    if (!hash || hash.length < 2) return false
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
    return Boolean(params.get("access_token") && params.get("refresh_token"))
  })

  // Auth mode: 'signin' or 'request'
  const [mode, setMode] = useState<'signin' | 'request'>('signin')
  
  // Sign in state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Request access state
  const [requestEmail, setRequestEmail] = useState("")
  const [homeRegion, setHomeRegion] = useState("UKI") // Default to London
  const [regionPickerOpen, setRegionPickerOpen] = useState(false)
  const [regionSearch, setRegionSearch] = useState("")
  const regionPickerRef = useRef<HTMLDivElement>(null)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const returnTo = useMemo(() => searchParams.get("returnTo") || "/dashboard", [searchParams])
  
  // Filter regions based on search
  const filteredGroupedRegions = useMemo(() => {
    if (!regionSearch.trim()) return GROUPED_REGIONS
    const search = regionSearch.toLowerCase()
    const result: Record<string, Region[]> = {}
    for (const [country, regions] of Object.entries(GROUPED_REGIONS)) {
      const filtered = regions.filter(
        r => r.name.toLowerCase().includes(search) || r.code.toLowerCase().includes(search)
      )
      if (filtered.length > 0) result[country] = filtered
    }
    return result
  }, [regionSearch])

  const selectedRegion = useMemo(() => REGIONS.find(r => r.code === homeRegion), [homeRegion])
  
  // Close region picker when clicking outside
  useEffect(() => {
    if (!regionPickerOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (regionPickerRef.current && !regionPickerRef.current.contains(e.target as Node)) {
        setRegionPickerOpen(false)
        setRegionSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [regionPickerOpen])

  // If Supabase redirects invite/magic links with tokens in the URL hash (/#access_token=...),
  // catch it here (both "/" and "/login" render this component) and forward to /auth/fragment.
  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (!hash || hash.length < 2) return

    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
    const access_token = params.get("access_token")
    const refresh_token = params.get("refresh_token")
    if (!access_token || !refresh_token) return

    const dest = `/auth/fragment?returnTo=${encodeURIComponent(returnTo)}${hash}`
    window.location.replace(dest)
  }, [returnTo])

  // If we landed here with Supabase tokens in the URL hash, don't flash the full sign-in UI.
  // Show a minimal bridge screen while we redirect to /auth/fragment.
  if (hasAuthHashTokens) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,48%,9%)] text-white">
        <div className="text-sm text-white/60">Signing you in…</div>
      </div>
    )
  }

  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  // Reduced-motion support (Linear-level polish).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener?.("change", apply)
    return () => mq.removeEventListener?.("change", apply)
  }, [])

  // Smooth pointer tracking (throttled via RAF) -> CSS variables (no React rerender per move).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Seed defaults so initial paint is stable.
    el.style.setProperty("--mx", "0.5")
    el.style.setProperty("--my", "0.5")
    el.style.setProperty("--mxp", "50%")
    el.style.setProperty("--myp", "50%")

    if (reducedMotion) return

    let raf = 0
    let pendingX = 0.5
    let pendingY = 0.5

    const commit = () => {
      raf = 0
      el.style.setProperty("--mx", String(pendingX))
      el.style.setProperty("--my", String(pendingY))
      el.style.setProperty("--mxp", `${Math.round(pendingX * 1000) / 10}%`)
      el.style.setProperty("--myp", `${Math.round(pendingY * 1000) / 10}%`)
    }

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      pendingX = clamp01((e.clientX - r.left) / r.width)
      pendingY = clamp01((e.clientY - r.top) / r.height)
      if (!raf) raf = requestAnimationFrame(commit)
    }

    // Desktop only: avoid weird parallax on touch.
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false
    if (coarse) return

    window.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onMove)
    }
  }, [reducedMotion])

  const parallax = useMemo(
    () => ({
      // Left is stronger than right for depth.
      left: `translate3d(calc((var(--mx, 0.5) - 0.5) * 10px), calc((var(--my, 0.5) - 0.5) * 10px), 0)`,
      right: `translate3d(calc((var(--mx, 0.5) - 0.5) * 4px), calc((var(--my, 0.5) - 0.5) * 4px), 0)`,
    }),
    []
  )

  const onSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Login failed")
      // Signal to the dashboard that this navigation came right after a successful login.
      // The dashboard will decide whether to show the tour (e.g. only if not seen for this user).
      try {
        localStorage.setItem("riq:just-logged-in", "1")
      } catch {}
      router.replace(returnTo)
      router.refresh()
    } catch (err: any) {
      setAuthError(err?.message || "Login failed")
    } finally {
      setAuthLoading(false)
    }
  }

  const onSubmitRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setRequestError(null)
    setRequestLoading(true)
    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: requestEmail, homeRegion }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Request failed")
      setRequestSuccess(true)
    } catch (err: any) {
      setRequestError(err?.message || "Something went wrong")
    } finally {
      setRequestLoading(false)
    }
  }

  const resetRequestAccess = () => {
    setRequestSuccess(false)
    setRequestEmail("")
    setRequestError(null)
  }

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[hsl(220,48%,9%)] text-white overflow-hidden">
      {/* Aurora Borealis animated background - FULL WIDTH */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Aurora gradients with slow, smooth animations */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 -left-1/4 w-[150%] h-full bg-gradient-to-br from-purple-500/30 via-transparent to-transparent blur-3xl animate-aurora-slow-1" />
          <div className="absolute top-0 left-1/3 w-full h-full bg-gradient-to-br from-blue-500/30 via-cyan-500/20 to-transparent blur-3xl animate-aurora-slow-2" />
          <div className="absolute top-0 -right-1/4 w-full h-full bg-gradient-to-br from-green-500/20 via-blue-500/20 to-transparent blur-3xl animate-aurora-slow-3" />
          <div className="absolute bottom-0 -left-1/4 w-[150%] h-2/3 bg-gradient-to-t from-purple-600/20 via-transparent to-transparent blur-2xl animate-aurora-slow-4" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-full blur-3xl animate-aurora-pulse" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)' }} />
        </div>
        
        {/* Subtle light streaks - full width */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-[10%] w-px h-full bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent animate-streak-1" />
          <div className="absolute top-0 left-[30%] w-px h-full bg-gradient-to-b from-transparent via-purple-400/50 to-transparent animate-streak-2" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-streak-3" />
          <div className="absolute top-0 left-[70%] w-px h-full bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent animate-streak-1" />
          <div className="absolute top-0 left-[90%] w-px h-full bg-gradient-to-b from-transparent via-purple-400/50 to-transparent animate-streak-2" />
        </div>
        
        {/* Animated floating particles */}
        <div className="absolute inset-0">
          <div className="absolute top-[10%] left-[5%] w-1.5 h-1.5 bg-white/60 rounded-full animate-particle-float-1" />
          <div className="absolute top-[25%] left-[12%] w-1 h-1 bg-cyan-400/50 rounded-full animate-particle-float-3" />
          <div className="absolute top-[45%] left-[8%] w-2 h-2 bg-white/40 rounded-full animate-particle-float-5" />
          <div className="absolute top-[65%] left-[15%] w-1 h-1 bg-purple-400/50 rounded-full animate-particle-float-2" />
          <div className="absolute top-[80%] left-[20%] w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-particle-float-4" />
          
          {/* Center-left particles */}
          <div className="absolute top-[15%] left-[25%] w-1 h-1 bg-white/50 rounded-full animate-particle-float-2" />
          <div className="absolute top-[35%] left-[30%] w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-particle-float-6" />
          <div className="absolute top-[55%] left-[35%] w-1 h-1 bg-white/70 rounded-full animate-particle-float-7" />
          <div className="absolute top-[75%] left-[28%] w-2 h-2 bg-purple-300/50 rounded-full animate-particle-float-1" />
          
          {/* Center particles */}
          <div className="absolute top-[20%] left-[45%] w-1.5 h-1.5 bg-white/60 rounded-full animate-particle-float-8" />
          <div className="absolute top-[40%] left-[50%] w-1 h-1 bg-blue-400/50 rounded-full animate-particle-float-3" />
          <div className="absolute top-[60%] left-[48%] w-2 h-2 bg-cyan-300/60 rounded-full animate-particle-float-5" />
          <div className="absolute top-[85%] left-[52%] w-1 h-1 bg-white/50 rounded-full animate-particle-float-4" />
          
          {/* Center-right particles */}
          <div className="absolute top-[12%] left-[65%] w-1 h-1 bg-purple-400/50 rounded-full animate-particle-float-2" />
          <div className="absolute top-[30%] left-[70%] w-1.5 h-1.5 bg-white/70 rounded-full animate-particle-float-7" />
          <div className="absolute top-[50%] left-[68%] w-1 h-1 bg-cyan-400/60 rounded-full animate-particle-float-6" />
          <div className="absolute top-[70%] left-[72%] w-2 h-2 bg-blue-300/50 rounded-full animate-particle-float-1" />
          
          {/* Right side particles */}
          <div className="absolute top-[18%] left-[85%] w-1.5 h-1.5 bg-white/50 rounded-full animate-particle-float-3" />
          <div className="absolute top-[38%] left-[90%] w-1 h-1 bg-purple-300/50 rounded-full animate-particle-float-8" />
          <div className="absolute top-[58%] left-[88%] w-2 h-2 bg-cyan-400/60 rounded-full animate-particle-float-5" />
          <div className="absolute top-[78%] left-[92%] w-1 h-1 bg-white/60 rounded-full animate-particle-float-4" />
          <div className="absolute top-[90%] left-[95%] w-1.5 h-1.5 bg-blue-400/50 rounded-full animate-particle-float-2" />
        </div>
      </div>

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* LEFT PANEL (visual) */}
        <div
          className="relative overflow-hidden"
        >
          {/* Ambient light (monochrome) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(900px 520px at var(--mxp, 50%) var(--myp, 50%), rgba(255,255,255,0.06) 0%, transparent 62%)",
            }}
          />

          {/* UK outline + aligned points (single transformed layer so they always stay in sync) */}
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              // The UK SVG is tall; slight scale-down keeps the full outline visible (prevents bottom cut-off).
              transform: `${parallax.left} scale(0.78)`,
              transformOrigin: "50% 50%",
              transition: "transform 120ms ease-out",
            }}
          >
            {/* Render as SVG so the "dots" are literally inside the SVG layer */}
            <svg
              className="absolute left-[-16%] top-[-12%] h-[114vh] w-auto opacity-[0.34]"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              aria-label="UK Outline"
              role="img"
            >
              <image
                href="/gb1.svg"
                x="0"
                y="0"
                width="100"
                height="100"
                preserveAspectRatio="xMidYMid meet"
              style={{
                  // Keep it visually as an outline: no blur/glow (those visually thicken strokes).
                  filter: "brightness(0) invert(1) contrast(1.05)",
                }}
              />

              {ANCHORS.map((a, idx) => {
                // Pinpoint sizing: keep dots small and crisp.
                const dotR = Math.max(0.8, a.size / 8) // slightly larger center dot
                const ringStart = dotR + 0.8
                const ringEnd = ringStart + (8 + (idx % 3) * 2) // larger expansion
                const dur = 3.0 + [0.0, 0.2, -0.15, 0.15, -0.1][idx % 5]
                const ringStagger = dur / 3 // stagger between rings
                
                // Slow drift animation parameters - each dot moves differently
                const driftDur = 25 + (idx * 5) // 25-55 seconds per cycle
                const driftX = [3, -2, 2.5, -3, 2, -2.5][idx % 6] // horizontal drift range
                const driftY = [2, -3, 1.5, -2, 3, -1.5][idx % 6] // vertical drift range
                
                return (
                  <g key={idx}>
                    {/* Wrapper with slow drift animation */}
                    <g>
                      {!reducedMotion ? (
                        <animateTransform
                          attributeName="transform"
                          type="translate"
                          values={`${a.x} ${a.y}; ${a.x + driftX} ${a.y + driftY}; ${a.x - driftX * 0.5} ${a.y - driftY * 0.7}; ${a.x + driftX * 0.7} ${a.y - driftY * 0.5}; ${a.x} ${a.y}`}
                          dur={`${driftDur}s`}
                          repeatCount="indefinite"
                          calcMode="spline"
                          keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1"
                        />
                      ) : (
                        <animateTransform
                          attributeName="transform"
                          type="translate"
                          values={`${a.x} ${a.y}`}
                          dur="0s"
                        />
                      )}
                      
                      {/* Center dot with glow */}
                      <circle r={dotR * 3} fill="rgba(139,92,246,0.2)" /> {/* Outer purple glow */}
                      <circle r={dotR * 2} fill="rgba(34,211,238,0.25)" /> {/* Inner cyan glow */}
                      <circle r={dotR} fill="rgba(255,255,255,1)" stroke="rgba(139,92,246,0.5)" strokeWidth="0.35" /> {/* Bright center */}
                      
                      {/* Multiple radiating rings with staggered timing */}
                      {!reducedMotion ? (
                        <>
                          {/* Ring 1 */}
                          <circle r={ringStart} fill="none" stroke="rgba(139,92,246,0.4)" strokeWidth="0.25">
                            <animate attributeName="r" values={`${ringStart};${ringEnd}`} dur={`${dur}s`} begin={`${a.delay}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.5;0.3;0.1;0" keyTimes="0;0.3;0.7;1" dur={`${dur}s`} begin={`${a.delay}s`} repeatCount="indefinite" />
                            <animate attributeName="stroke-width" values="0.25;0.15;0.05" dur={`${dur}s`} begin={`${a.delay}s`} repeatCount="indefinite" />
                          </circle>
                          
                          {/* Ring 2 - staggered */}
                          <circle r={ringStart} fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="0.2">
                            <animate attributeName="r" values={`${ringStart};${ringEnd}`} dur={`${dur}s`} begin={`${a.delay + ringStagger}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.4;0.25;0.08;0" keyTimes="0;0.3;0.7;1" dur={`${dur}s`} begin={`${a.delay + ringStagger}s`} repeatCount="indefinite" />
                            <animate attributeName="stroke-width" values="0.2;0.12;0.04" dur={`${dur}s`} begin={`${a.delay + ringStagger}s`} repeatCount="indefinite" />
                          </circle>
                          
                          {/* Ring 3 - more staggered */}
                          <circle r={ringStart} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.18">
                            <animate attributeName="r" values={`${ringStart};${ringEnd}`} dur={`${dur}s`} begin={`${a.delay + ringStagger * 2}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.35;0.2;0.05;0" keyTimes="0;0.3;0.7;1" dur={`${dur}s`} begin={`${a.delay + ringStagger * 2}s`} repeatCount="indefinite" />
                            <animate attributeName="stroke-width" values="0.18;0.1;0.03" dur={`${dur}s`} begin={`${a.delay + ringStagger * 2}s`} repeatCount="indefinite" />
                          </circle>
                        </>
                      ) : null}
                    </g>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Film grain */}
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              backgroundSize: "220px 220px",
            }}
          />

          {/* Vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, hsla(220,48%,9%,0) 0%, hsla(220,48%,9%,0.44) 72%, hsla(220,48%,9%,0.76) 100%)",
            }}
          />

        </div>

        {/* RIGHT PANEL (auth placeholder) */}
        <div className="relative flex items-center justify-center px-8 py-14">
          {/* Ultra-subtle structure (grid) so the right side feels equally "designed" */}
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-[0.022]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.028) 1px, transparent 1px)",
              backgroundSize: "56px 56px, 56px 56px",
              WebkitMaskImage:
                "radial-gradient(closest-side at 55% 45%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)",
              maskImage:
                "radial-gradient(closest-side at 55% 45%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 55%, rgba(0,0,0,0) 100%)",
            }}
          />

          {/* Big monochrome logo watermark (behind content) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            {/* Soft mask so it feels "printed into" the background (Apple/Linear style). */}
            <div
              className="absolute inset-0"
              style={{
                WebkitMaskImage:
                  "radial-gradient(closest-side at 65% 48%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.82) 38%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0) 100%)",
                maskImage:
                  "radial-gradient(closest-side at 65% 48%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.82) 38%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0) 100%)",
              }}
            >
              <img
                src="/Frame 11.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute left-1/2 top-1/2 w-[860px] max-w-none opacity-[0.22] select-none"
                style={{
                  // Off-center placement reads more premium than a dead-centered watermark.
                  // Parallax applies on top, but we keep a stable baseline composition.
                  transform: `translate3d(-30%, -50%, 0) ${parallax.right}`,
                  mixBlendMode: "soft-light",
                  filter: "grayscale(1) brightness(1.12) contrast(1.03) blur(2px)",
                }}
              />
            </div>
          </div>

          <div
            className="relative z-10 w-full max-w-[420px]"
            style={{
              transform: parallax.right,
              transition: "transform 120ms ease-out",
            }}
          >
            {/* Context header (Linear-style) with staggered animations */}
            <div className="mb-6 space-y-2">
              <div
                className={[
                  "text-[32px] leading-[1.05] font-semibold tracking-tight text-white",
                  "transition-all duration-700 ease-out",
                  loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
                ].join(" ")}
                style={{ 
                  fontFamily: "var(--font-plus-jakarta-sans), system-ui, sans-serif",
                  transitionDelay: "60ms",
                }}
              >
                {mode === 'signin' ? 'Sign in' : (requestSuccess ? 'Check your email' : 'Request access')}
              </div>
              <div 
                className={[
                  "text-[13px] leading-relaxed text-white/45",
                  "transition-all duration-700 ease-out",
                  loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
                ].join(" ")}
                style={{ transitionDelay: "120ms" }}
              >
                {mode === 'signin' 
                  ? 'Access economic intelligence, faster.' 
                  : (requestSuccess 
                      ? `We sent a sign-in link to ${requestEmail}` 
                      : 'Get a sign-in link sent to your email.'
                    )
                }
              </div>
            </div>

            {/* Auth card with gradient border glow */}
            <div
              className={[
                "relative rounded-2xl p-6 backdrop-blur-xl",
                "transition-all duration-700 ease-out",
                loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
              ].join(" ")}
              style={{ transitionDelay: "180ms" }}
            >
              {/* Gradient border glow effect */}
              <div 
                className="absolute -inset-[1px] rounded-2xl opacity-60"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(34,211,238,0.2) 50%, rgba(139,92,246,0.3) 100%)",
                }}
              />
              <div className="absolute inset-0 rounded-2xl bg-white/[0.04]" />
              
              {/* Card content */}
              <div className="relative z-10">
                {mode === 'signin' ? (
                  /* Sign In Form */
                  <form onSubmit={onSubmitLogin} className="space-y-4">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className={[
                        "h-12 w-full rounded-xl px-4",
                        "bg-[hsl(220,48%,9%)]/60 border border-white/10",
                        "text-white/90 placeholder:text-white/30",
                        "focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50",
                        "transition-all duration-200",
                      ].join(" ")}
                      autoComplete="email"
                      type="email"
                      required
                    />

                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className={[
                        "h-12 w-full rounded-xl px-4",
                        "bg-[hsl(220,48%,9%)]/60 border border-white/10",
                        "text-white/90 placeholder:text-white/30",
                        "focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50",
                        "transition-all duration-200",
                      ].join(" ")}
                      autoComplete="current-password"
                      type="password"
                      required
                    />

                    {authError ? <div className="text-[13px] text-red-300/90">{authError}</div> : null}

                    {/* Button with shimmer effect */}
                    <button
                      type="submit"
                      disabled={authLoading || !email || !password}
                      className={[
                        "group relative w-full h-12 rounded-xl px-4 overflow-hidden",
                        "bg-white text-[hsl(220,48%,9%)] font-medium",
                        "transition-all duration-200",
                        "hover:shadow-lg hover:shadow-white/10 active:scale-[0.99]",
                        "disabled:opacity-40 disabled:pointer-events-none",
                        "flex items-center justify-center gap-2",
                      ].join(" ")}
                    >
                      {/* Shimmer overlay */}
                      <div 
                        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
                        style={{
                          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                        }}
                      />
                      <span className="relative z-10">{authLoading ? "Signing in…" : "Sign in"}</span>
                      {!authLoading ? (
                        <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      ) : null}
                    </button>

                    {/* Mode toggle */}
                    <div className="pt-2 text-center">
                      <span className="text-[13px] text-white/40">New here? </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('request')
                          setAuthError(null)
                        }}
                        className="text-[13px] text-white/70 hover:text-white transition-colors underline underline-offset-2"
                      >
                        Request access
                      </button>
                    </div>
                  </form>
                ) : requestSuccess ? (
                  /* Success State with Animated Checkmark */
                  <div className="space-y-6 py-4">
                    {/* Animated Checkmark */}
                    <div className="flex justify-center">
                      <div className="relative">
                        <svg 
                          viewBox="0 0 52 52" 
                          className="w-16 h-16"
                        >
                          {/* Circle */}
                          <circle 
                            cx="26" 
                            cy="26" 
                            r="24" 
                            fill="none" 
                            stroke="rgba(255,255,255,0.9)" 
                            strokeWidth="2"
                            className="animate-circle-draw"
                            style={{
                              strokeDasharray: 151,
                              strokeDashoffset: 151,
                            }}
                          />
                          {/* Checkmark */}
                          <path 
                            d="M15 27l7 7 15-15" 
                            fill="none" 
                            stroke="rgba(255,255,255,1)" 
                            strokeWidth="3" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="animate-check-draw"
                            style={{
                              strokeDasharray: 36,
                              strokeDashoffset: 36,
                            }}
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Expiry note */}
                    <p className="text-center text-[13px] text-white/50">
                      The link expires in 1 hour.
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center justify-center gap-4 text-[13px]">
                      <button
                        type="button"
                        onClick={() => {
                          setRequestSuccess(false)
                          onSubmitRequestAccess({ preventDefault: () => {} } as React.FormEvent)
                        }}
                        disabled={requestLoading}
                        className="text-white/70 hover:text-white transition-colors underline underline-offset-2 disabled:opacity-50"
                      >
                        {requestLoading ? 'Sending…' : 'Resend link'}
                      </button>
                      <span className="text-white/30">·</span>
                      <button
                        type="button"
                        onClick={resetRequestAccess}
                        className="text-white/70 hover:text-white transition-colors underline underline-offset-2"
                      >
                        Use different email
                      </button>
                    </div>

                    {/* Back to sign in */}
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signin')
                          resetRequestAccess()
                        }}
                        className="text-[13px] text-white/50 hover:text-white/70 transition-colors"
                      >
                        ← Back to sign in
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Request Access Form */
                  <form onSubmit={onSubmitRequestAccess} className="space-y-4">
                    <input
                      value={requestEmail}
                      onChange={(e) => setRequestEmail(e.target.value)}
                      placeholder="Email"
                      className={[
                        "h-12 w-full rounded-xl px-4",
                        "bg-[hsl(220,48%,9%)]/60 border border-white/10",
                        "text-white/90 placeholder:text-white/30",
                        "focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50",
                        "transition-all duration-200",
                      ].join(" ")}
                      autoComplete="email"
                      type="email"
                      required
                    />

                    {/* Home Region Picker */}
                    <div ref={regionPickerRef} className="relative">
                      {/* Animated glow ring when open */}
                      <div 
                        className={[
                          "absolute -inset-[2px] rounded-xl transition-all duration-500 pointer-events-none",
                          regionPickerOpen 
                            ? "opacity-100" 
                            : "opacity-0",
                        ].join(" ")}
                        style={{
                          background: "linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(34,211,238,0.3) 50%, rgba(139,92,246,0.4) 100%)",
                          filter: "blur(4px)",
                        }}
                      />
                      
                      <button
                        type="button"
                        onClick={() => {
                          setRegionPickerOpen(!regionPickerOpen)
                          if (!regionPickerOpen) setRegionSearch("")
                        }}
                        className={[
                          "relative h-12 w-full rounded-xl px-4",
                          "bg-[hsl(220,48%,9%)]/60 border",
                          regionPickerOpen ? "border-purple-500/50 ring-2 ring-purple-500/40" : "border-white/10",
                          "text-white/90 text-left",
                          "focus:outline-none",
                          "transition-all duration-200",
                          "flex items-center justify-between gap-2",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-purple-400" />
                          <span className={selectedRegion ? "text-white/90" : "text-white/30"}>
                            {selectedRegion?.name || "Select your home region"}
                          </span>
                        </div>
                        <ChevronDown 
                          className={[
                            "h-4 w-4 text-white/50 transition-transform duration-300",
                            regionPickerOpen ? "rotate-180" : "",
                          ].join(" ")} 
                        />
                      </button>

                      {/* Dropdown panel */}
                      {regionPickerOpen && (
                        <div 
                          className={[
                            "absolute top-full left-0 right-0 mt-2 z-50",
                            "rounded-xl border border-white/10 bg-[hsl(220,48%,9%)]/95 backdrop-blur-xl",
                            "shadow-2xl shadow-purple-500/20",
                            "overflow-hidden",
                            "animate-in fade-in-0 slide-in-from-top-2 duration-200",
                          ].join(" ")}
                        >
                          {/* Search input */}
                          <div className="relative border-b border-white/10">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                            <input
                              value={regionSearch}
                              onChange={(e) => setRegionSearch(e.target.value)}
                              placeholder="Search regions..."
                              className={[
                                "w-full h-11 pl-11 pr-4 bg-transparent",
                                "text-white/90 text-sm placeholder:text-white/30",
                                "focus:outline-none",
                              ].join(" ")}
                              autoFocus
                            />
                          </div>
                          
                          {/* Region list */}
                          <div className="max-h-56 overflow-y-auto">
                            {Object.keys(filteredGroupedRegions).length === 0 ? (
                              <div className="px-4 py-6 text-center text-sm text-white/40">
                                No regions found
                              </div>
                            ) : (
                              Object.entries(filteredGroupedRegions).map(([country, regions]) => (
                                <div key={country}>
                                  <div className="px-4 py-2 text-[11px] text-white/40 uppercase tracking-wider font-medium sticky top-0 bg-[hsl(220,48%,9%)]">
                                    {country}
                                  </div>
                                  {regions.map(region => (
                                    <button
                                      key={region.code}
                                      type="button"
                                      onClick={() => {
                                        setHomeRegion(region.code)
                                        setRegionPickerOpen(false)
                                        setRegionSearch("")
                                      }}
                                      className={[
                                        "w-full px-4 py-2.5 text-left text-sm",
                                        "hover:bg-white/5 transition-colors",
                                        "flex items-center justify-between",
                                        homeRegion === region.code 
                                          ? "text-purple-300 bg-purple-500/10" 
                                          : "text-white/80",
                                      ].join(" ")}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{region.name}</span>
                                        <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/5">
                                          {region.level}
                                        </span>
                                      </div>
                                      {homeRegion === region.code && (
                                        <Check className="h-4 w-4 text-purple-400" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Helper text */}
                      <p className="mt-1.5 text-[11px] text-white/30">
                        Your default region when signing in
                      </p>
                    </div>

                    {requestError ? <div className="text-[13px] text-red-300/90">{requestError}</div> : null}

                    {/* Button with shimmer effect */}
                    <button
                      type="submit"
                      disabled={requestLoading || !requestEmail}
                      className={[
                        "group relative w-full h-12 rounded-xl px-4 overflow-hidden",
                        "bg-white text-[hsl(220,48%,9%)] font-medium",
                        "transition-all duration-200",
                        "hover:shadow-lg hover:shadow-white/10 active:scale-[0.99]",
                        "disabled:opacity-40 disabled:pointer-events-none",
                        "flex items-center justify-center gap-2",
                      ].join(" ")}
                    >
                      {/* Shimmer overlay */}
                      <div 
                        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
                        style={{
                          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                        }}
                      />
                      <span className="relative z-10">{requestLoading ? "Sending…" : "Get access"}</span>
                      {!requestLoading ? (
                        <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      ) : null}
                    </button>

                    {/* Mode toggle */}
                    <div className="pt-2 text-center">
                      <span className="text-[13px] text-white/40">Already have an account? </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signin')
                          setRequestError(null)
                        }}
                        className="text-[13px] text-white/70 hover:text-white transition-colors underline underline-offset-2"
                      >
                        Sign in
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Ultra-min footer */}
            <div className="mt-8 text-[12px] text-white/22">
              © {new Date().getFullYear()}
            </div>
          </div>
        </div>

        <style jsx>{``}</style>
      </div>

      {/* Full-screen Aurora overlay on TOP of everything */}
      <div className="absolute inset-0 pointer-events-none z-30">
        <div className="absolute inset-0 opacity-30">
          {/* Center blend aurora that crosses the entire screen */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent blur-3xl animate-aurora-slow-2" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[120%] h-2/3 bg-gradient-to-r from-transparent via-cyan-500/15 to-transparent blur-2xl animate-aurora-slow-3" />
          {/* Extra center glow to unify left and right */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] blur-3xl animate-aurora-pulse" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)' }} />
        </div>
      </div>
    </div>
  )
}
