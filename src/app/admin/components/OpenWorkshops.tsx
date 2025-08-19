'use client'

import { useEffect, useState } from 'react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_BASE_URL || ''
}
function getShareUrl(access_token?: string) {
  if (!access_token) return ''
  const base = process.env.NEXT_PUBLIC_BASE_URL || getBaseUrl()
  return `${base}/w/${access_token}`
}

export default function OpenWorkshops() {
  const [list, setList] = useState<any[]>([])

  const load = async () => {
    const r = await fetch('/api/admin/workshops')
    const j = await r.json().catch(() => ({}))
    setList(j.data || [])
  }
  useEffect(() => { load() }, [])

  return (
    <Card className="border border-line">
      <CardHeader>
        <CardTitle>סדנאות פעילות</CardTitle>
        <CardDescription>הפעל/השבת, עדכן פרטים או מחק סדנה</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {list.length === 0 && <div className="text-sm text-muted-foreground">אין סדנאות עדיין.</div>}
        {list.map(w => <WorkshopRow key={w.id} w={w} onChanged={load} />)}
      </CardContent>
    </Card>
  )
}

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
              <Badge variant={w.is_active ? 'active' : 'destructive'}>
                {w.is_active ? 'פעילה' : 'מושבתת'}
              </Badge>

              {!w.is_public && (
                <>
                  <Badge variant="private">פרטית</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyShareLink}
                    title="העתקת קישור שיתוף"
                  >
                    {copied ? 'הועתק ✓' : 'העתק קישור'}
                  </Button>
                </>
              )}

              <div className="text-sm text-muted-foreground">
                פנויות: {w.seats_left} / {w.capacity}
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {new Date(w.event_at).toLocaleString('he-IL')}
          </div>

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

function WorkshopEditDialog({
  open, onClose, w, onSaved
}: { open: boolean, onClose: () => void, w: any, onSaved: () => void }) {
  const [title, setTitle] = useState(w.title ?? '')
  const [description, setDescription] = useState(w.description ?? '')
  const [date, setDate] = useState(() => new Date(w.event_at).toISOString().slice(0, 10))
  const [time, setTime] = useState(() => new Date(w.event_at).toTimeString().slice(0, 5))
  const [capacity, setCapacity] = useState<number>(w.capacity ?? 0)
  const [price, setPrice] = useState<number>(w.price ?? 0)
  const [isPublic, setIsPublic] = useState(!!w.is_public)
  const [paymentLink, setPaymentLink] = useState<string>(w.payment_link ?? '')
  const [copiedShare, setCopiedShare] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setBusy(true); setErr('')
    try {
      const event_at = new Date(`${date}T${time}:00`)
      const r = await fetch(`/api/admin/workshops/${w.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, event_at, capacity, price,
          payment_link: paymentLink || null, is_public: isPublic
        })
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j?.error || 'שגיאה בשמירה')
      }
      onSaved()
    } catch (e: any) {
      setErr(e?.message || 'שגיאה בלתי צפויה')
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
    <DialogContent className="w-full sm:max-w-lg max-h-[90vh] flex flex-col">
      <DialogHeader className="flex-shrink-0">
        <DialogTitle>עריכת סדנה</DialogTitle>
        <DialogDescription className="text-xs">עדכן פרטים ושמור</DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto space-y-4">
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

        {!isPublic && w.access_token && (
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="text-sm">
              קישור לשיתוף:
              <div className="truncate text-muted-foreground">
                {getShareUrl(w.access_token)}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={copyFromDialog}>
              {copiedShare ? 'הועתק ✓' : 'העתק קישור'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t bg-background flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>ביטול</Button>
        <Button onClick={save} disabled={busy}>{busy ? 'שומר…' : 'שמירה'}</Button>
      </div>
    </DialogContent>
  )
}