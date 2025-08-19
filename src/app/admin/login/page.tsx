// src/app/admin/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async () => {
    setErr('')
    setLoading(true)
    
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      
      if (r.ok) {
        router.push('/admin')
      } else {
        setErr('סיסמה שגויה')
      }
    } catch (error) {
      setErr('שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader>
            <CardTitle>כניסת מנהל</CardTitle>
            <CardDescription>הזן את סיסמת המנהל</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input 
                id="password"
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
            {err && (
              <Alert variant="destructive">
                <AlertTitle>שגיאה</AlertTitle>
                <AlertDescription>{err}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={submit} 
              disabled={!password.trim() || loading}
              className="w-full"
            >
              {loading ? 'מתחבר...' : 'כניסה'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}