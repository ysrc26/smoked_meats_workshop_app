// src/app/admin/page.tsx
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


export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [navOpen, setNavOpen] = useState(false)
  const [view, setView] = useState<'new' | 'open' | 'regs'>('new')
  const [workshopsOptions, setWorkshopsOptions] = useState<any[]>([])
  const [fWorkshop, setFWorkshop] = useState<string>('all')
  const [fStatus, setFStatus] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [fPaid, setFPaid] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [fFrom, setFFrom] = useState<string>('') // YYYY-MM-DD
  const [fTo, setFTo] = useState<string>('') // YYYY-MM-DD

  // בדיקת אימות בטעינת הדף
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/admin/workshops')
        if (res.status === 401) {
          window.location.href = '/admin/login'
          return
        }
      } catch (error) {
        window.location.href = '/admin/login'
        return
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  // ---- טעינת סדנאות לפילטר ----
  useEffect(() => {
    if (!loading) { // רק אחרי שהאימות עבר
      fetch('/api/admin/workshops')
        .then(r => r.json().catch(() => ({})))
        .then(j => setWorkshopsOptions(j?.data || []))
        .catch(() => setWorkshopsOptions([]))
    }
  }, [loading])

  // ---- סינון לרשימת נרשמים ----
  const filtersQS = useMemo(() => {
    const params = new URLSearchParams()
    if (fWorkshop && fWorkshop !== 'all') params.set('workshop_id', fWorkshop)
    if (fStatus && fStatus !== 'all') params.set('status', fStatus)
    if (fPaid && fPaid !== 'all') {
      params.set('paid', fPaid === 'paid' ? 'true' : 'false')
    }
    if (fFrom) params.set('from', fFrom)
    if (fTo) params.set('to', fTo)
    return params.toString()
  }, [fWorkshop, fStatus, fPaid, fFrom, fTo])

  // אם עדיין טוען - הראה loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">בודק הרשאות...</div>
      </div>
    )
  }

  // ---- ניהול התחברות ----
  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  // ---- ניהול ניווט בין תצוגות ----
  const nav = (
    <nav className="flex flex-col gap-2 p-4">
      <Button variant="destructive" className="mb-4" onClick={logout}>
        התנתק
      </Button>
      <Button
        variant={view === 'new' ? 'secondary' : 'ghost'}
        onClick={() => { setView('new'); setNavOpen(false) }}
        className="justify-start"
      >
        פתיחת סדנא חדשה
      </Button>
      <Button
        variant={view === 'open' ? 'secondary' : 'ghost'}
        onClick={() => { setView('open'); setNavOpen(false) }}
        className="justify-start"
      >
        סדנאות פתוחות
      </Button>
      <Button
        variant={view === 'regs' ? 'secondary' : 'ghost'}
        onClick={() => { setView('regs'); setNavOpen(false) }}
        className="justify-start"
      >
        רשימת נרשמים
      </Button>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* סייד־בר קבוע בימין במסכים רחבים */}
      <aside className="hidden md:flex fixed inset-y-0 right-0 w-64 border-l bg-background z-40">
        {nav}
      </aside>

      {/* כותרת + כפתור המבורגר במובייל */}
      <header className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-3 flex items-center justify-between">
          <div className="font-semibold">ניהול סדנאות</div>
          <Button variant="outline" size="icon" onClick={() => setNavOpen(true)} aria-label="פתח תפריט">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* תוכן ראשי: מפנה מקום לסייד־בר בימין בדסקטופ */}
      <main className="md:pr-72">
        <div className="w-full space-y-6">
          {view === 'new' && <NewWorkshopForm />}
          {view === 'open' && <OpenWorkshops />}
          {view === 'regs' && (
            <RegistrationsList
              workshopsOptions={workshopsOptions}
              filtersQS={filtersQS}
              fWorkshop={fWorkshop} setFWorkshop={setFWorkshop}
              fStatus={fStatus} setFStatus={setFStatus}
              fPaid={fPaid} setFPaid={setFPaid}
              fFrom={fFrom} setFFrom={setFFrom}
              fTo={fTo} setFTo={setFTo}
            />
          )}
        </div>
      </main>

      {/* דראואר מובייל */}
      {navOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setNavOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute inset-y-0 right-0 w-64 bg-background border-l shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 flex items-center justify-between border-b">
              <div className="font-medium">תפריט</div>
              <Button variant="ghost" size="sm" onClick={() => setNavOpen(false)}>סגור</Button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </div>
  )
}