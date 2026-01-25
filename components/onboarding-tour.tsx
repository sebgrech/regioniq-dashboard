"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TourStep = {
  id: string
  title: string
  description: string
  targetId?: string
}

type Rect = { left: number; top: number; width: number; height: number }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function getRect(el: Element | null): Rect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  // If the element is display:none or detached, the rect will be 0.
  if (!r || (r.width === 0 && r.height === 0)) return null
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

function getTopObstructionPx(): number {
  // Primary sticky header we control.
  const topbar = document.getElementById("tour-topbar")
  const topbarH = topbar ? topbar.getBoundingClientRect().height : 0

  // Also include any other sticky/fixed elements at the top (e.g., secondary nav),
  // but avoid double-counting the topbar itself.
  let extra = 0
  const candidates = document.querySelectorAll<HTMLElement>(".sticky.top-0, .fixed.top-0")
  candidates.forEach((el) => {
    if (topbar && el === topbar) return
    const r = el.getBoundingClientRect()
    // Only count if it's actually at/near the top and visible.
    if (r.height > 0 && r.bottom > 0 && r.top <= 1) {
      extra += r.height
    }
  })

  return Math.round(topbarH + extra)
}

function ensureElementFullyInView(el: HTMLElement) {
  const margin = 16
  const topObstruction = getTopObstructionPx()
  const viewTop = topObstruction + margin
  const viewBottom = window.innerHeight - margin

  const rect = el.getBoundingClientRect()
  const available = Math.max(1, viewBottom - viewTop)
  const tall = rect.height > available

  // If it already fits, no scroll.
  if (!tall && rect.top >= viewTop && rect.bottom <= viewBottom) return

  // Compute the minimal scroll delta to bring it fully into the usable viewport.
  let delta = 0
  if (tall) {
    // For tall targets (e.g. map viewport), align its top just below sticky UI.
    delta = rect.top - viewTop
  } else if (rect.top < viewTop) {
    delta = rect.top - viewTop
  } else if (rect.bottom > viewBottom) {
    delta = rect.bottom - viewBottom
  }

  if (Math.abs(delta) < 1) return

  window.scrollTo({ top: window.scrollY + delta, behavior: "smooth" })
}

