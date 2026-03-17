'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Slot = {
  id: string
  start_time: string
  end_time: string
  struttura?: string | null
  nome_cognome?: string | null
  scadenza?: string | null
  user_id?: string | null
}

const ADMIN_EMAIL = 'admin@tuoemail.com'

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
  const [weekIndex, setWeekIndex] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

  const [formData, setFormData] = useState({
    struttura: '',
    nome_cognome: '',
    scadenza: ''
  })

  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  const isAdmin = user?.email === ADMIN_EMAIL

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

  const fetchSlots = async () => {
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .order('start_time')

    if (error) {
      console.error('Errore fetch:', error.message)
      alert(error.message)
      return
    }

    setSlots(data || [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      await fetchSlots()
    }

    init()
  }, [])

  const openForm = (slot: Slot) => {
    if (!isAdmin && slot.user_id) return

    setSelectedSlot(slot)
    setFormData({
      struttura: slot.struttura || '',
      nome_cognome: slot.nome_cognome || '',
      scadenza: slot.scadenza || ''
    })
  }

  const handleSubmit = async () => {
    if (!selectedSlot || !user) return

    const { error } = await supabase
      .from('slots')
      .update({
        struttura: formData.struttura || null,
        nome_cognome: formData.nome_cognome || null,
        scadenza: formData.scadenza || null,
        user_id: user.id
      })
      .eq('id', selectedSlot.id)

    if (error) {
      console.error('Errore save:', error.message)
      alert(error.message)
    } else {
      await fetchSlots()
      setSelectedSlot(null)
    }
  }

  const clearSlot = async (slot: Slot) => {
    if (!isAdmin) return

    const { error } = await supabase
      .from('slots')
      .update({
        struttura: null,
        nome_cognome: null,
        scadenza: null,
        user_id: null
      })
      .eq('id', slot.id)

    if (!error) await fetchSlots()
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
        <button onClick={() => setWeekIndex(w => Math.max(w - 1, 0))}>
          ←
        </button>
        <button onClick={() => setWeekIndex(w => w + 1)} style={{ marginLeft: 10 }}>
          →
        </button>
      </div>

      <div className="calendar">
        {week.map((daySlots, i) => (
          <div key={i} className="day-column">
            <div className="day-header">
              {daySlots[0]
                ? new Date(daySlots[0].start_time).toLocaleDateString()
                : ''}
            </div>

            {daySlots.map(slot => {
              const booked = !!slot.user_id

              return (
                <div
                  key={slot.id}
                  className={`slot ${booked ? 'booked' : 'free'}`}
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

                      {slot.user_id && (
                        <button onClick={(e) => {
                          e.stopPropagation()
                          clearSlot(slot)
                        }}>
                          Clear
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {selectedSlot && (
        <div className="modal">
          <div className="modal-content">
            <h3>Gestione slot</h3>

            <input
              placeholder="Struttura"
              value={formData.struttura}
              onChange={e => setFormData({ ...formData, struttura: e.target.value })}
            />

            <input
              placeholder="Nome e Cognome"
              value={formData.nome_cognome}
              onChange={e => setFormData({ ...formData, nome_cognome: e.target.value })}
            />

            <input
              type="date"
              value={formData.scadenza}
              onChange={e => setFormData({ ...formData, scadenza: e.target.value })}
            />

            <button onClick={handleSubmit}>Salva</button>
            <button onClick={() => setSelectedSlot(null)}>Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}