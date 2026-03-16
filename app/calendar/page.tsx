'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Slot = {
  id: string
  start_time: string
  end_time: string
  booked_by: string | null
  notes: string | null
}

export default function CalendarPage() {

  const [slots, setSlots] = useState<Slot[]>([])
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  // recupera utente loggato
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    fetchUser()
  }, [])

  // carica slot dal database
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

  // gestione click su uno slot
  const handleClick = async (slot: Slot) => {

    // utente normale
    if (!user || user.email !== 'admin@tuoemail.com') {
      if (slot.booked_by) {
        alert("Slot già prenotato!")
        return
      }
      const name = prompt("Inserisci il tuo nome:")  
      if (!name) return
      const note = prompt("Inserisci eventuale nota (opzionale):") || null

      const { error } = await supabase
        .from('slots')
        .update({ booked_by: name, notes: note })
        .eq('id', slot.id)

      if (error) {
        alert("Errore durante la prenotazione")
        console.error(error)
        return
      }

      setSlots(slots.map(s => s.id === slot.id ? { ...s, booked_by: name, notes: note } : s))
      return
    }

    // admin → può modificare qualsiasi slot
    const name = prompt("Nome:", slot.booked_by || "") || slot.booked_by
    const note = prompt("Note:", slot.notes || "") || slot.notes

    const { error } = await supabase
      .from('slots')
      .update({ booked_by: name, notes: note })
      .eq('id', slot.id)

    if (error) {
      alert("Errore durante l'aggiornamento")
      console.error(error)
      return
    }

    setSlots(slots.map(s => s.id === slot.id ? { ...s, booked_by: name, notes: note } : s))
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Agenda slot</h1>
      <p>{user ? `Loggato come: ${user.email}` : "Utente anonimo"}</p>

      {slots.map(slot => {

        const color = slot.booked_by ? '#ff6b6b' : '#51cf66'

        return (
          <div
            key={slot.id}
            onClick={() => handleClick(slot)}
            style={{
              background: color,
              padding: "10px",
              margin: "5px",
              borderRadius: "6px",
              cursor: slot.booked_by && (!user || user.email !== 'admin@tuoemail.com') ? "not-allowed" : "pointer"
            }}
          >
            <strong>{new Date(slot.start_time).toLocaleString()}</strong> → {new Date(slot.end_time).toLocaleTimeString()}
            
            {slot.notes && user?.email === 'admin@tuoemail.com' && (
              <div>note: {slot.notes}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
