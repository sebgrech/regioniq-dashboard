"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface SectionNavigationProps {
  isMapFullscreen?: boolean
}

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "map", label: "Map" },
  { id: "actions", label: "Actions" },
  { id: "analysis", label: "Insight" },
  { id: "roadmap", label: "Roadmap" },
  { id: "contribute", label: "Contribute" },
] as const

export function SectionNavigation({ 
  isMapFullscreen = false,
}: SectionNavigationProps) {
  const [activeSection, setActiveSection] = useState<string>("overview")
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Scrollspy: detect which section is in view
  useEffect(() => {
    if (isMapFullscreen) return

    const observerOptions = {
      root: null,
      rootMargin: "-130px 0px -60% 0px", // Trigger when section is ~130px from top (accounting for sticky nav)
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
          const distance = Math.abs(rect.top - 130) // 130px accounts for sticky nav

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

      // Prefer the section that's at or above the trigger point (130px from top)
      const topEntry = sortedEntries.find((entry) => entry.boundingClientRect.top <= 130)

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
          const distance = Math.abs(rect.top - 130)

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
    
    // Scroll to the section
    const element = document.getElementById(sectionId)
    if (element) {
      // Calculate offset: toolbar height (~88px) + navigation height (~48px) + some padding
      const headerOffset = 140
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
    <nav className="sticky top-[88px] z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
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
                  "relative px-4 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap rounded-md",
                  "hover:text-foreground hover:bg-accent/50",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80"
                )}
              >
                {section.label}
                {/* Sliding underline with scale animation */}
                <span 
                  className={cn(
                    "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full",
                    "transition-all duration-300 ease-out",
                    isActive 
                      ? "w-8 opacity-100 scale-x-100" 
                      : "w-0 opacity-0 scale-x-0"
                )}
                />
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

