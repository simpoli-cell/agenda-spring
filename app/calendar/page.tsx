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

// Costante admin
const ADMIN_EMAIL = 'admin@agenda.com'

export default function CalendarPage() {

  const [slots, setSlots] = useState<Slot[]>([])
  const [user, setUser] = useState<any>(null)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  // carica slot
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

  // login admin inline
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput
    })
    if (error) {
      alert("Login fallito: " + error.message)
      return
    }
    setUser(data.user)
    setEmailInput('')
    setPasswordInput('')
  }

  // logout admin
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // prenotazione utente normale
  const bookSlot = async (slot: Slot) => {
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
  }

  // admin: edit slot
  const editSlot = async (slot: Slot) => {
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

  // admin: clear slot
  const clearSlot = async (slot: Slot) => {
    const { error } = await supabase
      .from('slots')
      .update({ booked_by: null, notes: null })
      .eq('id', slot.id)

    if (error) {
      alert("Errore nel pulire lo slot")
      console.error(error)
      return
    }

    setSlots(slots.map(s => s.id === slot.id ? { ...s, booked_by: null, notes: null } : s))
  }

  const isAdmin = user?.email === ADMIN_EMAIL

  return (
    <div style={{ padding: 40 }}>
      <h1>Agenda slot</h1>

      {!user && (
        <form onSubmit={handleLogin} style={{ marginBottom: 20 }}>
          <input
            type="email"
            placeholder="Email admin"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            required
            style={{ marginRight: 10 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            required
            style={{ marginRight: 10 }}
          />
          <button type="submit">Login</button>
        </form>
      )}

      {user && (
        <div style={{ marginBottom: 20 }}>
          <p>Loggato come: {user.email} {isAdmin && "(Admin)"}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}

      {slots.map(slot => {
        const color = slot.booked_by ? '#ff6b6b' : '#51cf66'

        return (
          <div
            key={slot.id}
            style={{
              background: color,
              padding: "10px",
              margin: "5px",
              borderRadius: "6px",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                cursor: (!slot.booked_by || isAdmin) ? "pointer" : "not-allowed"
              }}
              onClick={() => { if (!isAdmin) bookSlot(slot) }}
            >
              <strong>{new Date(slot.start_time).toLocaleString()}</strong> → {new Date(slot.end_time).toLocaleTimeString()}
            </div>

            {isAdmin && (
              <div style={{ marginTop: 5 }}>
                {slot.booked_by && <div>Utente: {slot.booked_by}</div>}
                {slot.notes && <div>Note: {slot.notes}</div>}

                <button style={{ marginRight: 5 }} onClick={() => editSlot(slot)}>Edit</button>
                <button onClick={() => clearSlot(slot)}>Clear</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
