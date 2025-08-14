//src/app/api/admin/workshops/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isAdmin } from '@/app/api/admin/guard'

export async function PATCH(req: Request, context: any) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = (context?.params || {}) as { id: string }
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const body = await req.json().catch(() => ({} as any))

  // נעדכן רק שדות שמותר לערוך
  const patch: Record<string, any> = {}
  if ('title' in body) patch.title = body.title
  if ('description' in body) patch.description = body.description
  if ('event_at' in body) patch.event_at = body.event_at
  if ('capacity' in body) patch.capacity = body.capacity
  if ('price_cents' in body) patch.price_cents = body.price_cents
  if ('payment_link' in body) patch.payment_link = body.payment_link
  if ('is_active' in body) patch.is_active = body.is_active
  if ('is_public' in body) patch.is_public = body.is_public

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('workshops')
    .update(patch)
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

  const { error } = await supabaseAdmin
    .from('workshops')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}