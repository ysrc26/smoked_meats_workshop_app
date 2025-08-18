'use client'

import { useState } from 'react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export default function NewWorkshopForm({ onCreated }: { onCreated?: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [capacity, setCapacity] = useState<number>(20)
  const [price, setPrice] = useState<number>(450)
  const [paymentLink, setPaymentLink] = useState('')
  const [active, setActive] = useState(true)
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setBusy(true)
    setErr('')
    try {
      if (!title || !date || !time) {
        setErr('יש למלא כותרת, תאריך ושעה')
        setBusy(false)
        return
      }
      const event_at = new Date(`${date}T${time}:00`)
      const r = await fetch('/api/admin/workshops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, event_at, capacity,
          price, payment_link: paymentLink || null,
          is_active: active, is_public: isPublic,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j?.error || 'שגיאה ביצירת סדנה')
      }
      setTitle(''); setDescription(''); setDate(''); setTime('')
      setCapacity(20); setPrice(450); setPaymentLink(''); setActive(true)
      onCreated?.()
    } catch (e: any) {
      setErr(e?.message || 'שגיאה בלתי צפויה')
    } finally { setBusy(false) }
  }

  return (
    <Card className="w-full border border-line shadow-sm">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl">פתיחת סדנה חדשה</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          מלא את פרטי הסדנה. שדות חובה: כותרת, תאריך ושעה.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="pt-8">
        {/* גריד רחב, בנייד עמודה—בדסקטופ 2/3 עמודות */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="font-semibold">כותרת</Label>
            <Input id="title" placeholder="סדנת עישון בשרים" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-6">
              <Label htmlFor="date" className="font-semibold">תאריך</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-6">
              <Label htmlFor="time" className="font-semibold">שעה</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
          <div className="space-y-6">
            <Label htmlFor="description" className="font-semibold">תיאור</Label>
            <Textarea id="description" rows={3} placeholder="מה נלמד? אילו נתחים נטעם?…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          </div>

            <div className="space-y-6">
              <Label htmlFor="capacity" className="font-semibold">קיבולת</Label>
              <Input id="capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value || 0))} />
            </div>
            <div className="space-y-6">
              <Label htmlFor="price" className="font-semibold">מחיר (ש"ח)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(Math.max(0, Math.floor(Number(e.target.value || 0))))}
              />
              <div className="text-xs text-muted-foreground">
                יוצג לציבור כ־{price.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
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

          <div className="space-y-6">
            <Label htmlFor="payment" className="font-semibold">קישור תשלום (אופציונלי)</Label>
            <Input id="payment" placeholder="https://pay.example.com/..." value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} inputMode="url" />
            <div className="text-xs text-muted-foreground">אם מולא — יוצג למשתמש לאחר הרשמה.</div>
          </div>

          {err && (
            <div className="mt-4 text-sm text-red-600 border border-red-200 bg-red-50 rounded-md p-3">
              <Alert variant="destructive">
                <AlertTitle>שגיאה</AlertTitle>
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-end">
        <Button onClick={submit} disabled={busy || !title || !date || !time}>
          {busy ? 'שומר…' : 'יצירה'}
        </Button>
      </CardFooter>
    </Card>
  )
}

