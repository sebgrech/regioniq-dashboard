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
    <div ref={containerRef} className="min-h-screen bg-[#0B0F14] text-white">
      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* LEFT PANEL (visual) */}
        <div className="relative overflow-hidden border-b border-white/5 lg:border-b-0 lg:border-r-0">
          <div className="hidden lg:block absolute right-0 top-0 h-full w-px pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/10 to-white/0" />
          </div>

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(900px 520px at var(--mxp, 50%) var(--myp, 50%), rgba(255,255,255,0.06) 0%, transparent 62%)",
            }}
          />

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
                const dotR = Math.max(0.65, a.size / 9)
                const ringStart = dotR + 1.2
                const ringEnd = ringStart + (6.5 + (idx % 3) * 1.25)
                const dur = 3.4 + [0.0, 0.18, -0.12, 0.1, -0.05][idx % 5]
                return (
                  <g key={idx} transform={`translate(${a.x} ${a.y})`}>
                    <circle
                      r={dotR}
                      fill="rgba(255,255,255,0.70)"
                      stroke="rgba(255,255,255,0.14)"
                      strokeWidth="0.22"
                    />
                    <circle r={ringStart} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.22">
                      {!reducedMotion ? (
                        <>
                          <animate
                            attributeName="r"
                            values={`${ringStart};${ringEnd}`}
                            dur={`${dur}s`}
                            begin={`${a.delay}s`}
                            repeatCount="indefinite"
                          />
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

          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              backgroundSize: "220px 220px",
            }}
          />

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(11,15,20,0) 0%, rgba(11,15,20,0.44) 72%, rgba(11,15,20,0.76) 100%)",
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
                className="absolute left-1/2 top-1/2 w-[860px] max-w-none opacity-[0.045] select-none"
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
                {displayName ? `Hi ${displayName}!` : "You're invited"}
              </div>
              <div className="text-[13px] leading-relaxed text-white/45">
                Set your name and password to activate your account.
              </div>
            </div>

            <div
              className={[
                "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6",
                "transition-all duration-700",
                loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              ].join(" ")}
              style={{ transitionDelay: "90ms" }}
            >
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
                      "bg-[#0B0F14]/40 border border-white/10",
                      "text-white/90 placeholder:text-white/30",
                      "focus:outline-none focus:ring-2 focus:ring-white/15",
                    ].join(" ")}
                    autoComplete="name"
                  />

                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set a password (min 8 characters)"
                    className={[
                      "h-12 w-full rounded-xl px-4",
                      "bg-[#0B0F14]/40 border border-white/10",
                      "text-white/90 placeholder:text-white/30",
                      "focus:outline-none focus:ring-2 focus:ring-white/15",
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
                      "bg-[#0B0F14]/40 border border-white/10",
                      "text-white/90 placeholder:text-white/30",
                      "focus:outline-none focus:ring-2 focus:ring-white/15",
                    ].join(" ")}
                    autoComplete="new-password"
                    type="password"
                    required
                  />

                  {error ? <div className="text-[13px] text-red-300/90">{error}</div> : null}

                  <button
                    type="submit"
                    disabled={submitting || !password || !confirm}
                    className={[
                      "group w-full h-12 rounded-xl px-4",
                      "bg-white text-[#0B0F14] font-medium",
                      "transition-all duration-200",
                      "hover:bg-white/90 active:scale-[0.99]",
                      "disabled:opacity-40 disabled:pointer-events-none",
                      "flex items-center justify-center gap-2",
                    ].join(" ")}
                  >
                    {submitting ? "Activating…" : "Activate account"}
                    {!submitting ? (
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    ) : null}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-8 text-[12px] text-white/22">© {new Date().getFullYear()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}


