// src/app/admin/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger
} from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Trash2, Download } from "lucide-react"

// ---------------------------------- Utils ----------------------------------
function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin
  return process.env.NEXT_PUBLIC_BASE_URL || ""
}
function getShareUrl(access_token?: string) {
  if (!access_token) return ""
  const base = process.env.NEXT_PUBLIC_BASE_URL || getBaseUrl()
  return `${base}/w/${access_token}`
}
function toIsoDate(d: string | null | undefined) {
  if (!d) return undefined
  try { return new Date(d).toISOString() } catch { return undefined }
}

// ---------------------------------- Admin Login ----------------------------------
function AdminLogin({ onOk }: { onOk: () => void }) {
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (r.ok) onOk()
    else setErr('סיסמה שגויה')
  }

  return (
    <div className="max-w-md mx-auto">
      <Card className="border border-line shadow-sm">
        <CardHeader>
          <CardTitle>כניסת מנהל</CardTitle>
          <CardDescription>הזן את סיסמת המנהל כדי להמשיך</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="admin-pass" className="font-semibold">סיסמה</Label>
            <Input id="admin-pass" type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {err && (
            <Alert variant="destructive">
              <AlertTitle>שגיאה</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={submit} disabled={!password.trim()}>כניסה</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// ---------------------------------- Page ----------------------------------
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [list, setList] = useState<any[]>([])
  const [workshopsOptions, setWorkshopsOptions] = useState<any[]>([])

  // ---------------- Filters (Registrations) ----------------
  const [fWorkshop, setFWorkshop] = useState<string>('all')
  const [fStatus, setFStatus] = useState<'all'|'pending'|'confirmed'|'cancelled'>('all')
  const [fPaid, setFPaid] = useState<'all'|'paid'|'unpaid'>('all')
  const [fFrom, setFFrom] = useState<string>('')    // created_at from
  const [fTo, setFTo] = useState<string>('')        // created_at to

  const filtersQS = useMemo(() => {
    const p = new URLSearchParams()
    if (fWorkshop !== 'all') p.set('workshop_id', fWorkshop)
    if (fStatus !== 'all') p.set('status', fStatus)
    if (fPaid !== 'all') p.set('paid', fPaid === 'paid' ? 'true' : 'false')
    if (fFrom) p.set('from', fFrom)  // yyyy-mm-dd
    if (fTo) p.set('to', fTo)
    return p.toString()
  }, [fWorkshop, fStatus, fPaid, fFrom, fTo])

  const loadWorkshops = async () => {
    const r = await fetch('/api/admin/workshops')
    if (r.status === 401) { setAuthed(false); return }
    const j = await r.json()
    setAuthed(true)
    setList(j.data || [])
    setWorkshopsOptions(j.data || [])
  }

  useEffect(() => { loadWorkshops() }, [])

  if (!authed) return <AdminLogin onOk={loadWorkshops} />

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold mb-1">ניהול סדנאות</h1>
        <p className="text-sm text-muted-foreground">פתח סדנה חדשה, נהל זמינות וצפה ברישומים</p>
      </div>

      <WorkshopForm onCreated={loadWorkshops} />

      <Card className="border border-line">
        <CardHeader>
          <CardTitle>סדנאות פעילות</CardTitle>
          <CardDescription>הפעל/השבת, עדכן פרטים או מחק סדנה</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {list.length === 0 && <div className="text-sm text-muted-foreground">אין סדנאות עדיין.</div>}
          {list.map((w) => <WorkshopRow key={w.id} w={w} onChanged={loadWorkshops} />)}
        </CardContent>
      </Card>

      <RegistrationsBlock
        workshopsOptions={workshopsOptions}
        filtersQS={filtersQS}
        fWorkshop={fWorkshop} setFWorkshop={setFWorkshop}
        fStatus={fStatus} setFStatus={setFStatus}
        fPaid={fPaid} setFPaid={setFPaid}
        fFrom={fFrom} setFFrom={setFFrom}
        fTo={fTo} setFTo={setFTo}
      />
    </div>
  )
}

// ---------------------------------- Workshop Form ----------------------------------
function WorkshopForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [capacity, setCapacity] = useState<number>(20)
  const [price, setPrice] = useState<number>(450)
  const [paymentLink, setPaymentLink] = useState("")
  const [active, setActive] = useState(true)
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>("")

  const submit = async () => {
    setBusy(true)
    setErr("")
    try {
      if (!title || !date || !time) {
        setErr("יש למלא כותרת, תאריך ושעה")
        setBusy(false)
        return
      }
      const event_at = new Date(`${date}T${time}:00`)
      const r = await fetch("/api/admin/workshops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, event_at, capacity,
          price, payment_link: paymentLink || null,
          is_active: active, is_public: isPublic,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j?.error || "שגיאה ביצירת סדנה")
      }
      // reset
      setTitle(""); setDescription(""); setDate(""); setTime("")
      setCapacity(20); setPrice(450); setPaymentLink(""); setActive(true)
      onCreated()
    } catch (e: any) {
      setErr(e?.message || "שגיאה בלתי צפויה")
    } finally { setBusy(false) }
  }

  return (
    <Card className="border border-line shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl">פתיחת סדנה חדשה</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          מלא את פרטי הסדנה. שדות חובה: כותרת, תאריך ושעה.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="font-semibold">כותרת</Label>
              <Input id="title" placeholder="סדנת עישון בשרים" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="font-semibold">תאריך</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time" className="font-semibold">שעה</Label>
                <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-semibold">תיאור</Label>
            <Textarea id="description" rows={3} placeholder="מה נלמד? אילו נתחים נטעם?…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <Label htmlFor="capacity" className="font-semibold">קיבולת</Label>
              <Input id="capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value || 0))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price" className="font-semibold">מחיר (ש"ח)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(Math.max(0, Math.floor(Number(e.target.value || 0))))}
              />
              <div className="text-xs text-muted-foreground">
                יוצג לציבור כ־{price.toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="isPublic" checked={isPublic} onCheckedChange={v => setIsPublic(Boolean(v))} />
              <Label htmlFor="isPublic">פומבית</Label>
            </div>

            <div className="flex items-center gap-3 md:justify-start justify-between">
              <Switch id="active" checked={active} onCheckedChange={(v) => setActive(Boolean(v))} />
              <Label htmlFor="active" className="cursor-pointer">פעיל</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment" className="font-semibold">קישור תשלום (אופציונלי)</Label>
            <Input id="payment" placeholder="https://pay.example.com/..." value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} inputMode="url" />
            <div className="text-xs text-muted-foreground">אם מולא — יוצג למשתמש לאחר הרשמה.</div>
          </div>

          {err && (
            <Alert variant="destructive">
              <AlertTitle>שגיאה</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={submit} disabled={busy || !title || !date || !time}>
          {busy ? "שומר…" : "יצירה"}
        </Button>
      </CardFooter>
    </Card>
  )
}

// ---------------------------------- Workshop Row (כמו קודם) ----------------------------------
function WorkshopRow({ w, onChanged }: { w: any, onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [copied, setCopied] = useState(false)

  const toggleActive = async () => {
    setBusy(true)
    await fetch(`/api/admin/workshops/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !w.is_active })
    })
    setBusy(false)
    onChanged()
  }

  const remove = async () => {
    setBusy(true)
    await fetch(`/api/admin/workshops/${w.id}`, { method: 'DELETE' })
    setBusy(false)
    setOpenDelete(false)
    onChanged()
  }

  const copyShareLink = async () => {
    const url = getShareUrl(w.access_token)
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="border border-line">
      <CardContent className="py-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-semibold">{w.title}</div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={w.is_active ? "default" : "secondary"}>
                {w.is_active ? "פעילה" : "מושבתת"}
              </Badge>

              {!w.is_public && (
                <>
                  <Badge variant="outline">פרטית</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyShareLink}
                    title="העתקת קישור שיתוף"
                  >
                    {copied ? "הועתק ✓" : "העתק קישור"}
                  </Button>
                </>
              )}

              <div className="text-sm text-muted-foreground">
                פנויות: {w.seats_left} / {w.capacity}
              </div>
            </div>

          </div>
          <div className="text-sm text-muted-foreground">{new Date(w.event_at).toLocaleString('he-IL')}</div>
          <div className="flex flex-wrap items-center gap-3 justify-end pt-2">
            <Dialog open={openEdit} onOpenChange={setOpenEdit}>
              <DialogTrigger asChild>
                <Button variant="secondary">עריכה</Button>
              </DialogTrigger>
              <WorkshopEditDialog
                open={openEdit}
                onClose={() => setOpenEdit(false)}
                w={w}
                onSaved={() => { setOpenEdit(false); onChanged() }}
              />
            </Dialog>

            <div className="flex items-center gap-2">
              <Switch checked={w.is_active} onCheckedChange={toggleActive} disabled={busy} />
              <span className="text-sm">פעיל</span>
            </div>

            <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy}>מחיקה</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>למחוק את הסדנה?</AlertDialogTitle>
                  <AlertDialogDescription>
                    פעולה זו בלתי הפיכה ותסיר גם את כל הרישומים המשויכים.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ביטול</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">מחק</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------- Workshop Edit Dialog (כמו קודם) ----------------------------------
function WorkshopEditDialog({
  open, onClose, w, onSaved
}: { open: boolean, onClose: () => void, w: any, onSaved: () => void }) {
  const [title, setTitle] = useState(w.title ?? "")
  const [description, setDescription] = useState(w.description ?? "")
  const [date, setDate] = useState(() => new Date(w.event_at).toISOString().slice(0, 10))
  const [time, setTime] = useState(() => new Date(w.event_at).toTimeString().slice(0, 5))
  const [capacity, setCapacity] = useState<number>(w.capacity ?? 0)
  const [price, setPrice] = useState<number>(w.price ?? 0)
  const [isPublic, setIsPublic] = useState(!!w.is_public)
  const [paymentLink, setPaymentLink] = useState<string>(w.payment_link ?? "")
  const [copiedShare, setCopiedShare] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>("")

  const save = async () => {
    setBusy(true); setErr("")
    try {
      const event_at = new Date(`${date}T${time}:00`)
      const r = await fetch(`/api/admin/workshops/${w.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, event_at, capacity, price,
          payment_link: paymentLink || null, is_public: isPublic
        })

      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j?.error || "שגיאה בשמירה")
      }
      onSaved()
    } catch (e: any) {
      setErr(e?.message || "שגיאה בלתי צפויה")
    } finally { setBusy(false) }
  }

  const copyFromDialog = async () => {
    const url = getShareUrl(w.access_token)
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 1500)
  }

  return (
    <DialogContent className="w-full sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>עריכת סדנה</DialogTitle>
        <DialogDescription className="text-xs">עדכן פרטים ושמור</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label className="font-semibold">כותרת</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">תאריך</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">שעה</Label>
            <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">תיאור</Label>
          <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold">קיבולת</Label>
            <Input type="number" min={1} value={capacity} onChange={e => setCapacity(Number(e.target.value || 0))} />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">מחיר (ש"ח)</Label>
            <Input type="number" min={0} value={price} onChange={e => setPrice(Number(e.target.value || 0))} />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="isPublicEdit" checked={isPublic} onCheckedChange={v => setIsPublic(Boolean(v))} />
            <Label htmlFor="isPublicEdit">פומבית</Label>
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label className="font-semibold">קישור תשלום</Label>
            <Input value={paymentLink} onChange={e => setPaymentLink(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
      </div>

      {!isPublic && w.access_token && (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="text-sm">
            קישור לשיתוף:
            <div className="truncate text-muted-foreground">
              {getShareUrl(w.access_token)}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={copyFromDialog}>
            {copiedShare ? "הועתק ✓" : "העתק קישור"}
          </Button>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>ביטול</Button>
        <Button onClick={save} disabled={busy}>{busy ? "שומר…" : "שמירה"}</Button>
      </div>
    </DialogContent>
  )
}

// ---------------------------------- Payments Dialog (כמו ששלחתי קודם, ללא שינוי) ----------------------------------
function PaymentsDialog({
  open, onClose, registration, onChanged
}: {
  open: boolean
  onClose: () => void
  registration: { id: string, full_name: string, seats: number, price?: number }
  onChanged: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [amount, setAmount] = useState<number>(0)
  const [method, setMethod] = useState<'none'|'cash'|'card'|'transfer'|'other'>('none')
  const [note, setNote] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>("")

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/registrations/${registration.id}/payments`)
      const j = await r.json()
      setRows(j.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setErr("")
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, registration?.id])

  const addPayment = async () => {
    setBusy(true); setErr("")
    try {
      const body: any = {
        amount: Math.max(0, Math.floor(Number(amount || 0))),
        method: method === 'none' ? null : method,
        note: note || null
      }
      const r = await fetch(`/api/admin/registrations/${registration.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const j = await r.json().catch(()=> ({}))
      if (!r.ok || j.error) throw new Error(j.error || 'שגיאה בהוספת תשלום')
      setAmount(0); setMethod('none'); setNote("")
      await load()
      await onChanged()
    } catch (e:any) {
      setErr(e?.message || 'שגיאה')
    } finally {
      setBusy(false)
    }
  }

  const removePayment = async (pid: string) => {
    setBusy(true); setErr("")
    try {
      const r = await fetch(`/api/admin/registrations/${registration.id}/payments/${pid}`, { method: 'DELETE' })
      const j = await r.json().catch(()=> ({}))
      if (!r.ok || j.error) throw new Error(j.error || 'שגיאה במחיקה')
      await load()
      await onChanged()
    } catch (e:any) {
      setErr(e?.message || 'שגיאה')
    } finally {
      setBusy(false)
    }
  }

  const total = (registration?.price ?? 0) * (registration?.seats ?? 1)
  const sumPaid = rows.reduce((s, p) => s + Number(p.amount || 0), 0)

  return (
    <Dialog open={open} onOpenChange={(v)=> v ? null : onClose()}>
      <DialogContent className="w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>תשלומים – {registration.full_name}</DialogTitle>
          <DialogDescription className="text-xs">
            ניהול היסטוריית תשלומים להרשמה. סכום כולל (משוער): {total || '—'} ₪
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">סכום (ש"ח)</TableHead>
                  <TableHead className="text-right">שיטה</TableHead>
                  <TableHead className="text-right">מקור</TableHead>
                  <TableHead className="text-right">הערה</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">טוען…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">אין תשלומים עדיין.</TableCell></TableRow>
                ) : (
                  rows.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-right">{new Date(p.created_at).toLocaleString('he-IL')}</TableCell>
                      <TableCell className="text-right">{p.amount}</TableCell>
                      <TableCell className="text-right">{p.method ?? '—'}</TableCell>
                      <TableCell className="text-right">{p.source}</TableCell>
                      <TableCell className="text-right">{p.note ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={()=>removePayment(p.id)} title="מחק">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {rows.length > 0 && (
                  <TableRow>
                    <TableCell className="text-right font-medium">סה״כ שולם</TableCell>
                    <TableCell className="text-right font-medium">{sumPaid}</TableCell>
                    <TableCell colSpan={4}></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="font-semibold">סכום (ש"ח)</Label>
              <Input type="number" min={1} value={amount} onChange={e => setAmount(Math.max(0, Math.floor(Number(e.target.value || 0))))} />
            </div>
            <div className="space-y-1">
              <Label className="font-semibold">שיטה</Label>
              <Select value={method} onValueChange={(v:any)=> setMethod(v)}>
                <SelectTrigger><SelectValue placeholder="בחר שיטה" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="cash">מזומן</SelectItem>
                  <SelectItem value="card">אשראי</SelectItem>
                  <SelectItem value="transfer">העברה/ביט</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="font-semibold">הערה</Label>
              <Input placeholder="למשל: שולם באירוע" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button onClick={addPayment} disabled={busy || amount <= 0}>
                {busy ? "מוסיף…" : "הוסף תשלום"}
              </Button>
            </div>
          </div>

          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>סגור</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------- Registrations Table ----------------------------------
function RegistrationsBlock(props: {
  workshopsOptions: any[]
  filtersQS: string
  fWorkshop: string
  setFWorkshop: (v: string) => void
  fStatus: 'all'|'pending'|'confirmed'|'cancelled'
  setFStatus: (v: 'all'|'pending'|'confirmed'|'cancelled') => void
  fPaid: 'all'|'paid'|'unpaid'
  setFPaid: (v: 'all'|'paid'|'unpaid') => void
  fFrom: string
  setFFrom: (v: string) => void
  fTo: string
  setFTo: (v: string) => void
}) {
  const { workshopsOptions, filtersQS, fWorkshop, setFWorkshop, fStatus, setFStatus, fPaid, setFPaid, fFrom, setFFrom, fTo, setFTo } = props
  const [rows, setRows] = useState<any[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<any>({})

  const [paymentsOpen, setPaymentsOpen] = useState(false)
  const [paymentsReg, setPaymentsReg] = useState<{ id: string, full_name: string, seats: number, price?: number } | null>(null)

  const load = async () => {
    const url = `/api/admin/registrations${filtersQS ? `?${filtersQS}` : ''}`
    const r = await fetch(url)
    if (!r.ok) return
    const j = await r.json(); setRows(j.data || [])
  }
  useEffect(() => { load() }, [filtersQS])

  const startEdit = (r: any) => {
    setEditId(r.id)
    setDraft({
      seats: r.seats,
      paid: !!r.paid,
      amount_paid: r.amount_paid ?? 0,
      payment_method: r.payment_method ?? "none",
      status: r.status,
      payment_link: r.payment_link ?? "",
    })
  }
  const cancelEdit = () => {
    setEditId(null)
    setDraft({})
  }

  const saveEdit = async (id: string) => {
    setBusyId(id)
    try {
      const patch: any = {
        seats: Number(draft.seats),
        paid: Boolean(draft.paid),
        amount_paid: Number.isFinite(Number(draft.amount_paid))
          ? Math.max(0, Math.floor(Number(draft.amount_paid)))
          : 0,
        status: draft.status,
        payment_method: draft.payment_method === "none" ? null : draft.payment_method,
        payment_link: draft.payment_link || null,
      }
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "שגיאה")
      await load()
      cancelEdit()
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  const removeRow = async (id: string) => {
    setBusyId(id)
    try {
      await fetch(`/api/admin/registrations/${id}`, { method: "DELETE" })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const openPayments = (r: any) => {
    setPaymentsReg({
      id: r.id,
      full_name: r.full_name,
      seats: r.seats,
      price: r.workshop?.price ?? undefined
    })
    setPaymentsOpen(true)
  }

  const onExportCsv = () => {
    const qs = filtersQS ? `?${filtersQS}` : ''
    const href = `/api/admin/registrations/export${qs}`
    const a = document.createElement('a')
    a.href = href
    a.download = '' // השרת ישלח שם קובץ
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const renderPaidCell = (r: any) => {
    const amount = Number(r.amount_paid ?? 0)
    const pricePerSeat = Number(r.workshop?.price ?? NaN)
    const seats = Number(r.seats ?? 1)

    if (Number.isFinite(pricePerSeat)) {
      const total = pricePerSeat * seats
      if (amount >= total) return 'כן'
      if (amount > 0) return `חלקית ${amount}/${total}`
      return 'לא'
    } else {
      if (r.paid) return 'כן'
      if (amount > 0) return `חלקית ${amount}`
      return 'לא'
    }
  }

  return (
    <Card className="border border-line">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>רישומים אחרונים</CardTitle>
            <CardDescription>סינון לפי סדנה/טווח תאריכים/סטטוס/תשלום, וייצוא CSV</CardDescription>
          </div>
          <Button onClick={onExportCsv}>
            <Download className="h-4 w-4 ml-2" />
            ייצוא CSV
          </Button>
        </div>

        {/* פס סינון */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">סדנה</Label>
            <Select value={fWorkshop} onValueChange={(v)=> setFWorkshop(v)}>
              <SelectTrigger><SelectValue placeholder="סדנה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                {workshopsOptions.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">סטטוס</Label>
            <Select value={fStatus} onValueChange={(v:any)=> setFStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="confirmed">confirmed</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">תשלום</Label>
            <Select value={fPaid} onValueChange={(v:any)=> setFPaid(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="paid">שולם</SelectItem>
                <SelectItem value="unpaid">לא שולם</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">מתאריך (הרשמה)</Label>
            <Input type="date" value={fFrom} onChange={e=> setFFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">עד תאריך (הרשמה)</Label>
            <Input type="date" value={fTo} onChange={e=> setFTo(e.target.value)} />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">סדנה</TableHead>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">אימייל</TableHead>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right">כמות</TableHead>
                <TableHead className="text-right">שולם</TableHead>
                <TableHead className="text-right">שולם בפועל</TableHead>
                <TableHead className="text-right">שיטת תשלום</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">תאריך הרשמה</TableHead>
                <TableHead className="text-right">קישור תשלום</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const isEdit = r.id === editId
                return (
                  <TableRow key={r.id} className="align-top">
                    {/* סדנה */}
                    <TableCell className="text-right">
                      <div className="font-medium">{r.workshop?.title || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.workshop?.event_at ? new Date(r.workshop.event_at).toLocaleString('he-IL') : ''}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">{r.full_name}</TableCell>
                    <TableCell className="text-right">{r.email}</TableCell>
                    <TableCell className="text-right">{r.phone}</TableCell>

                    {/* כמות */}
                    <TableCell className="text-right">
                      {isEdit ? (
                        <Input
                          type="number"
                          min={1}
                          className="w-20"
                          value={draft.seats ?? 1}
                          onChange={(e) => setDraft((d: any) => ({ ...d, seats: Number(e.target.value || 1) }))}
                        />
                      ) : (
                        r.seats
                      )}
                    </TableCell>

                    {/* שולם */}
                    <TableCell className="text-right">
                      {isEdit ? (
                        <Switch
                          checked={!!draft.paid}
                          onCheckedChange={(v) => setDraft((d: any) => ({ ...d, paid: Boolean(v) }))}
                          disabled={busyId === r.id}
                        />
                      ) : (
                        renderPaidCell(r)
                      )}
                    </TableCell>

                    {/* שולם בפועל */}
                    <TableCell className="text-right">
                      {isEdit ? (
                        <Input
                          type="number"
                          min={0}
                          className="w-24"
                          value={draft.amount_paid ?? 0}
                          onChange={(e) =>
                            setDraft((d: any) => ({
                              ...d,
                              amount_paid: Math.max(0, Math.floor(Number(e.target.value || 0)))
                            }))
                          }
                        />
                      ) : (
                        Number(r.amount_paid ?? 0)
                      )}
                    </TableCell>

                    {/* שיטת תשלום */}
                    <TableCell className="text-right">
                      {isEdit ? (
                        <Select
                          value={draft.payment_method ?? "none"}
                          onValueChange={(val) => setDraft((d: any) => ({ ...d, payment_method: val }))}
                          disabled={busyId === r.id}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="בחר שיטה" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="cash">מזומן</SelectItem>
                            <SelectItem value="card">אשראי</SelectItem>
                            <SelectItem value="transfer">העברה/ביט</SelectItem>
                            <SelectItem value="other">אחר</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        r.payment_method ?? '—'
                      )}
                    </TableCell>

                    {/* סטטוס */}
                    <TableCell className="text-right">
                      {isEdit ? (
                        <Select
                          value={draft.status}
                          onValueChange={(val) => setDraft((d: any) => ({ ...d, status: val }))}
                          disabled={busyId === r.id}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">pending</SelectItem>
                            <SelectItem value="confirmed">confirmed</SelectItem>
                            <SelectItem value="cancelled">cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        r.status
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {new Date(r.created_at).toLocaleString('he-IL')}
                    </TableCell>

                    {/* קישור תשלום */}
                    <TableCell className="text-right">
                      {isEdit ? (
                        <Input
                          className="w-48"
                          value={draft.payment_link ?? ''}
                          onChange={(e) => setDraft((d: any) => ({ ...d, payment_link: e.target.value }))}
                        />
                      ) : (
                        r.payment_link ? <a href={r.payment_link} target="_blank" rel="noreferrer" className="underline">קישור</a> : '—'
                      )}
                    </TableCell>

                    {/* פעולות */}
                    <TableCell className="text-right">
                      {!isEdit ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="secondary" onClick={() => startEdit(r)}>עריכה</Button>
                          <Button variant="outline" onClick={() => openPayments(r)}>תשלומים</Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" className="text-red-600 hover:text-red-700" disabled={busyId === r.id}>מחיקה</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>למחוק את הרישום?</AlertDialogTitle>
                                <AlertDialogDescription>הפעולה תפנה מקום בסדנה. בלתי הפיך.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { setBusyId(r.id); fetch(`/api/admin/registrations/${r.id}`, { method: "DELETE" }).then(load).finally(()=> setBusyId(null)) }} className="bg-red-600 hover:bg-red-700">מחק</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="secondary" onClick={cancelEdit} disabled={busyId === r.id}>ביטול</Button>
                          <Button onClick={() => saveEdit(r.id)} disabled={busyId === r.id || Number(draft.seats) < 1}>
                            {busyId === r.id ? "שומר…" : "שמירה"}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    אין רישומים בהתאם לסינון.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {paymentsReg && (
        <PaymentsDialog
          open={paymentsOpen}
          onClose={()=> setPaymentsOpen(false)}
          registration={paymentsReg}
          onChanged={load}
        />
      )}
    </Card>
  )
}
