import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [players, setPlayers] = useState([])
  const [session, setSession] = useState(null)

  // ---------- SESSION CHECK ON LOAD ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('Initial session on load:', data.session)
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session)
      setSession(session)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // ---------- AUTH ----------
  async function handleSignUp() {
    const email = prompt('Enter your email')
    const password = prompt('Enter your password')

    const { data, error } = await supabase.auth.signUp({ email, password })
    console.log('Sign-up result:', data, error)

    if (error) return alert(`Sign-up failed: ${error.message}`)
    if (!data.session) return alert('Sign-up succeeded but no session — check your email for confirmation.')
    alert('Signed up and logged in!')
  }

  async function handleSignIn() {
    const email = prompt('Enter your email')
    const password = prompt('Enter your password')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    console.log('Sign-in result:', data, error)

    if (error) return alert(`Sign-in failed: ${error.message}`)
    if (!data.session) return alert('Sign-in did not create a session — check email confirmation setting.')
    alert('Signed in successfully!')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    alert('Signed out.')
  }

  // ---------- HELPERS ----------
  async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    console.log('Current user from getUser():', user, error)
    return user
  }

  // ---------- CRUD ----------
  async function addPlayer() {
    const user = await getCurrentUser()
    if (!user) return alert('Not logged in')

    const name = prompt('Player name?')
    const classGroup = prompt('Class Group? (e.g., U12)')
    const position = prompt('Position?')

    const newPlayer = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name,
      classGroup, // match DB column exactly
      position
    }

    const { error } = await supabase.from('players').upsert(newPlayer)
    if (error) {
      console.error('Insert failed:', error)
      return alert(`Failed to add player: ${error.message}`)
    }
    alert('Player added!')
  }

  async function addPlan() {
    const user = await getCurrentUser()
    if (!user) return alert('Not logged in')

    const title = prompt('Plan title?')
    const focus = prompt('Plan focus?')

    const newPlan = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title,
      focus
    }

    const { error } = await supabase.from('plans').upsert(newPlan)
    if (error) {
      console.error('Insert failed:', error)
      return alert(`Failed to add plan: ${error.message}`)
    }
    alert('Plan added!')
  }

  async function addSession() {
    const user = await getCurrentUser()
    if (!user) return alert('Not logged in')

    const type = prompt('Session type? (e.g., Training)')
    const group_name = prompt('Group name?')
    const location = prompt('Location?')
    const time = prompt('Time? (HH:MM)')

    const newSession = {
      id: crypto.randomUUID(),
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      type,
      planId: null,
      group_name, // matches DB schema
      location,
      time
    }

    const { error } = await supabase.from('sessions').upsert(newSession)
    if (error) {
      console.error('Insert failed:', error)
      return alert(`Failed to add session: ${error.message}`)
    }
    alert('Session added!')
  }

  async function addGrading() {
    const user = await getCurrentUser()
    if (!user) return alert('Not logged in')

    const area = prompt('Grading area?')
    const belt = prompt('Belt color?')
    const skillsInput = prompt('Skills (comma separated)?')
    const skills = skillsInput.split(',').map(s => s.trim())
    const passSkillPct = Number(prompt('Pass skill percentage?'))
    const minAvgScore = Number(prompt('Minimum average score?'))
    const minAttendancePct = Number(prompt('Minimum attendance percentage?'))
    const minSessions = Number(prompt('Minimum number of sessions?'))

    const newGrading = {
      id: crypto.randomUUID(),
      user_id: user.id,
      area,
      belt,
      skills,
      passSkillPct,
      minAvgScore,
      minAttendancePct,
      minSessions
    }

    const { error } = await supabase.from('gradings').upsert(newGrading)
    if (error) {
      console.error('Insert failed:', error)
      return alert(`Failed to add grading: ${error.message}`)
    }
    alert('Grading added!')
  }

  async function addBranding() {
    const user = await getCurrentUser()
    if (!user) return alert('Not logged in')

    const logoDataUrl = prompt('Paste logo data URL?')

    const newBranding = {
      id: crypto.randomUUID(),
      user_id: user.id,
      logoDataUrl
    }

    const { error } = await supabase.from('branding').upsert(newBranding)
    if (error) {
      console.error('Insert failed:', error)
      return alert(`Failed to add branding: ${error.message}`)
    }
    alert('Branding added!')
  }

  // ---------- UI ----------
  return (
    <div>
      <h1>App</h1>
      <p>Current session: {session ? session.user.email : 'Not logged in'}</p>
      <button onClick={handleSignUp}>Sign Up</button>
      <button onClick={handleSignIn}>Sign In</button>
      <button onClick={handleSignOut}>Sign Out</button>
      <hr />
      <button onClick={addPlayer}>Add Player</button>
      <button onClick={addPlan}>Add Plan</button>
      <button onClick={addSession}>Add Session</button>
      <button onClick={addGrading}>Add Grading</button>
      <button onClick={addBranding}>Add Branding</button>
    </div>
  )
}
