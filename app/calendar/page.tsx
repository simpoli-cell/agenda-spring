'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Slot = {
  id: string
  start_time: string
  end_time: string
  booked_by: string | null
  notes: string | null
}

export default function CalendarPage() {

  const [slots, setSlots] = useState<Slot[]>([])

  useEffect(() => {
    const fetchSlots = async () => {

      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .order('start_time')

      if (error) {
        console.error(error)
        return
      }

      setSlots(data || [])
    }

    fetchSlots()

  }, [])

  return (
    <div style={{padding:"40px"}}>

      <h1>Agenda</h1>

      {slots.map((slot) => {

  const color = slot.booked_by ? '#ff6b6b' : '#51cf66'

  const handleClick = async () => {

    if (slot.booked_by) {
      alert("Slot già prenotato!")
      return
    }

    const name = prompt("Inserisci il tuo nome:")
    if (!name) return

    const note = prompt("Inserisci eventuale nota (opzionale):") || null

    const { data, error } = await supabase
      .from('slots')
      .update({ booked_by: name, notes: note })
      .eq('id', slot.id)

    if (error) {
      console.error(error)
      alert("Errore nella prenotazione")
    } else {
      setSlots(slots.map(s => s.id === slot.id ? { ...s, booked_by: name, notes: note } : s))
    }

  }

  return (
    <div
      key={slot.id}
      onClick={handleClick}
      style={{
        background: color,
        padding: "10px",
        margin: "5px",
        borderRadius: "6px",
        cursor: slot.booked_by ? "not-allowed" : "pointer"
      }}
    >

      <strong>{new Date(slot.start_time).toLocaleString()}</strong>
      {" → "}
      {new Date(slot.end_time).toLocaleTimeString()}

      {slot.notes && <div>note: {slot.notes}</div>}

    </div>
  )

})}


    </div>
  )
}
