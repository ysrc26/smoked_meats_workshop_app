'use client'

import { useState } from 'react'
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

  if (!authed) return <AdminLogin onOk={() => setAuthed(true)} />

  const nav = (
    <nav className="flex flex-col gap-2">
      <Button variant="ghost" onClick={() => { setView('new'); setNavOpen(false) }}>פתיחת סדנא חדשה</Button>
      <Button variant="ghost" onClick={() => { setView('open'); setNavOpen(false) }}>סדנאות פתוחות</Button>
      <Button variant="ghost" onClick={() => { setView('regs'); setNavOpen(false) }}>רשימת נרשמים</Button>
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
          {view === 'new' && <NewWorkshopForm />}
          {view === 'open' && <OpenWorkshops />}
          {view === 'regs' && <RegistrationsList />}
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

