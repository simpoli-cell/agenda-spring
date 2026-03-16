'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setErrorMsg(error.message)
    } else {
      router.push('/calendar')
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Login Admin</h1>
      <input 
        type="email" 
        placeholder="Email" 
        value={email} 
        onChange={e => setEmail(e.target.value)} 
        style={{ display:"block", marginBottom:10 }}
      />
      <input 
        type="password" 
        placeholder="Password" 
        value={password} 
        onChange={e => setPassword(e.target.value)} 
        style={{ display:"block", marginBottom:10 }}
      />
      <button onClick={handleLogin}>Login</button>
      {errorMsg && <p style={{color:'red'}}>{errorMsg}</p>}
    </div>
  )
}
