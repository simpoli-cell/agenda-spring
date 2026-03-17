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

// genera slot futuri (UTC → no problemi DST)
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
        slotsToInsert.push({
          start_time: start.toISOString(),
          end_time: end.toISOString()
        })
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
  if (error) console.error(error)
}

// settimana scorrevole
const getWeekByIndex = (slots: Slot[], index: number) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDay = new Date(today)
  startDay.setDate(today.getDate() + index * 7)

  const week: Slot[][] = []

  for (let i = 0; i < 7; i++) {
    const day = new Date(startDay)
    day.setDate(startDay.getDate() + i)

    const daySlots = slots.filter(s => {
      return new Date(s.start_time).toDateString() === day.toDateString()
    })

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

  // login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput
    })

    if (error) return alert(error.message)

    setUser(data.user)
    setEmailInput('')
    setPasswordInput('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // init
  useEffect(() => {
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)

      await generateFutureSlots(12)

      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .order('start_time')

      if (!error && data) setSlots(data)
    }

    setup()
  }, [])

  // prenotazione
  const bookSlot = async (slot: Slot) => {
    if (slot.booked_by) return alert('Slot già prenotato')

    const name = prompt('Nome') || ''
    const note = prompt('Note (opzionale)') || null

    const { error } = await supabase
      .from('slots')
      .update({ booked_by: name, notes: note })
      .eq('id', slot.id)

    if (!error) {
      setSlots(slots.map(s =>
        s.id === slot.id ? { ...s, booked_by: name, notes: note } : s
      ))
    }
  }

  const editSlot = async (slot: Slot) => {
    const name = prompt('Nome', slot.booked_by || '') || slot.booked_by
    const note = prompt('Note', slot.notes || '') || slot.notes

    const { error } = await supabase
      .from('slots')
      .update({ booked_by: name, notes: note })
      .eq('id', slot.id)

    if (!error) {
      setSlots(slots.map(s =>
        s.id === slot.id ? { ...s, booked_by: name, notes: note } : s
      ))
    }
  }

  const clearSlot = async (slot: Slot) => {
    const { error } = await supabase
      .from('slots')
      .update({ booked_by: null, notes: null })
      .eq('id', slot.id)

    if (!error) {
      setSlots(slots.map(s =>
        s.id === slot.id ? { ...s, booked_by: null, notes: null } : s
      ))
    }
  }

  const week = getWeekByIndex(slots, weekIndex)

  return (
    <div style={{ padding: 20 }}>
      <h1>Agenda</h1>

      {!user && (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email admin"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
          />
          <button type="submit">Login</button>
        </form>
      )}

      {user && (
        <div>
          <p>{user.email} {isAdmin && '(Admin)'}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}

      <div style={{ margin: '10px 0' }}>
        <button
          className="nav-btn"
          onClick={() => setWeekIndex(w => Math.max(w - 1, 0))}
          disabled={weekIndex === 0}
        >
          ←
        </button>

        <button
          className="nav-btn"
          onClick={() => setWeekIndex(w => w + 1)}
          style={{ marginLeft: 10 }}
        >
          →
        </button>
      </div>

      <div className="calendar">
        {week.map((daySlots, dayIndex) => (
          <div key={dayIndex} className="day-column">

            <div className={`day-header ${dayIndex === 0 ? 'today' : ''}`}>
              {daySlots[0]
                ? new Date(daySlots[0].start_time).toLocaleDateString()
                : new Date(Date.now() + (weekIndex * 7 + dayIndex) * 86400000).toLocaleDateString()
              }
            </div>

            {daySlots.map(slot => (
              <div
                key={slot.id}
                className={`slot ${slot.booked_by ? 'booked' : 'free'}`}
                onClick={() => { if (!isAdmin) bookSlot(slot) }}
              >
                <div>
                  {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' - '}
                  {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                {isAdmin && (
                  <>
                    {slot.booked_by && <div>Utente: {slot.booked_by}</div>}
                    {slot.notes && <div>Note: {slot.notes}</div>}

                    <div style={{ marginTop: 5 }}>
                      <button className="btn btn-primary" onClick={() => editSlot(slot)}>
                        Edit
                      </button>
                      <button className="btn btn-secondary" onClick={() => clearSlot(slot)}>
                        Clear
                      </button>
                    </div>
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
