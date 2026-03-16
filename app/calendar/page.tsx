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

// funzione per generare slot futuri
const generateFutureSlots = async (monthsAhead: number = 12) => {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + monthsAhead)

  const slotsToInsert: { start_time: string; end_time: string }[] = []

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    for (let h = 9; h < 17; h++) {
      for (let m = 0; m < 60; m += 30) {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m)
        const end = new Date(start.getTime() + 30 * 60000)
        slotsToInsert.push({
          start_time: start.toISOString(),
          end_time: end.toISOString()
        })
      }
    }
  }

  // recupera slot già esistenti
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

export default function CalendarPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [user, setUser] = useState<any>(null)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0)

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

      await generateFutureSlots(12) // genera 12 mesi avanti se mancanti

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

  // edit slot admin
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

  // clear slot admin
  const clearSlot = async (slot: Slot) => {
    const { error } = await supabase
      .from('slots')
      .update({ booked_by: null, notes: null })
      .eq('id', slot.id)

    if (error) console.error(error)
    else setSlots(slots.map(s => (s.id === slot.id ? { ...s, booked_by: null, notes: null } : s)))
  }

  // suddivisione in settimane
  const getWeeks = (slots: Slot[]) => {
    const weeks: Slot[][][] = []
    if (!slots.length) return weeks
    const sortedSlots = slots.slice().sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    let currentWeek: Slot[][] = []
    let currentDay: Slot[] = []
    let currentDate = new Date(sortedSlots[0].start_time).toDateString()
    for (const slot of sortedSlots) {
      const slotDate = new Date(slot.start_time).toDateString()
      if (slotDate !== currentDate) {
        currentWeek.push(currentDay)
        currentDay = []
        currentDate = slotDate
        if (currentWeek.length === 7) {
          weeks.push(currentWeek)
          currentWeek = []
        }
      }
      currentDay.push(slot)
    }
    if (currentDay.length) currentWeek.push(currentDay)
    if (currentWeek.length) weeks.push(currentWeek)
    return weeks
  }

  const weeks = getWeeks(slots)
  const prevWeek = () => setCurrentWeekIndex(i => Math.max(i - 1, 0))
  const nextWeek = () => setCurrentWeekIndex(i => Math.min(i + 1, weeks.length - 1))

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

      <div style={{ marginBottom: 10 }}>
        <button onClick={prevWeek} disabled={currentWeekIndex === 0}>← Settimana precedente</button>
        <button onClick={nextWeek} disabled={currentWeekIndex === weeks.length - 1} style={{ marginLeft: 10 }}>Settimana successiva →</button>
      </div>

      <div style={{ display: 'flex', overflowX: 'auto' }}>
        {weeks[currentWeekIndex]?.map((daySlots, dayIndex) => (
          <div key={dayIndex} style={{ minWidth: 150, marginRight: 10 }}>
            <h4>{new Date(daySlots[0].start_time).toLocaleDateString()}</h4>
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
