// src/app/api/admin/registrations/[id]/payments/[paymentId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function DELETE(_req: NextRequest, ctx: any) {
  const regId = ctx?.params?.id as string
  const paymentId = ctx?.params?.paymentId as string
  if (!regId || !paymentId) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('payments')
    .delete()
    .eq('id', paymentId)
    .eq('registration_id', regId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // הטריגר יעדכן את ההרשמה; נחזיר מצב עדכני
  const { data: reg, error: rErr } = await supabaseAdmin
    .from('registrations')
    .select('id, amount_paid, paid')
    .eq('id', regId)
    .single()

  if (rErr) return NextResponse.json({ ok: true }, { status: 200 })

  return NextResponse.json({ ok: true, registration: reg }, { status: 200 })
}