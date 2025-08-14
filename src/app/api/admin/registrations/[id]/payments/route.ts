// src/app/api/admin/registrations/[id]/payments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function normalizePaymentMethod(v: unknown): 'cash'|'card'|'transfer'|'other'|null {
  if (v === null) return null
  const s = String(v || '').trim().toLowerCase()
  if (!s || s === 'none' || s === 'null') return null
  if (s === 'cash') return 'cash'
  if (s === 'card' || s === 'credit' || s === 'creditcard') return 'card'
  if (s === 'transfer' || s === 'bank' || s === 'bit' || s === 'banktransfer') return 'transfer'
  return 'other'
}

export async function GET(_req: NextRequest, ctx: any) {
  const id = ctx?.params?.id as string
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id, amount, method, source, external_payment_id, note, created_at, created_by')
    .eq('registration_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, data })
}

export async function POST(req: NextRequest, ctx: any) {
  const id = ctx?.params?.id as string
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const amount = Math.max(0, Math.floor(Number(body.amount ?? 0)))
  const method = normalizePaymentMethod(body.method)
  const note = typeof body.note === 'string' ? body.note.trim() : null

  if (!amount) return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })

  const insertObj: any = {
    registration_id: id,
    amount,
    method,
    source: 'admin',
    external_payment_id: null,
    note,
    created_by: 'admin-ui',
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert(insertObj)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // הטריגר יעדכן את ההרשמה; נחזיר גם את סכומי הסיכום הנוכחיים
  const { data: reg, error: rErr } = await supabaseAdmin
    .from('registrations')
    .select('id, amount_paid, paid')
    .eq('id', id)
    .single()

  if (rErr) return NextResponse.json({ ok: true, id: data.id }, { status: 200 })

  return NextResponse.json({ ok: true, id: data.id, registration: reg }, { status: 200 })
}
