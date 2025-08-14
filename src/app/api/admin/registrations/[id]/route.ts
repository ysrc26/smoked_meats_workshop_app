import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isAdmin } from '@/app/api/admin/guard'

export async function PATCH(req: Request, context: any) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = (context?.params || {}) as { id: string }
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const body = await req.json()

  const allowed: Record<string, any> = {}

  // כמות מושבים (חייב > 0)
  if (typeof body.seats === 'number') {
    if (body.seats <= 0) {
      return NextResponse.json({ error: 'seats must be > 0' }, { status: 400 })
    }
    allowed.seats = body.seats
  }

  // שדות תשלום/סטטוס
  if (typeof body.paid === 'boolean') allowed.paid = body.paid
  if (typeof body.status === 'string') allowed.status = body.status
  if (typeof body.payment_method === 'string' || body.payment_method === null) {
    allowed.payment_method = body.payment_method
  }
  if (typeof body.external_payment_id === 'string' || body.external_payment_id === null) {
    allowed.external_payment_id = body.external_payment_id
  }

  // (אופציונלי) עדכון פרטי איש קשר
  if (typeof body.full_name === 'string') allowed.full_name = body.full_name
  if (typeof body.email === 'string') allowed.email = body.email
  if (typeof body.phone === 'string') allowed.phone = body.phone

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  // אם שולם=true ואין סטטוס, נעדכן ל-confirmed
  if (allowed.paid === true && !allowed.status) {
    allowed.status = 'confirmed'
  }

  const { data, error } = await supabaseAdmin
    .from('registrations')
    .update(allowed)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: Request, context: any) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = (context?.params || {}) as { id: string }
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const { error } = await supabaseAdmin.from('registrations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
