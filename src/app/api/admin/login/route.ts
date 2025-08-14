// src/app/api/admin/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const COOKIE = process.env.ADMIN_COOKIE_NAME || 'workshops_admin'
const SECRET = process.env.ADMIN_COOKIE_SECRET!

function sign(value: string) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex')
}

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const value = '1'
  const sig = sign(value)

  // קובעים את העוגייה על האובייקט של התגובה
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: COOKIE,
    value: `${value}.${sig}`,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return res
}
