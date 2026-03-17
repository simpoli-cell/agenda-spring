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
  is_booked?: boolean
  user_id?: string | null
}

const ADMIN_EMAIL = 'admin@agenda.com'

export default function CalendarPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [user, setUser] = useState<any>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [formData, setFormData] = useState({
    struttura: '',
    nome_cognome: '',
    scadenza: ''
  })

  const isAdmin = user?.email === ADMIN_EMAIL

  // FETCH SLOT
  const fetchSlots = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const currentUser = session?.user || null
    setUser(currentUser)

    const table = currentUser?.email === ADMIN_EMAIL ? 'slots' : 'public_slots'

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('start_time')

    if (error) {
      console.error('Errore fetch slots:', error.message)
    } else {
      setSlots(data || [])
    }
  }

  useEffect(() => {
    fetchSlots()
  }, [])

  // SALVATAGGIO SLOT
  const handleSubmit = async () => {
    if (!selectedSlot || !user) return

    const payload = {
      struttura: formData.struttura || null,
      nome_cognome: formData.nome_cognome || null,
      scadenza: formData.scadenza || null,
      user_id: user.id  // <- aggiunto qui
    }

    const { data, error } = await supabase
      .from('slots')
      .update(payload)
      .eq('id', selectedSlot.id)

    if (error) {
      console.error('Errore update slot:', error.message)
      alert('Errore update slot: ' + error.message)
    } else {
      await fetchSlots()
      setSelectedSlot(null)
    }
  }

  // PULIZIA SLOT (solo admin)
  const clearSlot = async (slot: Slot) => {
    if (!isAdmin) return

    const { error } = await supabase
      .from('slots')
      .update({ struttura: null, nome_cognome: null, scadenza: null, user_id: null })
      .eq('id', slot.id)

    if (error) {
      console.error('Errore clear slot:', error.message)
      alert('Errore clear slot: ' + error.message)
    } else {
      await fetchSlots()
    }
  }

  // APERTURA FORM
  const openForm = (slot: Slot) => {
    if (!isAdmin && slot.is_booked) return // utenti vedono solo slot rosso
    setSelectedSlot(slot)
    setFormData({
      struttura: slot.struttura || '',
      nome_cognome: slot.nome_cognome || '',
      scadenza: slot.scadenza || ''
    })
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
          onClick={() => setWeekIndex(w => Math.max(w - 1, 0))}
          disabled={weekIndex === 0}
        >
          ←
        </button>
        <button
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

            {daySlots.map(slot => {
              const booked = isAdmin
                ? !!slot.nome_cognome
                : !!slot.is_booked

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

                      {slot.nome_cognome && (
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
                    </>
                  )}
                </div>
              )
            })}
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
