"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Key, LogOut, ChevronDown, User } from "lucide-react"

interface UserMenuProps {
  email: string | null | undefined
  apiAccess?: boolean // If false, hide API Keys menu item
}

export function UserMenu({ email, apiAccess = true }: UserMenuProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/")
      router.refresh()
    } catch (e) {
      console.error("Failed to sign out:", e)
      setIsLoggingOut(false)
    }
  }

  // Get initials for avatar
  const initials = email
    ? email
        .split("@")[0]
        .split(/[._-]/)
        .map((part) => part[0]?.toUpperCase() || "")
        .slice(0, 2)
        .join("")
    : "?"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-muted-foreground hover:text-foreground"
        >
          {/* Initials avatar */}
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {initials}
          </div>
          <span className="hidden sm:inline max-w-[120px] truncate text-sm">
            {email?.split("@")[0] || "Account"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium truncate">{email || "Unknown"}</p>
          </div>
        </DropdownMenuLabel>
        {apiAccess !== false && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => router.push("/developers")}
            >
              <Key className="h-4 w-4" />
              API Keys
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
          onClick={handleSignOut}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

