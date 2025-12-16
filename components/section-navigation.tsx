"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface SectionNavigationProps {
  isMapFullscreen?: boolean
  region?: string
  year?: number
  scenario?: string
}

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "compare", label: "Compare Regions" },
  { id: "map", label: "Map" },
  { id: "movers", label: "Movers" },
  { id: "analysis", label: "Analysis" },
] as const

export function SectionNavigation({ 
  isMapFullscreen = false,
  region,
  year,
  scenario,
}: SectionNavigationProps) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<string>("overview")
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Scrollspy: detect which section is in view
  useEffect(() => {
    if (isMapFullscreen) return

    const observerOptions = {
      root: null,
      rootMargin: "-150px 0px -60% 0px", // Trigger when section is ~150px from top (accounting for sticky nav)
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      // Find sections that are currently intersecting
      const intersectingEntries = entries.filter((entry) => entry.isIntersecting)

      if (intersectingEntries.length === 0) {
        // If nothing is intersecting, check scroll position
        const scrollY = window.scrollY
        const viewportHeight = window.innerHeight

        // Find which section is closest to the top of the viewport
        let closestSection = "overview"
        let closestDistance = Infinity

      SECTIONS.forEach((section) => {
        if (section.id === "compare") return // Skip compare section in scroll detection
        const element = document.getElementById(section.id)
        if (element) {
          const rect = element.getBoundingClientRect()
          const distance = Math.abs(rect.top - 150) // 150px accounts for sticky nav

          if (distance < closestDistance && rect.top < viewportHeight) {
            closestDistance = distance
            closestSection = section.id
          }
        }
      })

        setActiveSection(closestSection)
        return
      }

      // If multiple sections are intersecting, choose the one closest to the top
      const sortedEntries = intersectingEntries.sort(
        (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
      )

      // Prefer the section that's at or above the trigger point (150px from top)
      const topEntry = sortedEntries.find((entry) => entry.boundingClientRect.top <= 150)

      if (topEntry) {
        setActiveSection(topEntry.target.id)
      } else if (sortedEntries.length > 0) {
        // If no section is at the top, use the first one (closest to top)
        setActiveSection(sortedEntries[0].target.id)
      }
    }

    observerRef.current = new IntersectionObserver(handleIntersection, observerOptions)

    // Observe all sections (except "compare" which navigates to a different page)
    SECTIONS.forEach((section) => {
      if (section.id === "compare") return // Skip observing compare section
      const element = document.getElementById(section.id)
      if (element && observerRef.current) {
        observerRef.current.observe(element)
      }
    })

    // Also listen to scroll events for more accurate detection
    const handleScroll = () => {
      const scrollY = window.scrollY
      const viewportHeight = window.innerHeight

      let activeId = "overview"
      let minDistance = Infinity

      SECTIONS.forEach((section) => {
        if (section.id === "compare") return // Skip compare section in scroll detection
        const element = document.getElementById(section.id)
        if (element) {
          const rect = element.getBoundingClientRect()
          const distance = Math.abs(rect.top - 150)

          // Section is in viewport and closer to the trigger point
          if (rect.top < viewportHeight && rect.bottom > 0 && distance < minDistance) {
            minDistance = distance
            activeId = section.id
          }
        }
      })

      setActiveSection(activeId)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      window.removeEventListener("scroll", handleScroll)
    }
  }, [isMapFullscreen])

  const handleClick = (sectionId: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    
    // Special case: "Compare Regions" navigates to the compare page
    if (sectionId === "compare") {
      const params = new URLSearchParams()
      // Use canonical compare params so the compare page loads populated.
      if (region) params.set("regions", region)
      if (year) params.set("year", year.toString())
      if (scenario) params.set("scenario", scenario)
      router.push(`/compare?${params.toString()}`)
      return
    }
    
    // For other sections, scroll to the element
    const element = document.getElementById(sectionId)
    if (element) {
      // Calculate offset: toolbar height (~104px) + navigation height (~48px) + some padding
      const headerOffset = 160
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      })
    }
  }

  // Don't render if map is fullscreen
  if (isMapFullscreen) return null

  return (
    <nav className="sticky top-[104px] z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.id
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(e) => handleClick(section.id, e)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap rounded-md",
                  "hover:text-foreground hover:bg-accent/50",
                  isActive
                    ? "text-foreground bg-accent/30"
                    : "text-muted-foreground hover:text-foreground/80"
                )}
              >
                {section.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

