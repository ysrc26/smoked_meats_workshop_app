'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export type Workshop = {
  id: string
  title: string
  description: string | null
  event_at: string
  capacity: number
  price: number
  payment_link: string | null
  seats_left: number
}

export function PublicWorkshopCard({
  w,
  onRegister
}: {
  w: Workshop
  onRegister: (w: Workshop) => void
}) {
  const date = new Date(w.event_at)
  const price = (w.price).toLocaleString("he-IL", { style: "currency", currency: "ILS" })

  return (
    <Card className="border border-line">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">{w.title}</CardTitle>
          <div className="text-sm text-muted-foreground">
            {date.toLocaleString("he-IL", { weekday: "long", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        {w.description && (
          <CardDescription className="text-sm whitespace-pre-wrap">
            {w.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <div>מקומות פנויים: <b className="text-foreground">{w.seats_left}</b></div>
        <div>מחיר: <b className="text-foreground">{price}</b></div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={() => onRegister(w)} disabled={w.seats_left <= 0}>בחירה והרשמה</Button>
      </CardFooter>
    </Card>
  )
}
