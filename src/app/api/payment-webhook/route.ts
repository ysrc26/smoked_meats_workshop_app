import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createHmac } from 'crypto'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  const signature = req.headers.get('x-webhook-signature')
  const headerSecret = req.headers.get('x-webhook-secret')

  if (!secret) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })
  }

  if (signature) {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    if (signature !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else if (headerSecret !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const registration_id =
    body?.metadata?.registration_id || body?.registration_id || body?.external_id
  if (!registration_id)
    return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const external_payment_id = body?.id || body?.external_payment_id
  const payment_method = body?.payment_method || body?.method

  const { error } = await supabaseAdmin
    .from('registrations')
    .update({
      paid: true,
      status: 'confirmed',
      ...(external_payment_id && { external_payment_id }),
      ...(payment_method && { payment_method }),
    })
    .eq('id', registration_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}