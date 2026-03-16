'use client'

import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {

  useEffect(() => {
    const testDB = async () => {
      const { data, error } = await supabase.from('slots').select('*')

      console.log('DATA:', data)
      console.log('ERROR:', error)
    }

    testDB()
  }, [])

  return (
    <div>
      <h1>Test connessione database</h1>
      <p>Apri la console del browser</p>
    </div>
  )
}
