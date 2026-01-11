"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight } from "lucide-react"

type MePayload = { user: any | null }

type Anchor = {
  x: number // %
  y: number // %
  delay: number // seconds
  size: number // px
}

// Keep identical to the login page aesthetic for a premium, consistent invite flow.
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

function getDisplayName(user: any): string | null {
  const meta = user?.user_metadata ?? {}
  return (
    meta?.full_name ||
    meta?.name ||
    meta?.display_name ||
    meta?.preferred_username ||
    (typeof user?.email === "string" ? user.email.split("@")[0] : null) ||
    null
  )
}

export default function InvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = useMemo(() => searchParams.get("returnTo") || "/dashboard", [searchParams])
  const errorParam = useMemo(() => searchParams.get("error"), [searchParams])

  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const [user, setUser] = useState<any | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayName = useMemo(() => getDisplayName(user), [user])

  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  // Reduced-motion support (matches login page).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener?.("change", apply)
    return () => mq.removeEventListener?.("change", apply)
  }, [])

  // Smooth pointer tracking (matches login page).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

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
      left: `translate3d(calc((var(--mx, 0.5) - 0.5) * 10px), calc((var(--my, 0.5) - 0.5) * 10px), 0)`,
      right: `translate3d(calc((var(--mx, 0.5) - 0.5) * 4px), calc((var(--my, 0.5) - 0.5) * 4px), 0)`,
    }),
    []
  )

  useEffect(() => {
    let cancelled = false
    setLoadingUser(true)
    fetch("/api/auth/me", { cache: "no-store" as RequestCache })
      .then((r) => r.json() as Promise<MePayload>)
      .then((data) => {
        if (cancelled) return
        setUser(data?.user ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
      })
      .finally(() => {
        if (cancelled) return
        setLoadingUser(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Pre-fill a friendly name guess if we only have email.
    if (!user) return
    const metaName = user?.user_metadata?.full_name
    if (metaName) setFullName(metaName)
  }, [user])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/complete-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim() || undefined, password }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Failed to complete invite")

      // Signal post-login onboarding (tour + welcome).
      try {
        localStorage.setItem("riq:just-logged-in", "1")
      } catch {}

      router.replace(returnTo)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[hsl(220,48%,9%)] text-white overflow-hidden">
      {/* Aurora Borealis animated background - FULL WIDTH (match login page) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Aurora gradients with slow, smooth animations */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 -left-1/4 w-[150%] h-full bg-gradient-to-br from-purple-500/30 via-transparent to-transparent blur-3xl animate-aurora-slow-1" />
          <div className="absolute top-0 left-1/3 w-full h-full bg-gradient-to-br from-blue-500/30 via-cyan-500/20 to-transparent blur-3xl animate-aurora-slow-2" />
          <div className="absolute top-0 -right-1/4 w-full h-full bg-gradient-to-br from-green-500/20 via-blue-500/20 to-transparent blur-3xl animate-aurora-slow-3" />
          <div className="absolute bottom-0 -left-1/4 w-[150%] h-2/3 bg-gradient-to-t from-purple-600/20 via-transparent to-transparent blur-2xl animate-aurora-slow-4" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-full blur-3xl animate-aurora-pulse"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)" }}
          />
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
        <div className="relative overflow-hidden">
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
              transform: `${parallax.left} scale(0.78)`,
              transformOrigin: "50% 50%",
              transition: "transform 120ms ease-out",
            }}
          >
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
                  filter: "brightness(0) invert(1) contrast(1.05)",
                }}
              />

              {ANCHORS.map((a, idx) => {
                const dotR = Math.max(0.8, a.size / 8)
                const ringStart = dotR + 0.8
                const ringEnd = ringStart + (8 + (idx % 3) * 2)
                const dur = 3.0 + [0.0, 0.2, -0.15, 0.15, -0.1][idx % 5]
                const ringStagger = dur / 3

                const driftDur = 25 + (idx * 5)
                const driftX = [3, -2, 2.5, -3, 2, -2.5][idx % 6]
                const driftY = [2, -3, 1.5, -2, 3, -1.5][idx % 6]

                return (
                  <g key={idx}>
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
                      <circle r={dotR * 3} fill="rgba(139,92,246,0.2)" />
                      <circle r={dotR * 2} fill="rgba(34,211,238,0.25)" />
                      <circle r={dotR} fill="rgba(255,255,255,1)" stroke="rgba(139,92,246,0.5)" strokeWidth="0.35" />

                      {/* Multiple radiating rings with staggered timing */}
                      {!reducedMotion ? (
                        <>
                          <circle r={ringStart} fill="none" stroke="rgba(139,92,246,0.4)" strokeWidth="0.25">
                            <animate attributeName="r" values={`${ringStart};${ringEnd}`} dur={`${dur}s`} begin={`${a.delay}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.5;0.3;0.1;0" keyTimes="0;0.3;0.7;1" dur={`${dur}s`} begin={`${a.delay}s`} repeatCount="indefinite" />
                            <animate attributeName="stroke-width" values="0.25;0.15;0.05" dur={`${dur}s`} begin={`${a.delay}s`} repeatCount="indefinite" />
                          </circle>

                          <circle r={ringStart} fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="0.2">
                            <animate attributeName="r" values={`${ringStart};${ringEnd}`} dur={`${dur}s`} begin={`${a.delay + ringStagger}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.4;0.25;0.08;0" keyTimes="0;0.3;0.7;1" dur={`${dur}s`} begin={`${a.delay + ringStagger}s`} repeatCount="indefinite" />
                            <animate attributeName="stroke-width" values="0.2;0.12;0.04" dur={`${dur}s`} begin={`${a.delay + ringStagger}s`} repeatCount="indefinite" />
                          </circle>

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

        {/* RIGHT PANEL */}
        <div className="relative flex items-center justify-center px-8 py-14">
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
                  transform: `translate3d(-30%, -50%, 0) ${parallax.right}`,
                  mixBlendMode: "soft-light",
                  filter: "grayscale(1) brightness(1.12) contrast(1.03) blur(2px)",
                }}
              />
            </div>
          </div>

          <div
            className="absolute inset-y-0 left-0 w-24 pointer-events-none hidden lg:block"
            style={{
              background:
                "linear-gradient(to right, hsla(220,48%,9%,0.92), hsla(220,48%,9%,0))",
            }}
          />

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
                {displayName ? `Welcome, ${displayName}` : "Activate your account"}
              </div>
              <div 
                className={[
                  "text-[13px] leading-relaxed text-white/45",
                  "transition-all duration-700 ease-out",
                  loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
                ].join(" ")}
                style={{ transitionDelay: "120ms" }}
              >
                Set your name and password to get started.
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
                {loadingUser ? (
                  <div className="text-[13px] text-white/45">Preparing your invite…</div>
                ) : errorParam ? (
                  <div className="space-y-2">
                    <div className="text-[14px] font-medium text-white">Invite link problem</div>
                    <div className="text-[13px] text-white/45">{errorParam}</div>
                    <button
                      type="button"
                      onClick={() => router.replace("/login")}
                      className={[
                        "mt-2 inline-flex h-10 items-center justify-center rounded-xl px-4",
                        "bg-white/10 hover:bg-white/14 text-white/90",
                        "transition-all duration-200",
                      ].join(" ")}
                    >
                      Back to login
                    </button>
                  </div>
                ) : !user ? (
                  <div className="space-y-2">
                    <div className="text-[14px] font-medium text-white">Invite not active</div>
                    <div className="text-[13px] text-white/45">
                      This invite link is invalid or expired. Ask for a new invite link.
                    </div>
                    <button
                      type="button"
                      onClick={() => router.replace("/login")}
                      className={[
                        "mt-2 inline-flex h-10 items-center justify-center rounded-xl px-4",
                        "bg-white/10 hover:bg-white/14 text-white/90",
                        "transition-all duration-200",
                      ].join(" ")}
                    >
                      Back to login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={onSubmit} className="space-y-4">
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Name (optional)"
                      className={[
                        "h-12 w-full rounded-xl px-4",
                        "bg-[hsl(220,48%,9%)]/60 border border-white/10",
                        "text-white/90 placeholder:text-white/30",
                        "focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50",
                        "transition-all duration-200",
                      ].join(" ")}
                      autoComplete="name"
                    />

                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set a password (min 8 characters)"
                      className={[
                        "h-12 w-full rounded-xl px-4",
                        "bg-[hsl(220,48%,9%)]/60 border border-white/10",
                        "text-white/90 placeholder:text-white/30",
                        "focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50",
                        "transition-all duration-200",
                      ].join(" ")}
                      autoComplete="new-password"
                      type="password"
                      required
                    />

                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Confirm password"
                      className={[
                        "h-12 w-full rounded-xl px-4",
                        "bg-[hsl(220,48%,9%)]/60 border border-white/10",
                        "text-white/90 placeholder:text-white/30",
                        "focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/50",
                        "transition-all duration-200",
                      ].join(" ")}
                      autoComplete="new-password"
                      type="password"
                      required
                    />

                    {error ? <div className="text-[13px] text-red-300/90">{error}</div> : null}

                    {/* Button with shimmer effect */}
                    <button
                      type="submit"
                      disabled={submitting || !password || !confirm}
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
                      <span className="relative z-10">{submitting ? "Activating…" : "Activate account"}</span>
                      {!submitting ? (
                        <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      ) : null}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-8 text-[12px] text-white/22">© {new Date().getFullYear()}</div>
          </div>
        </div>
      </div>

      {/* Full-screen Aurora overlay on TOP of everything (match login page) */}
      <div className="absolute inset-0 pointer-events-none z-30">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent blur-3xl animate-aurora-slow-2" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[120%] h-2/3 bg-gradient-to-r from-transparent via-cyan-500/15 to-transparent blur-2xl animate-aurora-slow-3" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] blur-3xl animate-aurora-pulse"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)" }}
          />
        </div>
      </div>
    </div>
  )
}


