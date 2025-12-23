"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight } from "lucide-react"

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

  // Placeholder auth state (Supabase not wired yet)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const returnTo = useMemo(() => searchParams.get("returnTo") || "/dashboard", [searchParams])

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
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] text-white">
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

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0B0F14] text-white">
      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* LEFT PANEL (visual) */}
        <div
          className="relative overflow-hidden border-b border-white/5 lg:border-b-0 lg:border-r-0"
        >
          {/* Divider (Linear-style hairline + gentle glow) */}
          <div className="hidden lg:block absolute right-0 top-0 h-full w-px pointer-events-none">
            {/* Stripe-like: one crisp hairline, no glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white/0" />
          </div>

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
                const dotR = Math.max(0.65, a.size / 9) // scale px-ish -> viewBox-ish
                const ringStart = dotR + 1.2
                const ringEnd = ringStart + (6.5 + (idx % 3) * 1.25)
                const dur = 3.4 + [0.0, 0.18, -0.12, 0.1, -0.05][idx % 5]
                return (
                  <g key={idx} transform={`translate(${a.x} ${a.y})`}>
                    <circle r={dotR} fill="rgba(255,255,255,0.70)" stroke="rgba(255,255,255,0.14)" strokeWidth="0.22" />
                    <circle r={ringStart} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.22">
                      {!reducedMotion ? (
                        <>
                          <animate attributeName="r" values={`${ringStart};${ringEnd}`} dur={`${dur}s`} begin={`${a.delay}s`} repeatCount="indefinite" />
                          <animate
                            attributeName="opacity"
                            values="0;0.28;0.08;0"
                            keyTimes="0;0.12;0.72;1"
                            dur={`${dur}s`}
                            begin={`${a.delay}s`}
                            repeatCount="indefinite"
                          />
                        </>
                      ) : null}
                    </circle>
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
                "radial-gradient(ellipse at center, rgba(11,15,20,0) 0%, rgba(11,15,20,0.44) 72%, rgba(11,15,20,0.76) 100%)",
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
                className="absolute left-1/2 top-1/2 w-[860px] max-w-none opacity-[0.045] select-none"
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

          {/* Edge fade into the form side */}
          <div
            className="absolute inset-y-0 left-0 w-24 pointer-events-none hidden lg:block"
            style={{
              background:
                "linear-gradient(to right, rgba(11,15,20,0.92), rgba(11,15,20,0))",
            }}
          />

          <div
            className="relative z-10 w-full max-w-[420px]"
            style={{
              transform: parallax.right,
              transition: "transform 120ms ease-out",
            }}
          >
            {/* Context header (Linear-style) */}
            <div
              className={[
                "mb-6 space-y-2",
                "transition-all duration-700",
                loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              ].join(" ")}
            >
              <div className="text-[12px] tracking-[0.18em] uppercase text-white/50">RegionIQ</div>
              <div
                className="text-[32px] leading-[1.05] font-semibold tracking-tight text-white"
                style={{ fontFamily: "var(--font-plus-jakarta-sans), system-ui, sans-serif" }}
              >
                Sign in
              </div>
              <div className="text-[13px] leading-relaxed text-white/45">
                Access regional intelligence, faster.
              </div>
            </div>

            {/* Auth card */}
            <div
              className={[
                "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6",
                "transition-all duration-700",
                loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              ].join(" ")}
              style={{ transitionDelay: "90ms" }}
            >
              <form onSubmit={onSubmitLogin} className="space-y-4">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className={[
                    "h-12 w-full rounded-xl px-4",
                    "bg-[#0B0F14]/40 border border-white/10",
                    "text-white/90 placeholder:text-white/30",
                    "focus:outline-none focus:ring-2 focus:ring-white/15",
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
                    "bg-[#0B0F14]/40 border border-white/10",
                    "text-white/90 placeholder:text-white/30",
                    "focus:outline-none focus:ring-2 focus:ring-white/15",
                  ].join(" ")}
                  autoComplete="current-password"
                  type="password"
                  required
                />

                {authError ? <div className="text-[13px] text-red-300/90">{authError}</div> : null}

                <button
                  type="submit"
                  disabled={authLoading || !email || !password}
                  className={[
                    "group w-full h-12 rounded-xl px-4",
                    "bg-white text-[#0B0F14] font-medium",
                    "transition-all duration-200",
                    "hover:bg-white/90 active:scale-[0.99]",
                    "disabled:opacity-40 disabled:pointer-events-none",
                    "flex items-center justify-center gap-2",
                  ].join(" ")}
                >
                  {authLoading ? "Signing in…" : "Sign in"}
                  {!authLoading ? (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  ) : null}
                </button>
              </form>
            </div>

            {/* Ultra-min footer */}
            <div className="mt-8 text-[12px] text-white/22">
              © {new Date().getFullYear()}
            </div>
          </div>
        </div>

        <style jsx>{``}</style>
      </div>
    </div>
  )
}
