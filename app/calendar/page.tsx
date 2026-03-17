'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Slot = {
  id: string
  start_time: string
  end_time: string
  struttura: string | null
  nome_cognome: string | null
  scadenza: string | null
}

const ADMIN_EMAIL = 'admin@agenda.com'

// genera slot futuri
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

  const existingSet = new Set(existingSlots?.map(s => s.start_time))
  const newSlots = slotsToInsert.filter(s => !existingSet.has(s.start_time))

  if (newSlots.length > 0) {
    await supabase.from('slots').insert(newSlots)
  }
}

// settimana
const getWeekByIndex = (slots: Slot[], index: number) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDay = new Date(today)
  startDay.setDate(today.getDate() + index * 7)

  const week: Slot[][] = []

  for (let i = 0; i < 7; i++) {
    const day = new Date(startDay)
    day.setDate(startDay.getDate() + i)

    const daySlots = slots.filter(s =>
      new Date(s.start_time).toDateString() === day.toDateString()
    )

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

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

  const [formData, setFormData] = useState({
    struttura: '',
    nome_cognome: '',
    scadenza: ''
  })

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

      const { data } = await supabase
        .from('slots')
        .select('*')
        .order('start_time')

      if (data) setSlots(data)
    }

    setup()
  }, [])

  // apertura popup
  const openForm = (slot: Slot) => {
    if (!isAdmin && slot.nome_cognome) return

    setSelectedSlot(slot)

    setFormData({
      struttura: slot.struttura || '',
      nome_cognome: slot.nome_cognome || '',
      scadenza: slot.scadenza || ''
    })
  }

  // salva
  const handleSubmit = async () => {
    if (!selectedSlot) return

    const { error } = await supabase
      .from('slots')
      .update(formData)
      .eq('id', selectedSlot.id)

    if (!error) {
      setSlots(slots.map(s =>
        s.id === selectedSlot.id ? { ...s, ...formData } : s
      ))

      setSelectedSlot(null)
    }
  }

  // pulisci (admin)
  const clearSlot = async (slot: Slot) => {
    const { error } = await supabase
      .from('slots')
      .update({
        struttura: null,
        nome_cognome: null,
        scadenza: null
      })
      .eq('id', slot.id)

    if (!error) {
      setSlots(slots.map(s =>
        s.id === slot.id
          ? { ...s, struttura: null, nome_cognome: null, scadenza: null }
          : s
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
            placeholder="Email"
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
                className={`slot ${slot.nome_cognome ? 'booked' : 'free'}`}
                onClick={() => openForm(slot)}
              >
                <div>
                  {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' - '}
                  {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              {isAdmin && (
                <>

                  {slot.struttura && <div>{slot.struttura}</div>}
                  {slot.nome_cognome && <div>{slot.nome_cognome}</div>}
                  {slot.scadenza && <div>Scadenza: {slot.scadenza}</div>}

                </>
              )}
                {isAdmin && slot.nome_cognome && (
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearSlot(slot)
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectedSlot && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'white',
            padding: 20,
            borderRadius: 10,
            width: 300
          }}>
            <h3>Gestione slot</h3>

            <input
              placeholder="Nome struttura"
              value={formData.struttura}
              onChange={e => setFormData({ ...formData, struttura: e.target.value })}
            />

            <input
              placeholder="Nome e cognome"
              value={formData.nome_cognome}
              onChange={e => setFormData({ ...formData, nome_cognome: e.target.value })}
            />

            <input
              type="date"
              value={formData.scadenza}
              onChange={e => setFormData({ ...formData, scadenza: e.target.value })}
            />

            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary" onClick={handleSubmit}>
                Salva
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setSelectedSlot(null)}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
