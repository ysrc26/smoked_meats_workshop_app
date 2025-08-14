import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createHmac } from 'crypto'
import { getStatusAfterPaid } from '@/lib/status'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  const signature = req.headers.get('x-webhook-signature')
  const headerSecret = req.headers.get('x-webhook-secret')

  console.info('Incoming payment webhook', {
    hasSignature: Boolean(signature),
    hasHeaderSecret: Boolean(headerSecret),
    body: rawBody,
  })

  if (!secret) {
    console.error('PAYMENT_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })
  }

  if (signature) {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    if (signature !== expected) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  } else if (headerSecret !== secret) {
    console.error('Invalid webhook secret header')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, any>
  try {
    body = JSON.parse(rawBody)
  } catch (err) {
    console.error('Invalid JSON payload', err)
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const registration_id =
    body?.metadata?.registration_id || body?.registration_id || body?.external_id
  if (!registration_id) {
    console.error('Missing registration id')
    return NextResponse.json({ error: 'missing id' }, { status: 400 })
  }

  const external_payment_id = body?.id || body?.external_payment_id
  const payment_method = body?.payment_method || body?.method

  try {
    // שלב חדש מ-main: קבלת הסטטוס הקיים
    const { data: reg, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('status')
      .eq('id', registration_id)
      .single()

    if (fetchErr || !reg) {
      return NextResponse.json(
        { error: fetchErr?.message || 'not found' },
        { status: fetchErr ? 500 : 404 }
      )
    }

    // בניית עדכון
    const update: Record<string, any> = {
      paid: true,
      ...(external_payment_id && { external_payment_id }),
      ...(payment_method && { payment_method }),
    }

    const status = getStatusAfterPaid(true, reg.status)
    if (status !== reg.status) update.status = status

    const { error } = await supabaseAdmin
      .from('registrations')
      .update(update)
      .eq('id', registration_id)

    if (error) {
      console.error('Error updating registration', {
        registration_id,
        error,
      })
      return NextResponse.json(
        { error: error.message, registration_id },
        { status: 500 }
      )
    }
  } catch (err: any) {
    console.error('Unexpected error updating registration', {
      registration_id,
      err,
    })
    return NextResponse.json(
      { error: 'server error', details: err.message, registration_id },
      { status: 500 }
    )
  }

  console.info('Registration marked as paid', { registration_id })
  return NextResponse.json({ ok: true, registration_id }, { status: 200 })
}
