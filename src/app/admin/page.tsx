'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Menu } from 'lucide-react'

import NewWorkshopForm from './components/NewWorkshopForm'
import OpenWorkshops from './components/OpenWorkshops'
import RegistrationsList from './components/RegistrationsList'

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
    <div className="max-w-md mx-auto p-4">
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

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [view, setView] = useState<'new'|'open'|'regs'>('new')

  // ---- סדנאות לבחירת סינון ברשימת נרשמים ----
  const [workshopsOptions, setWorkshopsOptions] = useState<any[]>([])
  useEffect(() => {
    // מביא רשימת סדנאות פעילה/לא – לטובת סינון
    fetch('/api/admin/workshops')
      .then(r => r.json().catch(()=> ({})))
      .then(j => setWorkshopsOptions(j?.data || []))
      .catch(()=> setWorkshopsOptions([]))
  }, [authed])

  // ---- סטייט סינון לרשימת נרשמים ----
  const [fWorkshop, setFWorkshop] = useState<string>('all')
  const [fStatus, setFStatus]   = useState<'all'|'pending'|'confirmed'|'cancelled'>('all')
  const [fPaid, setFPaid]       = useState<'all'|'paid'|'unpaid'>('all')
  const [fFrom, setFFrom]       = useState<string>('') // YYYY-MM-DD
  const [fTo, setFTo]           = useState<string>('') // YYYY-MM-DD

  // בניית QS לפילטרים – בדיוק לפי הציפייה של /api/admin/registrations
  const filtersQS = useMemo(() => {
    const params = new URLSearchParams()
    if (fWorkshop && fWorkshop !== 'all') params.set('workshop', fWorkshop)
    if (fStatus && fStatus !== 'all')     params.set('status', fStatus)
    if (fPaid && fPaid !== 'all')         params.set('paid', fPaid)
    if (fFrom)                            params.set('from', fFrom)
    if (fTo)                              params.set('to', fTo)
    return params.toString()
  }, [fWorkshop, fStatus, fPaid, fFrom, fTo])

  if (!authed) return <AdminLogin onOk={() => setAuthed(true)} />

  const nav = (
    <nav className="flex flex-col gap-2">
      <Button variant={view==='new' ? 'secondary':'ghost'} onClick={() => { setView('new'); setNavOpen(false) }}>פתיחת סדנא חדשה</Button>
      <Button variant={view==='open'? 'secondary':'ghost'} onClick={() => { setView('open'); setNavOpen(false) }}>סדנאות פתוחות</Button>
      <Button variant={view==='regs'? 'secondary':'ghost'} onClick={() => { setView('regs'); setNavOpen(false) }}>רשימת נרשמים</Button>
    </nav>
  )

  return (
    <div className="flex">
      <aside className="hidden md:block w-64 border-l p-4">
        {nav}
      </aside>
      <div className="flex-1">
        <div className="p-4 md:hidden">
          <Button variant="outline" size="icon" onClick={() => setNavOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4 space-y-4">
          {view === 'new'  && <NewWorkshopForm />}
          {view === 'open' && <OpenWorkshops />}
          {view === 'regs' && (
            <RegistrationsList
              workshopsOptions={workshopsOptions}
              // props של סינון
              filtersQS={filtersQS}
              fWorkshop={fWorkshop} setFWorkshop={setFWorkshop}
              fStatus={fStatus} setFStatus={setFStatus}
              fPaid={fPaid} setFPaid={setFPaid}
              fFrom={fFrom} setFFrom={setFFrom}
              fTo={fTo} setFTo={setFTo}
            />
          )}
        </div>
      </div>
      {navOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setNavOpen(false)}>
          <div className="ml-auto w-64 h-full bg-background border-l p-4" onClick={e => e.stopPropagation()}>
            {nav}
          </div>
        </div>
      )}
    </div>
  )
}