"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Copy, 
  Check, 
  Key, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Terminal, 
  BookOpen, 
  ArrowLeft,
  ExternalLink,
  Shield,
  X
} from "lucide-react"
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

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: "error" | "success"; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-bottom-4 ${
      type === "error" 
        ? "bg-destructive/10 border-destructive/20 text-destructive" 
        : "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
    }`}>
      {type === "error" ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function DevelopersPage() {
  const router = useRouter()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyEnv, setNewKeyEnv] = useState<"production" | "sandbox">("production")
  const [showNewKey, setShowNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null)

  const showToast = (message: string, type: "error" | "success") => {
    setToast({ message, type })
  }

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/keys")
      if (!res.ok) throw new Error("Failed to fetch keys")
      const data = await res.json()
      setKeys(data.keys || [])
    } catch (e) {
      console.error("Failed to fetch keys:", e)
      showToast("Failed to load API keys. Please refresh the page.", "error")
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
      if (!res.ok) throw new Error("Failed to create key")
      const data = await res.json()
      if (data.key) {
        setShowNewKey(data.key)
        setNewKeyName("")
        fetchKeys()
        showToast("API key created successfully", "success")
      }
    } catch (e) {
      console.error("Failed to create key:", e)
      showToast("Failed to create API key. Please try again.", "error")
    } finally {
      setCreating(false)
    }
  }

  const confirmRevoke = (key: ApiKey) => {
    setKeyToRevoke(key)
    setRevokeDialogOpen(true)
  }

  const revokeKey = async () => {
    if (!keyToRevoke) return
    try {
      const res = await fetch(`/api/developer/keys?id=${keyToRevoke.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to revoke key")
      fetchKeys()
      showToast("API key revoked successfully", "success")
    } catch (e) {
      console.error("Failed to revoke key:", e)
      showToast("Failed to revoke API key. Please try again.", "error")
    } finally {
      setRevokeDialogOpen(false)
      setKeyToRevoke(null)
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyCurlCommand = async (apiKey: string) => {
    const curl = `curl -X POST https://api.regioniq.io/api/v1/observations/query \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": [
      {"code": "metric", "selection": {"filter": "item", "values": ["population_total"]}},
      {"code": "region", "selection": {"filter": "item", "values": ["UKI"]}}
    ],
    "response": {"format": "records"},
    "limit": 10
  }'`
    await navigator.clipboard.writeText(curl)
    setCopiedCurl(true)
    setTimeout(() => setCopiedCurl(false), 2000)
  }

  const closeNewKeyDialog = () => {
    setShowNewKey(null)
    setDialogOpen(false)
  }

  const formatKeyPrefix = (env: "production" | "sandbox") => {
    return env === "production" ? "riq_live_" : "riq_test_"
  }

  const activeKeys = keys.filter((k) => k.is_active)
  const revokedKeys = keys.filter((k) => !k.is_active)

  return (
    <div className="min-h-screen bg-background">
      {/* Toast notifications */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Sticky top nav — logo + title + back (matches Portfolio page pattern) */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* RegionIQ logo */}
            <a href="https://regioniq.io" className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 flex-shrink-0">
                <Image
                  src="/x.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/Frame 11.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight">RegionIQ</span>
            </a>

            <div className="h-6 w-px bg-border/60" />

            {/* Page title */}
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <span className="text-lg font-semibold text-foreground">Developer Portal</span>
            </div>
          </div>

          {/* Back to dashboard */}
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Developer Portal</h1>
              <p className="text-muted-foreground mt-0.5">
                Create and manage API keys to access RegionIQ data programmatically.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">1</div>
                <span>Generate an API key below</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">2</div>
                <span>Copy the key immediately — it won't be shown again</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">3</div>
                <span>Use it in your requests with the <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Authorization</code> header</span>
              </div>
            </div>
            <pre className="mt-4 p-4 bg-zinc-950 text-zinc-100 rounded-xl overflow-x-auto text-xs font-mono border border-zinc-800 shadow-inner">
{`curl -X POST https://api.regioniq.io/api/v1/observations/query \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": [
      {"code": "metric", "selection": {"filter": "item", "values": ["population_total"]}},
      {"code": "region", "selection": {"filter": "item", "values": ["UKI"]}}
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
            <Button size="lg" className="mb-6 gap-2 shadow-sm" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Generate API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
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
                    Copy your API key now. For security, it will never be shown again.
                  </DialogDescription>
                </DialogHeader>
                <div className="my-4 space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Your API Key</Label>
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
                  </div>
                  
                  {/* Copy curl button */}
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => copyCurlCommand(showNewKey)}
                  >
                    {copiedCurl ? <Check className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                    {copiedCurl ? "Copied!" : "Copy curl command"}
                  </Button>

                  <div className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Store this key securely. We only store a hash and cannot recover it.</span>
                  </div>
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
                            <span className="text-xs text-muted-foreground ml-1">riq_live_</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="sandbox">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            Sandbox
                            <span className="text-xs text-muted-foreground ml-1">riq_test_</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Sandbox keys have lower rate limits. Use for development.
                    </p>
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

        {/* Revoke Confirmation Dialog */}
        <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Revoke API Key
              </DialogTitle>
              <DialogDescription>
                This will immediately disable the key <strong className="text-foreground">{keyToRevoke?.partner_name}</strong>. 
                Any applications using this key will stop working immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-sm text-destructive">
                This action cannot be undone. You'll need to create a new key and update your applications.
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={revokeKey}>
                Revoke Key
              </Button>
            </DialogFooter>
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Loading keys...
              </div>
            ) : activeKeys.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
                  <Key className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No active keys yet</p>
                <p className="text-xs text-muted-foreground mt-1">Generate your first API key to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-start justify-between p-4 border rounded-xl bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{key.partner_name}</span>
                        <Badge 
                          variant={key.environment === "production" ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {key.environment === "production" ? (
                            <><div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5" />Production</>
                          ) : (
                            <><div className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />Sandbox</>
                          )}
                        </Badge>
                      </div>
                      
                      {/* Key prefix */}
                      <div className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded inline-block">
                        {formatKeyPrefix(key.environment)}••••••••••••
                      </div>
                      
                      {/* Scopes */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Scopes:</span>
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="outline" className="text-xs font-mono">
                            {scope}
                          </Badge>
                        ))}
                      </div>

                      {/* Metadata */}
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                        {key.last_used_at && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 ml-4"
                      onClick={() => confirmRevoke(key)}
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
          <Card className="opacity-60 mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Revoked Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {revokedKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="line-through">{key.partner_name}</span>
                    <Badge variant="outline" className="text-xs">revoked</Badge>
                    <span className="font-mono text-xs opacity-50">{formatKeyPrefix(key.environment)}••••</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* API Documentation Link */}
        <div className="mt-8 pt-8 border-t">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-medium">Need help?</h3>
              <p className="text-sm text-muted-foreground">
                Check out the interactive API documentation for endpoints and examples.
              </p>
            </div>
            <Button variant="outline" asChild className="gap-2">
              <a 
                href="https://api.regioniq.io/docs" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <BookOpen className="w-4 h-4" />
                API Documentation
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
