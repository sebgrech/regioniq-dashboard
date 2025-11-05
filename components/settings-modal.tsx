"use client"

import { useState, useEffect } from "react"
import { SettingsIcon, X, Palette, Database, Bell, Keyboard } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useHotkeys } from "react-hotkeys-hook"
import { REGIONS } from "@/lib/metrics.config"

interface RegionIQSettings {
  numberFormat: "abbreviated" | "full"
  decimals: 0 | 1 | 2
  defaultScenario: "baseline" | "upside" | "downside"
  favoriteRegions: string[]
  theme: "dark" | "light"
  autoRefresh: boolean
}

const defaultSettings: RegionIQSettings = {
  numberFormat: "abbreviated",
  decimals: 1,
  defaultScenario: "baseline",
  favoriteRegions: [],
  theme: "dark",
  autoRefresh: false,
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        setStoredValue(JSON.parse(item))
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
    }
  }, [key])

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue] as const
}

export function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useLocalStorage("regioniq-settings", defaultSettings)

  // Global hotkey to open settings
  useHotkeys("s", () => setIsOpen(true), { preventDefault: true })

  const updateSetting = <K extends keyof RegionIQSettings>(key: K, value: RegionIQSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const addFavoriteRegion = (regionCode: string) => {
    if (!settings.favoriteRegions.includes(regionCode)) {
      updateSetting("favoriteRegions", [...settings.favoriteRegions, regionCode])
    }
  }

  const removeFavoriteRegion = (regionCode: string) => {
    updateSetting(
      "favoriteRegions",
      settings.favoriteRegions.filter((r) => r !== regionCode),
    )
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>Customize your RegionIQ dashboard experience</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Display Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <h3 className="text-sm font-medium">Display</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numberFormat" className="text-xs">
                  Number Format
                </Label>
                <Select
                  value={settings.numberFormat}
                  onValueChange={(value: "abbreviated" | "full") => updateSetting("numberFormat", value)}
                >
                  <SelectTrigger id="numberFormat" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abbreviated">Abbreviated (1.2M)</SelectItem>
                    <SelectItem value="full">Full (1,200,000)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="decimals" className="text-xs">
                  Decimal Places
                </Label>
                <Select
                  value={settings.decimals.toString()}
                  onValueChange={(value) => updateSetting("decimals", Number.parseInt(value) as 0 | 1 | 2)}
                >
                  <SelectTrigger id="decimals" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 (1M)</SelectItem>
                    <SelectItem value="1">1 (1.2M)</SelectItem>
                    <SelectItem value="2">2 (1.23M)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme" className="text-xs">
                Theme
              </Label>
              <Select value={settings.theme} onValueChange={(value: "dark" | "light") => updateSetting("theme", value)}>
                <SelectTrigger id="theme" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Data Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <h3 className="text-sm font-medium">Data</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultScenario" className="text-xs">
                Default Scenario
              </Label>
              <Select
                value={settings.defaultScenario}
                onValueChange={(value: "baseline" | "upside" | "downside") => updateSetting("defaultScenario", value)}
              >
                <SelectTrigger id="defaultScenario" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baseline">Baseline</SelectItem>
                  <SelectItem value="upside">Upside</SelectItem>
                  <SelectItem value="downside">Downside</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs">Auto Refresh</Label>
                <p className="text-xs text-muted-foreground">Automatically refresh data every 5 minutes</p>
              </div>
              <Switch
                checked={settings.autoRefresh}
                onCheckedChange={(checked) => updateSetting("autoRefresh", checked)}
              />
            </div>
          </div>

          <Separator />

          {/* Favorite Regions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <h3 className="text-sm font-medium">Favorite Regions</h3>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Quick Access Regions</Label>
              <div className="flex flex-wrap gap-2">
                {settings.favoriteRegions.map((regionCode) => {
                  const region = REGIONS.find((r) => r.code === regionCode)
                  return (
                    <Badge
                      key={regionCode}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeFavoriteRegion(regionCode)}
                    >
                      {region?.name || regionCode}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  )
                })}
                {settings.favoriteRegions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No favorite regions selected</p>
                )}
              </div>
            </div>

            <Select onValueChange={addFavoriteRegion}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Add favorite region..." />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.filter((r) => !settings.favoriteRegions.includes(r.code)).map((region) => (
                  <SelectItem key={region.code} value={region.code}>
                    {region.name} ({region.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Keyboard Shortcuts */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              <h3 className="text-sm font-medium">Keyboard Shortcuts</h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Open Settings</span>
                <Badge variant="outline" className="text-xs">
                  S
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Export Data</span>
                <Badge variant="outline" className="text-xs">
                  E
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Compare Regions</span>
                <Badge variant="outline" className="text-xs">
                  C
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={resetSettings} size="sm">
            Reset to Defaults
          </Button>
          <Button onClick={() => setIsOpen(false)} size="sm">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
