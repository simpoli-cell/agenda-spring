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

const ADMIN_EMAIL = 'admin@agenda.com'

export default function CalendarPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [weekIndex, setWeekIndex] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

  const [formData, setFormData] = useState({
    struttura: '',
    nome_cognome: '',
    scadenza: ''
  })

  const isAdmin = user?.email === ADMIN_EMAIL

  // 🔐 INIT
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user || null

      console.log('USER:', currentUser)

      setUser(currentUser)

      // FETCH sempre (RLS disabilitato → deve funzionare)
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .order('start_time')

      console.log('SLOTS RAW:', data)

      if (error) {
        console.error('FETCH ERROR:', error)
        alert(error.message)
      } else {
        setSlots(data || [])
      }

      setLoading(false)
    }

    init()
  }, [])

  // 📅 calcolo settimana (INDIPENDENTE dagli slot)
  const getWeekDates = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = new Date(today)
    start.setDate(today.getDate() + weekIndex * 7)

    const days: Date[] = []

    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }

    return days
  }

  const weekDates = getWeekDates()

  // 🟢 APRI MODALE
  const openForm = (slot: Slot) => {
    if (!isAdmin && slot.user_id) return

    setSelectedSlot(slot)
    setFormData({
      struttura: slot.struttura || '',
      nome_cognome: slot.nome_cognome || '',
      scadenza: slot.scadenza || ''
    })
  }

  // 💾 SALVA
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
      console.error('SAVE ERROR:', error)
      alert(error.message)
    } else {
      // refresh
      const { data } = await supabase.from('slots').select('*')
      setSlots(data || [])
      setSelectedSlot(null)
    }
  }

  // 🧹 CLEAR
  const clearSlot = async (slot: Slot) => {
    if (!isAdmin) return

    await supabase
      .from('slots')
      .update({
        struttura: null,
        nome_cognome: null,
        scadenza: null,
        user_id: null
      })
      .eq('id', slot.id)

    const { data } = await supabase.from('slots').select('*')
    setSlots(data || [])
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ padding: 20 }}>
      <h1>Agenda</h1>

      {/* DEBUG */}
      <div style={{ marginBottom: 10 }}>
        Slot caricati: {slots.length}
      </div>

      {/* NAV */}
      <div style={{ margin: '10px 0' }}>
        <button onClick={() => setWeekIndex(w => Math.max(w - 1, 0))}>
          ←
        </button>
        <button onClick={() => setWeekIndex(w => w + 1)} style={{ marginLeft: 10 }}>
          →
        </button>
      </div>

      {/* CALENDARIO */}
      <div className="calendar">
        {weekDates.map((day, i) => {
          const daySlots = slots.filter(s =>
            new Date(s.start_time).toDateString() === day.toDateString()
          )

          return (
            <div key={i} className="day-column">
              <div className="day-header">
                {day.toLocaleDateString()}
              </div>

              {daySlots.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.5 }}>
                  Nessuno slot
                </div>
              )}

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
                        {slot.scadenza && <div>{slot.scadenza}</div>}

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
          )
        })}
      </div>

      {/* MODALE */}
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