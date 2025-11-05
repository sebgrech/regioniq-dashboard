"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Crumb {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center">
          {idx > 0 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/70" />}
          {item.href ? (
            <Link href={item.href} className={cn("hover:text-foreground transition-colors")}>
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}
