// src/app/api/admin/workshops/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isAdmin } from '@/app/api/admin/guard'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // נשלוף מהטבלה עצמה + רישומים ונחשב seats_left בשרת
  const { data, error } = await supabaseAdmin
    .from('workshops')
    .select('*, registrations(seats,status)')
    .order('event_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (data || []).map((w: any) => {
    const taken = (w.registrations || []).reduce((acc: number, r: any) => acc + (r.status !== 'cancelled' ? (r.seats || 0) : 0), 0)
    return {
      ...w,
      seats_left: Math.max(0, (w.capacity || 0) - taken),
    }
  })
  return NextResponse.json({ data: mapped })
}


export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  const { title, description, event_at, capacity, price, payment_link, is_active } = body
  if (!title || !event_at || !capacity || price === undefined) {
    return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin
    .from('workshops')
    .insert({ title, description, event_at, capacity, price, payment_link, is_active: is_active ?? true })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
