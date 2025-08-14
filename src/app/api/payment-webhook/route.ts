import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.PAYMENT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  // צפה לשדות מהספק: registration_id, external_payment_id, paid
  const { registration_id, external_payment_id, paid } = body || {}
  if (!registration_id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const updates: any = {}
  if (typeof paid === 'boolean') updates.paid = paid
  if (external_payment_id) updates.external_payment_id = external_payment_id
  if (paid === true) updates.status = 'confirmed'

  const { error } = await supabaseAdmin
    .from('registrations')
    .update(updates)
    .eq('id', registration_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}