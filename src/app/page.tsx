'use client'

import { useEffect, useState } from "react"
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

export default function Page() {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Workshop | null>(null)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabaseBrowser
        .from("workshops_with_stats")
        .select("*")
        .eq("is_public", true)
        .gte("event_at", new Date().toISOString())
        .eq("is_active", true)
        .order("event_at", { ascending: true })


      if (!error && data) setWorkshops(data as any)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_REALTIME !== "true") return

    const ids = workshops.map(w => `'${w.id}'`).join(",")
    if (!ids) return

    const channel = supabaseBrowser
      .channel("registrations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
          filter: `workshop_id=in.(${ids})`
        },
        payload => {
          console.log("📢 שינוי ברישומים:", payload)

          // רענון נתונים
          supabaseBrowser
            .from("workshops_with_stats")
            .select("*")
            .gte("event_at", new Date().toISOString())
            .order("event_at", { ascending: true })
            .then(({ data }) => data && setWorkshops(data as any))
        }
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [workshops])


  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold mb-1">סדנאות זמינות</h1>
          <p className="text-sm text-muted-foreground">בחר סדנה פנויה, מלא פרטים והירשם</p>
        </div>

        {loading && <div className="text-sm text-muted-foreground">טוען…</div>}

        {!loading && workshops.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">
            אין סדנאות זמינות כרגע.
          </Card>
        )}

        <div className="flex flex-col gap-4">
          {workshops.map((w) => (
            <PublicWorkshopCard key={w.id} w={w} onRegister={setSelected} />
          ))}
        </div>

        <RegistrationDialog
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          workshop={selected as any}
          onSuccess={async () => {
            // רענון אחרי הרשמה
            const { data } = await supabaseBrowser
              .from("workshops_with_stats")
              .select("*")
              .eq("is_public", true)
              .gte("event_at", new Date().toISOString())
              .eq("is_active", true)
              .order("event_at", { ascending: true })
            if (data) setWorkshops(data as any)
          }}
        />

      </div>
    </div>
  )
}