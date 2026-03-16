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

const ADMIN_EMAIL = 'admin@agenda.com'

// genera slot futuri (UTC per DST)
const generateFutureSlots = async (monthsAhead: number = 6) => {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + monthsAhead)

  const slotsToInsert: { start_time: string; end_time: string }[] = []

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    for (let h = 8; h < 17; h++) {
      for (let m = 0; m < 60; m += 30) {
        const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), h, m))
        const end = new Date(start.getTime() + 30 * 60000)
        slotsToInsert.push({ start_time: start.toISOString(), end_time: end.toISOString() })
      }
    }
  }

  const { data: existingSlots } = await supabase
    .from('slots')
    .select('start_time')
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString())

  const existingStartTimes = new Set(existingSlots?.map(s => s.start_time))
  const newSlots = slotsToInsert.filter(s => !existingStartTimes.has(s.start_time))

  if (newSlots.length === 0) return

  const { error } = await supabase.from('slots').insert(newSlots)
  if (error) console.error('Errore generazione slot futuri:', error)
}

// ottieni settimana di 7 giorni a partire dall’indice
const getWeekByIndex = (slots: Slot[], index: number) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDay = new Date(today)
  startDay.setDate(today.getDate() + index * 7)

  const week: Slot[][] = []

  for (let i = 0; i < 7; i++) {
    const day = new Date(startDay)
    day.setDate(startDay.getDate() + i)
    const daySlots = slots.filter(s => new Date(s.start_time).toDateString() === day.toDateString())
    week.push(daySlots)
  }

  return week
}

export default function CalendarPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [user, setUser] = useState<any>(null)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [weekIndex, setWeekIndex] = useState(0)

  const isAdmin = user?.email === ADMIN_EMAIL

  // login admin
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput
    })
    if (error) return alert('Login fallito: ' + error.message)
    setUser(data.user)
    setEmailInput('')
    setPasswordInput('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // fetch utente loggato e genera slot futuri
  useEffect(() => {
    const setupSlots = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)

      await generateFutureSlots(12)

      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .order('start_time')
      if (error) console.error(error)
      else setSlots(data || [])
    }
    setupSlots()
  }, [])

  // prenotazione utente normale
  const bookSlot = async (slot: Slot) => {
    if (slot.booked_by) return alert('Slot già prenotato!')
    const name = prompt('Inserisci il tuo nome:') || ''
    const note = prompt('Inserisci eventuale nota (opzionale):') || null

    const { error } = await supabase
      .from('slots')
      .update({ booked_by: name, notes: note })
      .eq('id', slot.id)

    if (error) console.error(error)
    else setSlots(slots.map(s => (s.id === slot.id ? { ...s, booked_by: name, notes: note } : s)))
  }

  const editSlot = async (slot: Slot) => {
    const name = prompt('Nome:', slot.booked_by || '') || slot.booked_by
    const note = prompt('Note:', slot.notes || '') || slot.notes

    const { error } = await supabase
      .from('slots')
      .update({ booked_by: name, notes: note })
      .eq('id', slot.id)

    if (error) console.error(error)
    else setSlots(slots.map(s => (s.id === slot.id ? { ...s, booked_by: name, notes: note } : s)))
  }

  const clearSlot = async (slot: Slot) => {
    const { error } = await supabase
      .from('slots')
      .update({ booked_by: null, notes: null })
      .eq('id', slot.id)

    if (error) console.error(error)
    else setSlots(slots.map(s => (s.id === slot.id ? { ...s, booked_by: null, notes: null } : s)))
  }

  const week = getWeekByIndex(slots, weekIndex)

  return (
    <div style={{ padding: 20 }}>
      <h1>Agenda fino al 31/12/2026</h1>

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
          <p>Loggato come: {user.email} {isAdmin && '(Admin)'}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}

      {/* pulsanti navigazione settimane */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setWeekIndex(w => Math.max(w - 1, 0))} disabled={weekIndex === 0}>← Settimana precedente</button>
        <button onClick={() => setWeekIndex(w => w + 1)} style={{ marginLeft: 10 }}>Settimana successiva →</button>
      </div>

      {/* griglia settimana */}
      <div style={{ display: 'flex', overflowX: 'auto' }}>
        {week.map((daySlots, dayIndex) => (
          <div key={dayIndex} style={{ minWidth: 150, marginRight: 10 }}>
            <h4>{daySlots[0] ? new Date(daySlots[0].start_time).toLocaleDateString() :
                 new Date(Date.now() + (weekIndex * 7 + dayIndex) * 86400000).toLocaleDateString()}</h4>
            {daySlots.map(slot => (
              <div key={slot.id} style={{
                background: slot.booked_by ? '#ff6b6b' : '#51cf66',
                marginBottom: 5,
                padding: 5,
                borderRadius: 4
              }}>
                <div style={{ cursor: (!slot.booked_by || isAdmin) ? 'pointer' : 'not-allowed' }}
                     onClick={() => { if (!isAdmin) bookSlot(slot) }}>
                  {new Date(slot.start_time).toLocaleTimeString()} - {new Date(slot.end_time).toLocaleTimeString()}
                </div>
                {isAdmin && (
                  <>
                    {slot.booked_by && <div>Utente: {slot.booked_by}</div>}
                    {slot.notes && <div>Note: {slot.notes}</div>}
                    <button onClick={() => editSlot(slot)}>Edit</button>
                    <button onClick={() => clearSlot(slot)}>Clear</button>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
