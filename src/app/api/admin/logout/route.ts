// src/app/api/admin/logout/route.ts
import { NextResponse } from 'next/server'

const COOKIE = process.env.ADMIN_COOKIE_NAME || 'workshops_admin'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  
  response.cookies.set({
    name: COOKIE,
    value: '',
    expires: new Date(0),
    path: '/',
  })
  
  return response
}