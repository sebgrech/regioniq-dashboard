"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Key, Plus, Trash2, AlertTriangle, Terminal, BookOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ApiKey {
  id: string
  partner_name: string
  environment: "production" | "sandbox"
  scopes: string[]
  created_at: string
  last_used_at: string | null
  is_active: boolean
}

export default function DevelopersPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyEnv, setNewKeyEnv] = useState<"production" | "sandbox">("production")
  const [showNewKey, setShowNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/keys")
      const data = await res.json()
      setKeys(data.keys || [])
    } catch (e) {
      console.error("Failed to fetch keys:", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const createKey = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim(), environment: newKeyEnv }),
      })
      const data = await res.json()
      if (data.key) {
        setShowNewKey(data.key)
        setNewKeyName("")
        fetchKeys()
      }
    } catch (e) {
      console.error("Failed to create key:", e)
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (id: string) => {
    try {
      await fetch(`/api/developer/keys?id=${id}`, { method: "DELETE" })
      fetchKeys()
    } catch (e) {
      console.error("Failed to revoke key:", e)
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeNewKeyDialog = () => {
    setShowNewKey(null)
    setDialogOpen(false)
  }

  const activeKeys = keys.filter((k) => k.is_active)
  const revokedKeys = keys.filter((k) => !k.is_active)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl py-12 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Developer Portal</h1>
          </div>
          <p className="text-muted-foreground">
            Create and manage API keys to access the RegionIQ Data API programmatically.
          </p>
        </div>

        {/* Quick Start */}
        <Card className="mb-8 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">1</Badge>
              <span>Generate an API key below</span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">2</Badge>
              <span>Copy the key immediately (it won't be shown again)</span>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0">3</Badge>
              <span>Use it in your requests:</span>
            </div>
            <pre className="mt-2 p-4 bg-zinc-950 text-zinc-100 rounded-lg overflow-x-auto text-xs font-mono border border-zinc-800">
{`curl -X POST https://api.regioniq.io/api/v1/observations/query \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": [
      {"code": "metric_id", "selection": {"filter": "item", "values": ["population_total"]}},
      {"code": "region_code", "selection": {"filter": "item", "values": ["UKI"]}}
    ],
    "response": {"format": "records"},
    "limit": 10
  }'`}
            </pre>
          </CardContent>
        </Card>

        {/* Create Key Dialog */}
        <Dialog open={dialogOpen || !!showNewKey} onOpenChange={(open) => {
          if (!open) closeNewKeyDialog()
          else setDialogOpen(open)
        }}>
          <DialogTrigger asChild>
            <Button size="lg" className="mb-6" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Generate API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            {showNewKey ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-green-500/10">
                      <Check className="w-4 h-4 text-green-500" />
                    </div>
                    API Key Created
                  </DialogTitle>
                  <DialogDescription>
                    Copy your API key now. For security, it will not be shown again.
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4">
                  <div className="flex items-center gap-2">
                    <Input 
                      value={showNewKey} 
                      readOnly 
                      className="font-mono text-sm bg-muted"
                    />
                    <Button 
                      size="icon" 
                      variant={copied ? "default" : "outline"}
                      onClick={() => copyToClipboard(showNewKey)}
                      className="shrink-0"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1.5 p-2 bg-amber-500/10 rounded-md">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Store this key securely. We only store a hash and cannot recover it.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={closeNewKeyDialog} className="w-full sm:w-auto">
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Generate New API Key</DialogTitle>
                  <DialogDescription>
                    Create a new key to access the RegionIQ Data API.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Key Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Production Backend, Research Script"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && newKeyName.trim() && createKey()}
                    />
                    <p className="text-xs text-muted-foreground">
                      A descriptive name to identify this key later.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="env">Environment</Label>
                    <Select value={newKeyEnv} onValueChange={(v) => setNewKeyEnv(v as "production" | "sandbox")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Production
                          </div>
                        </SelectItem>
                        <SelectItem value="sandbox">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            Sandbox
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
                    {creating ? "Creating..." : "Generate Key"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Active Keys */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="w-5 h-5" />
              Active Keys
            </CardTitle>
            <CardDescription>
              Keys currently able to access the API
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Loading keys...
              </div>
            ) : activeKeys.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                  <Key className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No active keys yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Generate your first API key above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{key.partner_name}</span>
                        <Badge 
                          variant={key.environment === "production" ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {key.environment}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                        {key.last_used_at && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-2"
                      onClick={() => revokeKey(key.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revoked Keys */}
        {revokedKeys.length > 0 && (
          <Card className="opacity-60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Revoked Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {revokedKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="line-through">{key.partner_name}</span>
                    <Badge variant="outline" className="text-xs">revoked</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Documentation Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Need help? View the{" "}
            <a 
              href="https://api.regioniq.io/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              API Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

