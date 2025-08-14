// src/app/w/[token]/page.tsx

'use client'

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabaseBrowser"
import { PublicWorkshopCard, Workshop } from "@/components/PublicWorkshopCard"
import RegistrationDialog from "@/components/RegistrationDialog"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function PrivateWorkshopPage() {
  const params = useParams() as { token: string }
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  // שליפה לפי טוקן (UUID ארוך)
  const fetchByToken = async () => {
    const { data, error } = await supabaseBrowser
      .rpc("get_workshop_by_token", { p_token: params.token })

    if (error) {
      setWorkshop(null)
      return
    }

    // RPC מחזיר מערך (אפס/אחד פריטים). נשלוף את הראשון אם קיים.
    const row = Array.isArray(data) ? data[0] : data
    if (row) {
      // ודא שהטיפוסים תואמים למה שהכרטיס מצפה לו
      setWorkshop({
        id: row.id,
        title: row.title,
        description: row.description,
        event_at: String(row.event_at),          // מחרוזת ISO
        capacity: Number(row.capacity ?? 0),
        price: Number(row.price ?? 0),
        payment_link: row.payment_link ?? null,
        seats_left: Number(row.seats_left ?? 0),
      } as any)
    } else {
      setWorkshop(null)
    }
  }


  useEffect(() => {
    (async () => {
      setLoading(true)
      await fetchByToken()
      setLoading(false)
    })()
  }, [params.token])

  if (loading) return <div className="text-sm text-muted-foreground">טוען…</div>

  if (!workshop) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        הסדנה לא נמצאה או אינה זמינה בקישור זה.
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold mb-1">רישום לסדנה פרטית</h1>
      </div>

      <PublicWorkshopCard
        w={workshop}
        onRegister={() => setOpen(true)}
      />

      <RegistrationDialog
        open={open}
        onClose={() => setOpen(false)}
        workshop={{ id: workshop.id, title: workshop.title, seats_left: workshop.seats_left }}
        onSuccess={fetchByToken}
      />
    </div>
  )
}