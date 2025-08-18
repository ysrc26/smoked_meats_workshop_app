'use client'

import { useEffect, useState } from 'react'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Trash2, Download } from 'lucide-react'

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
export default function RegistrationsList(props: {
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