export function OnboardingTour(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isUK: boolean
  onFinish: () => void
  userName?: string | null
  apiAccess?: boolean
}) {
  const { open, onOpenChange, isUK, onFinish, userName, apiAccess = true } = props
  const [stepIdx, setStepIdx] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(false)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [hopNonce, setHopNonce] = useState(0)
  const [isFlying, setIsFlying] = useState(false)
  const [overlayTick, setOverlayTick] = useState(0)
  const roRef = useRef<ResizeObserver | null>(null)
  const rafRef = useRef<number | null>(null)
  const overlayRafRef = useRef<number | null>(null)
  const prevSpotCenterRef = useRef<{ x: number; y: number } | null>(null)
  const prevCardPosRef = useRef<{ x: number; y: number } | null>(null)
  const leftPupilRef = useRef<HTMLDivElement | null>(null)
  const rightPupilRef = useRef<HTMLDivElement | null>(null)

  const steps: TourStep[] = useMemo(() => {
    const base: TourStep[] = [
      {
        id: "topbar",
        title: "Search indicators (top bar)",
        description:
          "Start here: use the search to quickly jump to what you want to explore.",
        targetId: "tour-indicator-search",
      },
      {
        id: "year",
        title: "Change the year",
        description:
          "Try it: flip between Actual and forecast years to see how the picture shifts.",
        targetId: "tour-year-selector",
      },
    ]

    // Only show API step if user has API access
    if (apiAccess !== false) {
      base.push({
        id: "api",
        title: "API Access",
        description:
          "Build on our data: click your profile to generate API keys and pull forecasts into your own systems.",
        targetId: "tour-api-button",
      })
    }

    base.push(
      {
        id: "kpi",
        title: "KPI cards (quick drill-down)",
        description:
          "Try it: click this KPI card to jump into a detailed breakdown for that indicator.",
        targetId: "tour-kpi-card",
      },
      {
        id: "map",
        title: "Explore the map",
        description:
          "Try it: click a region on the map. This view is the fastest way to spot patterns geographically.",
        targetId: "tour-map-viewport",
      },
    )

    // Action cards (explicit steps so the tour matches what users can actually click).
    base.push({
      id: "compare",
      title: "Compare regions",
      description: "Try it: compare your current region against peers in a single view.",
      targetId: "tour-compare-action",
    })

    // Full Analysis (only on non-UK)
    if (!isUK) {
      base.push({
        id: "full-analysis",
        title: "Full Analysis",
        description: "Deep-dive into your selected region",
        targetId: "tour-full-analysis-action",
      })
    }

    // Westminster (UK only)
    if (isUK) {
      base.push({
        id: "westminster",
        title: "Westminster",
        description: "Deep-dive into Westminster",
        targetId: "tour-westminster-action",
      })
    }

    base.push({
      id: "catchment",
      title: "Catchment Analysis",
      description: "Draw areas or generate isochrones",
      targetId: "tour-catchment-action",
    })

    base.push({
      id: "data",
      title: "Data Explorer",
      description: "Query & export raw data",
      targetId: "tour-data-action",
    })

    base.push({
      id: "ai",
      title: "AI analysis",
      description: "Generate an AI narrative and ask questions as you explore.",
      targetId: "tour-ai-analysis",
    })

    base.push({
      id: "feedback",
      title: "Feedback",
      description: "Please continuously leave feedback as you use the product.",
      targetId: "tour-feedback",
    })

    return base
  }, [isUK, apiAccess])

  const current = steps[Math.min(stepIdx, steps.length - 1)]
  const isFirst = stepIdx === 0
  const isLast = stepIdx >= steps.length - 1
  const firstName = useMemo(() => {
    if (!userName) return null
    const t = String(userName).trim()
    if (!t) return null
    // Prefer first token for a clean, professional greeting.
    return t.split(/\s+/)[0] || null
  }, [userName])

  useEffect(() => setMounted(true), [])

  // Reset step when reopened.
  useEffect(() => {
    if (open) setStepIdx(0)
  }, [open])

  // Non-step welcome intro (shown when tour opens; doesn't count as a step).
  useEffect(() => {
    if (open) setShowWelcomeIntro(true)
    else setShowWelcomeIntro(false)
  }, [open])

  // Tasteful cursor-tracking “eyes” for the welcome intro (subtle pupils).
  useEffect(() => {
    if (!open || !showWelcomeIntro) return
    if (typeof window === "undefined") return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return
    if (window.matchMedia?.("(pointer: coarse)")?.matches) return

    const onMove = (e: PointerEvent) => {
      const pupils = [leftPupilRef.current, rightPupilRef.current].filter(Boolean) as HTMLDivElement[]
      for (const pupil of pupils) {
        const eye = pupil.parentElement
        if (!eye) continue
        const r = eye.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = e.clientX - cx
        const dy = e.clientY - cy

        const max = 2.4
        const len = Math.max(1, Math.hypot(dx, dy))
        const px = Math.max(-max, Math.min(max, (dx / len) * max))
        const py = Math.max(-max, Math.min(max, (dy / len) * max))
        pupil.style.transform = `translate3d(calc(-50% + ${px}px), calc(-50% + ${py}px), 0)`
      }
    }

    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [open, showWelcomeIntro])

  // Trigger a “hop” on step changes (keeps motion playful without spinners/arrows).
  useEffect(() => {
    if (!open) return
    setHopNonce((n) => n + 1)
    setIsFlying(true)
    const t = window.setTimeout(() => setIsFlying(false), 680)
    return () => window.clearTimeout(t)
  }, [open, stepIdx])

  // Keep viewport dims updated for anchoring.
  useEffect(() => {
    if (!open) return
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update, { passive: true })
    return () => window.removeEventListener("resize", update)
  }, [open])

  // Scroll to the relevant section on step changes, then track its rect.
  useEffect(() => {
    if (!open) return
    if (!current?.targetId) return
    const el = document.getElementById(current.targetId)
    if (!el) {
      setTargetRect(null)
      return
    }
    // For topbar steps, don't scroll (target lives in the sticky header).
    const isTopbarStep = current.id === "topbar" || current.id === "year"
    let t: number | undefined
    if (!isTopbarStep) {
      // Ensure the whole target is visible (not tucked under sticky UI).
      // Run twice: once immediately, and once after the smooth scroll settles a bit.
      ensureElementFullyInView(el)
      t = window.setTimeout(() => ensureElementFullyInView(el), 220)
    }

    // Observe size changes so the spotlight sticks to the target.
    try {
      roRef.current?.disconnect()
      roRef.current = new ResizeObserver(() => {
        setTargetRect(getRect(el))
      })
      roRef.current.observe(el)
    } catch {
      // ignore
    }

    // Also update on scroll (RAF-throttled).
    const onScroll = () => {
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null
        setTargetRect(getRect(el))
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    // Initial measure after the scroll animation starts.
    onScroll()
    return () => {
      if (t) window.clearTimeout(t)
      window.removeEventListener("scroll", onScroll)
      roRef.current?.disconnect()
      roRef.current = null
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [open, current?.targetId])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  // Reposition when Radix popovers/dropdowns open/close so we don't overlap menus (step 1/2).
  useEffect(() => {
    if (!open) return
    const schedule = () => {
      if (overlayRafRef.current) return
      overlayRafRef.current = window.requestAnimationFrame(() => {
        overlayRafRef.current = null
        setOverlayTick((t) => t + 1)
      })
    }

    const mo = new MutationObserver(schedule)
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "style", "class"],
    })

    return () => {
      mo.disconnect()
      if (overlayRafRef.current) {
        cancelAnimationFrame(overlayRafRef.current)
        overlayRafRef.current = null
      }
    }
  }, [open])

  const handleSkip = () => {
    onOpenChange(false)
    onFinish()
  }

  const handleNext = () => {
    if (isLast) {
      onOpenChange(false)
      onFinish()
      return
    }
    setStepIdx((s) => Math.min(s + 1, steps.length - 1))
  }

  const handleBack = () => setStepIdx((s) => Math.max(0, s - 1))
  const shouldRender = open && mounted

  // Read currently-open Radix overlays (popover/dropdown) so we can avoid overlapping them.
  // `overlayTick` exists purely to trigger re-measurement when these open/close.
  const openOverlayRects: Rect[] = useMemo(() => {
    if (!shouldRender) return []
    const sels = [
      '[data-slot="popover-content"][data-state="open"]',
      '[data-slot="dropdown-menu-content"][data-state="open"]',
      '[data-slot="dropdown-menu-sub-content"][data-state="open"]',
    ]
    const nodes = document.querySelectorAll(sels.join(","))
    const rects: Rect[] = []
    nodes.forEach((n) => {
      const r = getRect(n)
      if (r) rects.push(r)
    })
    return rects
  }, [shouldRender, overlayTick])

  const spot = useMemo(() => {
    if (!shouldRender) return null
    const pad = 10
    const rect = targetRect
    if (!rect) return null
    return {
      x: clamp(rect.left - pad, 8, viewport.w - 8),
      y: clamp(rect.top - pad, 8, viewport.h - 8),
      w: clamp(rect.width + pad * 2, 80, viewport.w - 16),
      h: clamp(rect.height + pad * 2, 56, viewport.h - 16),
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    }
  }, [shouldRender, targetRect, viewport.w, viewport.h])

  const { cardX, cardY, cardW, cardH } = useMemo(() => {
    const cardW = 420
    const cardH = 190
    if (!shouldRender || !spot) {
      return { cardX: 12, cardY: 12, cardW, cardH }
    }

    const preferSideCoachmark = current?.id === "topbar" || current?.id === "year"

    const preferredAbove = spot.y > viewport.h * 0.45
    const placeAbove = preferredAbove && spot.y > cardH + 24

    // Default: above/below the target.
    let cardX = clamp(spot.cx - cardW / 2, 12, viewport.w - cardW - 12)
    let cardY = placeAbove
      ? clamp(spot.y - cardH - 22, 12, viewport.h - cardH - 12)
      : clamp(spot.y + spot.h + 22, 12, viewport.h - cardH - 12)

    // For steps 1–2, dock to the side of the highlighted control so the user can interact with it.
    if (preferSideCoachmark) {
      const gutter = 18 // ensure "not touching"

      // If a dropdown is open, use the union of (target + open menu) as the thing we're docking next to.
      const relevant = openOverlayRects.filter((r) => {
        const targetTop = spot.y
        const targetBottom = spot.y + spot.h
        const overlayTop = r.top
        const overlayBottom = r.top + r.height
        const overlaps = overlayBottom >= targetTop - 24 && overlayTop <= targetBottom + 24
        const overlayCx = r.left + r.width / 2
        const closeX = Math.abs(overlayCx - spot.cx) < 520
        return overlaps && closeX
      })

      const union = (() => {
        if (relevant.length === 0) {
          return { left: spot.x, right: spot.x + spot.w, top: spot.y, bottom: spot.y + spot.h }
        }
        let left = spot.x
        let right = spot.x + spot.w
        let top = spot.y
        let bottom = spot.y + spot.h
        for (const r of relevant) {
          left = Math.min(left, r.left)
          right = Math.max(right, r.left + r.width)
          top = Math.min(top, r.top)
          bottom = Math.max(bottom, r.top + r.height)
        }
        return { left, right, top, bottom }
      })()

      const rightX = union.right + gutter
      const leftX = union.left - cardW - gutter
      const sideY = clamp((union.top + union.bottom) / 2 - cardH / 2, 12, viewport.h - cardH - 12)

      const canRight = rightX + cardW <= viewport.w - 12
      const canLeft = leftX >= 12

      if (canRight) {
        cardX = rightX
        cardY = sideY
      } else if (canLeft) {
        cardX = leftX
        cardY = sideY
      }
    }

    return { cardX, cardY, cardW, cardH }
  }, [shouldRender, spot, viewport.w, viewport.h, current?.id, openOverlayRects])

  // Compute step-to-step “flight” deltas. We render at the new position (left/top),
  // then apply a transform animation from the previous position to the new one.
  const flight = (() => {
    if (!spot) return { spotDx: 0, spotDy: 0, cardDx: 0, cardDy: 0 }
    const spotCenter = { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 }
    const prevSpot = prevSpotCenterRef.current
    const spotDx = prevSpot ? prevSpot.x - spotCenter.x : 0
    const spotDy = prevSpot ? prevSpot.y - spotCenter.y : 0

    const prevCard = prevCardPosRef.current
    const cardDx = prevCard ? prevCard.x - cardX : 0
    const cardDy = prevCard ? prevCard.y - cardY : 0

    return { spotDx, spotDy, cardDx, cardDy }
  })()

  // Update previous positions after paint.
  useEffect(() => {
    if (!shouldRender) return
    if (spot) prevSpotCenterRef.current = { x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 }
    prevCardPosRef.current = { x: cardX, y: cardY }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRender, hopNonce, spot?.x, spot?.y, spot?.w, spot?.h, cardX, cardY])

  if (!shouldRender) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] pointer-events-none">
      {showWelcomeIntro ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
          <div className="pointer-events-auto w-full max-w-[560px]">
            <div
              className="rounded-2xl border border-border/60 bg-background/92 backdrop-blur-xl shadow-xl p-6 relative overflow-hidden"
              style={{
                boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
                animation: "riq-welcomeIn 520ms cubic-bezier(0.2,0.9,0.2,1) 1",
              }}
            >
              {/* subtle halo */}
              <div
                className="absolute inset-[-40px] opacity-60 pointer-events-none z-0"
                style={{
                  background:
                    "radial-gradient(closest-side at 50% 30%, rgba(99,102,241,0.22), rgba(99,102,241,0.08) 45%, rgba(0,0,0,0) 70%)",
                  filter: "blur(24px)",
                }}
              />

              {/* header row: logo mark + eyes */}
              {/* Watermark logo (subtle, premium) */}
              <div
                className="absolute inset-0 pointer-events-none z-[1]"
                style={{
                  WebkitMaskImage:
                    "radial-gradient(closest-side at 45% 40%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0) 80%)",
                  maskImage:
                    "radial-gradient(closest-side at 45% 40%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0) 80%)",
                }}
              >
                <Image
                  src="/x.png"
                  alt=""
                  aria-hidden="true"
                  fill
                  priority
                  className="object-contain p-10 opacity-[0.08] dark:hidden"
                  style={{ mixBlendMode: "soft-light", filter: "blur(1.25px)" }}
                />
                <Image
                  src="/Frame 11.png"
                  alt=""
                  aria-hidden="true"
                  fill
                  priority
                  className="object-contain p-10 opacity-[0.08] hidden dark:block"
                  style={{ mixBlendMode: "soft-light", filter: "blur(1.25px)" }}
                />
              </div>

              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="text-xs text-muted-foreground tracking-widest uppercase">Welcome</div>

                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-muted/60 border border-border/60 flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-background border border-border/60 relative overflow-hidden">
                      <div
                        ref={leftPupilRef}
                        className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-foreground"
                        style={{ transform: "translate3d(-50%,-50%,0)" }}
                      />
                    </div>
                  </div>
                  <div className="h-7 w-7 rounded-full bg-muted/60 border border-border/60 flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-background border border-border/60 relative overflow-hidden">
                      <div
                        ref={rightPupilRef}
                        className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-foreground"
                        style={{ transform: "translate3d(-50%,-50%,0)" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-4 space-y-2">
                <div className="text-2xl font-semibold">
                  {firstName ? `Hi ${firstName}!` : "Welcome to RegionIQ"}
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  Forward-looking economic intelligence for every region — compare peers, stress-test
                  scenarios, and move from question → evidence in minutes.
                </div>
              </div>

              <div className="relative z-10 mt-6 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowWelcomeIntro(false)
                    onOpenChange(false)
                    onFinish()
                  }}
                >
                  Skip
                </Button>
                <Button onClick={() => setShowWelcomeIntro(false)}>Start tour</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Animated focus box that tracks the target section. This does NOT block clicks. */}
      {!showWelcomeIntro && spot ? (
        <div
          className={cn(
            "absolute rounded-2xl",
            isFlying ? "" : "transition-[left,top,width,height] duration-300 ease-out"
          )}
          style={{
            left: spot.x,
            top: spot.y,
            width: spot.w,
            height: spot.h,
          }}
        >
          {/* Flight wrapper (keyed to step so the launch animation restarts) */}
          <div
            key={`flight-focus-${hopNonce}`}
            className="absolute inset-0"
            style={
              {
                "--dx": `${flight.spotDx}px`,
                "--dy": `${flight.spotDy}px`,
                animation: isFlying ? "riq-flight 680ms cubic-bezier(0.2, 0.9, 0.2, 1) 1" : undefined,
              } as React.CSSProperties
            }
          >
            {/* Border layer */}
            <div
              className={cn(
                "absolute inset-0 rounded-2xl border-2 border-primary/70",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_12px_55px_rgba(99,102,241,0.22)]"
              )}
              style={{ animation: "riq-focusFloat 2.6s ease-in-out infinite" }}
            />

            {/* Corner accents */}
            <div className="absolute -left-1.5 -top-1.5 h-4 w-4 rounded-sm border-2 border-primary/80 bg-background/70" />
            <div className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-sm border-2 border-primary/80 bg-background/70" />
            <div className="absolute -left-1.5 -bottom-1.5 h-4 w-4 rounded-sm border-2 border-primary/80 bg-background/70" />
            <div className="absolute -right-1.5 -bottom-1.5 h-4 w-4 rounded-sm border-2 border-primary/80 bg-background/70" />

            {/* Soft trailing glow */}
            <div
              className="absolute inset-[-10px] rounded-[22px] opacity-50"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(99,102,241,0.25), rgba(99,102,241,0.08) 45%, rgba(0,0,0,0) 75%)",
                filter: "blur(18px)",
              }}
            />

            {/* A subtle “streak” during flight to sell the motion (no spinners). */}
            {isFlying ? (
              <div
                className="absolute inset-[-18px] rounded-[26px] opacity-30"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(99,102,241,0), rgba(99,102,241,0.22), rgba(99,102,241,0))",
                  filter: "blur(16px)",
                  animation: "riq-streak 680ms ease-out 1",
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Coachmark card */}
      {!showWelcomeIntro ? (
      <div
        className="absolute pointer-events-auto transition-[left,top] duration-500 ease-out"
        style={{
          left: cardX,
          top: cardY,
          width: cardW,
        }}
      >
        <div
          key={`card-flight-${hopNonce}`}
          className="relative"
          style={
            {
              "--dx": `${flight.cardDx}px`,
              "--dy": `${flight.cardDy}px`,
              animation: isFlying ? "riq-flight 680ms cubic-bezier(0.2, 0.9, 0.2, 1) 1" : undefined,
            } as React.CSSProperties
          }
        >
          <div
            className={cn(
              "rounded-2xl border border-border/60 bg-background/92 backdrop-blur-xl shadow-xl",
              "p-4",
              "animate-in fade-in-0 zoom-in-95 duration-300"
            )}
            style={{
              boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
              animation: "riq-cardFloat 3.2s ease-in-out infinite",
            }}
          >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Take a tour • Step {stepIdx + 1} / {steps.length}
              </div>
              <div className="text-lg font-semibold leading-tight">{current?.title}</div>
              <div className="text-sm text-muted-foreground">{current?.description}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {steps.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStepIdx(idx)}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-all",
                    idx === stepIdx ? "bg-primary shadow-[0_0_0_3px_rgba(99,102,241,0.18)]" : "bg-muted"
                  )}
                  aria-label={`Go to step ${idx + 1}: ${s.title}`}
                />
              ))}
            </div>

            <div className="flex-1" />

            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip
            </Button>
            <Button variant="outline" size="sm" onClick={handleBack} disabled={isFirst}>
              Back
            </Button>
            <Button size="sm" onClick={handleNext}>
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
          </div>
        </div>
      </div>
      ) : null}

      <style jsx global>{`
        @keyframes riq-welcomeIn {
          0% {
            transform: translate3d(0, 10px, 0) scale(0.985);
            opacity: 0;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 1;
          }
        }
        @keyframes riq-flight {
          0% {
            transform: translate3d(var(--dx), var(--dy), 0) scale(0.96) rotate(-0.12deg);
            opacity: 0.85;
          }
          45% {
            transform: translate3d(calc(var(--dx) * -0.08), calc(var(--dy) * -0.08), 0) scale(1.03) rotate(0.16deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes riq-streak {
          0% {
            transform: scaleX(0.72);
            opacity: 0;
          }
          35% {
            transform: scaleX(1.18);
            opacity: 0.5;
          }
          100% {
            transform: scaleX(1);
            opacity: 0;
          }
        }
        @keyframes riq-hop {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            filter: brightness(1);
          }
          45% {
            transform: translate3d(0, -10px, 0) scale(1.015);
            filter: brightness(1.03);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
            filter: brightness(1);
          }
        }
        @keyframes riq-focusFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
            opacity: 0.95;
          }
          50% {
            transform: translate3d(0, -3px, 0) rotate(0.08deg) scale(1.003);
            opacity: 1;
          }
        }
        @keyframes riq-cardFloat {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(-0.08deg);
          }
          50% {
            transform: translate3d(0, -4px, 0) rotate(0.08deg);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}


