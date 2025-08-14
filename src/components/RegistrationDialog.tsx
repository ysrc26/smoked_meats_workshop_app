'use client'

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"

export type WorkshopLike = {
  id: string
  title: string
  seats_left: number
}

type Props = {
  open: boolean
  onClose: () => void
  workshop: WorkshopLike
  onSuccess?: () => Promise<void> | void
}

type Errors = Partial<Record<"fullName"|"email"|"phone"|"seats"|"form", string>>

const isEmail = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

// ישראלי: 05X-XXXXXXX, מאפשר מקפים/רווחים | בינ"ל פשוט עם +
const isPhone = (s: string) => {
  const t = s.trim()
  return /^(\+?\d[\d\s-]{7,15})$/.test(t) || /^0?5\d[-]?\d{7}$/.test(t)
}

export default function RegistrationDialog({
  open, onClose, workshop, onSuccess
}: Props) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [seats, setSeats] = useState<number>(1)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ message?: string; payment_link?: string } | null>(null)
  const [err, setErr] = useState<Errors>({})

  const maxSeats = useMemo(
    () => Math.max(0, Number(workshop?.seats_left ?? 0)),
    [workshop?.seats_left]
  )

  // איפוס בעת פתיחה
  useEffect(() => {
    if (!open) return
    setFullName("")
    setEmail("")
    setPhone("")
    setSeats(1)
    setBusy(false)
    setResult(null)
    setErr({})
  }, [open])

  const validate = (): boolean => {
    const next: Errors = {}

    if (!fullName.trim()) next.fullName = "חובה להזין שם מלא"
    if (!email.trim()) next.email = "חובה להזין אימייל"
    else if (!isEmail(email)) next.email = "אימייל לא תקין"

    if (!phone.trim()) next.phone = "חובה להזין טלפון"
    else if (!isPhone(phone)) next.phone = "טלפון לא תקין"

    if (!Number.isFinite(seats) || seats < 1) next.seats = "כמות חייבת להיות מספר שלם ≥ 1"
    else if (maxSeats > 0 && seats > maxSeats) next.seats = `אין מספיק מקומות. מקסימום ${maxSeats}`

    setErr(next)
    return Object.keys(next).length === 0
  }

  // ולידציה מידית בעת שינוי שדות
  useEffect(() => { if (open) validate() }, [fullName, email, phone, seats, maxSeats, open])

  const submit = async () => {
    setErr({})
    if (!validate()) return

    setBusy(true)
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workshop_id: workshop.id,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          seats
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setErr({ form: data?.error || "שגיאה בשליחה" })
        return
      }
      setResult(data)
      await onSuccess?.()
    } catch (e: any) {
      setErr({ form: e?.message || "שגיאה בלתי צפויה" })
    } finally {
      setBusy(false)
    }
  }

  const disabledByCapacity = maxSeats <= 0

  return (
    <Dialog open={open} onOpenChange={(v)=>{ if(!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>הרשמה: {workshop?.title}</DialogTitle>
          <DialogDescription className="text-xs">
            מלא פרטים. אם הוגדר קישור תשלום, יוצג לאחר השליחה.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="font-semibold">שם מלא</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e)=>setFullName(e.target.value)}
                placeholder="שם מלא"
                aria-invalid={Boolean(err.fullName)}
                disabled={disabledByCapacity}
              />
              {err.fullName && <p className="text-xs text-red-600">{err.fullName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  placeholder="name@example.com"
                  aria-invalid={Boolean(err.email)}
                  disabled={disabledByCapacity}
                />
                {err.email && <p className="text-xs text-red-600">{err.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-semibold">טלפון</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e)=>setPhone(e.target.value)}
                  placeholder="050-0000000"
                  aria-invalid={Boolean(err.phone)}
                  disabled={disabledByCapacity}
                />
                {err.phone && <p className="text-xs text-red-600">{err.phone}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seats" className="font-semibold">כמות משתתפים</Label>
              <Input
                id="seats"
                type="number"
                min={1}
                max={Math.max(1, maxSeats || 1)}
                value={seats}
                onChange={(e)=>setSeats(Math.max(1, Math.floor(Number(e.target.value || 1))))}
                aria-invalid={Boolean(err.seats)}
                disabled={disabledByCapacity}
              />
              <div className="text-xs text-muted-foreground">
                {disabledByCapacity ? "הסדנה מלאה" : `נותרו ${maxSeats} מקומות פנויים.`}
              </div>
              {err.seats && <p className="text-xs text-red-600">{err.seats}</p>}
            </div>

            {err.form && (
              <Alert variant="destructive">
                <AlertDescription>{err.form}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            <Alert>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
            {result.payment_link && (
              <div className="flex justify-end">
                <Button asChild><a href={result.payment_link} target="_blank" rel="noreferrer">פתח קישור לתשלום</a></Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>סגירה</Button>
          {!result && (
            <Button
              onClick={submit}
              disabled={busy || disabledByCapacity || Object.keys(err).some(k => k !== "form" && (err as any)[k])}
            >
              {busy ? "שולח…" : "שליחת הרשמה"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
