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
}

const ADMIN_EMAIL = 'admin@agenda.com'

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

  const isAdmin = user?.email === ADMIN_EMAIL

  // FETCH SLOT FUNZIONE GENERALE
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
      alert('Errore fetch slots: ' + error.message)
    } else {
      setSlots(data || [])
    }
  }

  useEffect(() => {
    fetchSlots()
  }, [])

  // SALVATAGGIO SLOT (ADMIN)
  const handleSubmit = async () => {
    if (!selectedSlot) return

    const payload = {
      struttura: formData.struttura || null,
      nome_cognome: formData.nome_cognome || null,
      scadenza: formData.scadenza || null
    }

    const { data, error } = await supabase
      .from('slots')
      .update(payload)
      .eq('id', selectedSlot.id)

    if (error) {
      console.error('Errore update slot:', error.message)
      alert('Errore update slot: ' + error.message)
    } else {
      console.log('Slot aggiornato:', data)
      await fetchSlots()
      setSelectedSlot(null)
    }
  }

  const clearSlot = async (slot: Slot) => {
    const { error } = await supabase
      .from('slots')
      .update({ struttura: null, nome_cognome: null, scadenza: null })
      .eq('id', slot.id)

    if (error) {
      console.error('Errore clear slot:', error.message)
      alert('Errore clear slot: ' + error.message)
    } else {
      await fetchSlots()
    }
  }

  const openForm = (slot: Slot) => {
    if (!isAdmin && (slot.is_booked || slot.nome_cognome)) return
    setSelectedSlot(slot)
    setFormData({
      struttura: slot.struttura || '',
      nome_cognome: slot.nome_cognome || '',
      scadenza: slot.scadenza || ''
    })
  }

  // render semplificato
  return (
    <div style={{ padding: 20 }}>
      <h1>Agenda</h1>
      <div className="calendar">
        {slots.map(slot => {
          const booked = isAdmin ? !!slot.nome_cognome : !!slot.is_booked
          return (
            <div
              key={slot.id}
              className={`slot ${booked ? 'booked' : 'free'}`}
              onClick={() => openForm(slot)}
            >
              {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' - '}
              {new Date(slot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

              {isAdmin && slot.nome_cognome && (
                <button onClick={e => { e.stopPropagation(); clearSlot(slot) }}>Clear</button>
              )}
            </div>
          )
        })}
      </div>

      {selectedSlot && (
        <div className="popup">
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
          <button onClick={handleSubmit}>Salva</button>
          <button onClick={() => setSelectedSlot(null)}>Annulla</button>
        </div>
      )}
    </div>
  )
}
