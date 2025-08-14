import React, { useEffect, useState } from 'react'
import { Btn, Table, Th, Td, Section, Chip } from './components/ui/kit.jsx'
import { supabase } from './lib/supabase'

// ---------- helpers & constants ----------
const uid = () => Math.random().toString(36).slice(2, 10)
const fmt = d => new Date(d).toLocaleDateString()
const todayISO = () => new Date().toISOString().slice(0, 10)
const addMonths = (iso, m) => { const d = new Date(iso); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10) }
const dayShort = (iso) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(iso).getDay()]

const BELT_LEVELS = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Black']
const AREAS = ['Goalkeeping', 'Defending', 'Midfield', 'Attacking', 'Soccer Understanding']
const CORNER = ['Below', 'At', 'Above']
const GROUPS = ['8-2-1', '1-2-1', '1-2-2', '1-2-4']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const beltIndex = (b) => Math.max(0, BELT_LEVELS.indexOf(b))
const nextBelt = (b) => BELT_LEVELS[Math.min(BELT_LEVELS.length - 1, beltIndex(b) + 1)]

// ---------- main app ----------
export default function App() {
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [tab, setTab] = useState('plans')
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)

  const [players, setPlayers] = useState([])
  const [plans, setPlans] = useState([])
  const [sessions, setSessions] = useState([])
  const [gradings, setGradings] = useState([])
  const [logoDataUrl, setLogoDataUrl] = useState(null)

  // form states
  const [playerForm, setPlayerForm] = useState({
    name: '', classGroup: GROUPS[0], position: '', parentEmail: '',
    joinDate: todayISO(),
    belts: Object.fromEntries(AREAS.map(a => [a, 'White'])),
    gradingHistory: [],
    attendanceDays: [],
    location: '', time: ''
  })
  const [planForm, setPlanForm] = useState({
    title: '', focus: '', description: '', topics: '', image: '',
    format: GROUPS[0],
    defaultLocation: '', defaultTime: ''
  })
  const [sessForm, setSessForm] = useState({
    date: todayISO(), type: 'Training', planId: '', group: '',
    location: '', time: '', attendees: [], respectDays: true
  })
  const [gradingForm, setGradingForm] = useState({
    area: 'Midfield', belt: 'Yellow', skills: '',
    passSkillPct: 100, minAvgScore: 0, minAttendancePct: 0, minSessions: 0
  })
  const [reportGroup, setReportGroup] = useState('')

  // -------- auth listener --------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // -------- load data + realtime --------
  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [p, pl, s, g, b] = await Promise.all([
        supabase.from('players').select('*'),
        supabase.from('plans').select('*'),
        supabase.from('sessions').select('*'),
        supabase.from('gradings').select('*'),
        supabase.from('branding').select('*').maybeSingle()
      ])
      setPlayers(p.data || [])
      setPlans(pl.data || [])
      setSessions((s.data || []).sort((a, b) => a.date < b.date ? 1 : -1))
      setGradings(g.data || [])
      if (b?.data?.logoDataUrl) setLogoDataUrl(b.data.logoDataUrl)
    }
    load()
    const ch = supabase.channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gradings' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branding' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  // -------- auth handlers --------
  const handleSignIn = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }
  const handleSignUp = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }
  const handleSignOut = async () => { await supabase.auth.signOut() }

  // login screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
          <h2 className="text-xl font-bold mb-6 text-center">
            {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h2>
          {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
          <input type="email" placeholder="Email" className="border rounded w-full p-2 mb-3"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="border rounded w-full p-2 mb-4"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="bg-blue-600 text-white w-full py-2 rounded mb-3"
            onClick={authMode === 'signin' ? handleSignIn : handleSignUp} disabled={loading}>
            {loading ? 'Loading...' : authMode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
          <p className="text-sm text-center">
            {authMode === 'signin' ? (
              <>Don’t have an account?{' '}
                <button className="text-blue-600" onClick={() => setAuthMode('signup')}>Sign Up</button></>
            ) : (
              <>Already have an account?{' '}
                <button className="text-blue-600" onClick={() => setAuthMode('signin')}>Sign In</button></>
            )}
          </p>
        </div>
      </div>
    )
  }

// ---------- helpers for sessions/players ----------
  const playerSessions = id => sessions.filter(s=> (s.attendees||[]).includes(id)).sort((a,b)=>a.date>b.date?1:-1)
  const attendancePct = id => { const total=sessions.length; if(!total) return 0; const att=playerSessions(id).length; return Math.round(att/total*100) }
  const avgScore = id => { const list=playerSessions(id).map(s=>s.notes?.[id]?.score).filter(n=>typeof n==='number'); if(!list.length) return null; const sum=list.reduce((a,b)=>a+b,0); return (sum/list.length).toFixed(1) }
  const nextGrade = p => fmt(addMonths(p.lastGradedDate||p.joinDate||todayISO(),2))
  const onPlanImage = (file) => new Promise((resolve,reject)=>{ if(!file) return resolve(''); const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file) })

  // ---------- CRUD actions with Supabase ----------
  const addPlan = async (e) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Not logged in');
    e.preventDefault()
    if(!planForm.title) return alert('Plan title required')
    const imgFile = e.target.querySelector("input[type='file']").files[0]
    const dataUrl = await onPlanImage(imgFile)
    const p = { id:uid(), user_id: user.id, ...planForm, image:dataUrl }
    setPlans(v=>[p, ...v])
    await supabase.from('plans').upsert(p)
    setPlanForm({title:'',focus:'',description:'',topics:'',image:'',format:GROUPS[0],defaultLocation:'',defaultTime:''})
  }

  const usePlanToSchedule = (planId) => {
    const pl = plans.find(x=>x.id===planId)
    setTab('sessions')
    setSessForm(v=>({...v, planId, group: pl?.format||'', location: pl?.defaultLocation||'', time: pl?.defaultTime||''}))
  }

  const addSession = async (e) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Not logged in');
    e.preventDefault()
    if(!sessForm.date || !sessForm.planId) return alert('Select a date and a plan')
    const s = { id:uid(), user_id: user.id, ...sessForm, notes:{} }
    setSessions(v=>[s, ...v].sort((a,b)=> a.date<b.date?1:-1))
    await supabase.from('sessions').upsert(s)
    setSessForm({date:todayISO(), type:'Training', planId:'', group:'', location:'', time:'', attendees:[], respectDays:true})
  }

  const toggleAttendee=async(sid,pid)=>{
    const updatedSessions = sessions.map(s=>s.id!==sid?s:{...s,attendees:s.attendees.includes(pid)?s.attendees.filter(x=>x!==pid):[...s.attendees,pid]})
    setSessions(updatedSessions)
    const session = updatedSessions.find(s=>s.id===sid)
    await supabase.from('sessions').update({ attendees: session.attendees }).eq('id', sid)
  }

  const updateNote=async(sid,pid,patch)=>{
    const updatedSessions = sessions.map(s=>{
      if(s.id!==sid) return s
      const cur=s.notes?.[pid]||{}
      return {...s,notes:{...s.notes,[pid]:{...cur,...patch}}}
    })
    setSessions(updatedSessions)
    const session = updatedSessions.find(s=>s.id===sid)
    await supabase.from('sessions').update({ notes: session.notes }).eq('id', sid)
  }

  const addPlayer = async (e) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Not logged in');
    e.preventDefault()
    if(!playerForm.name) return alert('Name required')
    const newPlayer = { id:uid(), user_id: user.id, ...playerForm }
    setPlayers(v=>[...v,newPlayer])
    await supabase.from('players').upsert(newPlayer)
    setPlayerForm({name:'',classGroup:GROUPS[0],position:'',parentEmail:'',joinDate:todayISO(),belts:Object.fromEntries(AREAS.map(a=>[a,'White'])),gradingHistory:[],attendanceDays:[],location:'',time:''})
  }

  const updateBelt=async(pid,area,belt)=>{
    const updatedPlayers = players.map(p=>p.id!==pid?p:{...p,belts:{...p.belts,[area]:belt}})
    setPlayers(updatedPlayers)
    const player = updatedPlayers.find(p=>p.id===pid)
    await supabase.from('players').update({ belts: player.belts }).eq('id', pid)
  }

  const markGraded=async(pid)=>{
    const updatedPlayers = players.map(p=>p.id!==pid?p:{...p,lastGradedDate:todayISO()})
    setPlayers(updatedPlayers)
    await supabase.from('players').update({ lastGradedDate: todayISO() }).eq('id', pid)
  }

  const upsertGradingRule = async (e)=>{
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Not logged in');
    e.preventDefault()
    const skills = gradingForm.skills.split(',').map(s=>s.trim()).filter(Boolean)
    const rule = {
      id:uid(),
      user_id: user.id,
      area:gradingForm.area,
      belt:gradingForm.belt,
      skills,
      passSkillPct:Number(gradingForm.passSkillPct)||100,
      minAvgScore:Number(gradingForm.minAvgScore)||0,
      minAttendancePct:Number(gradingForm.minAttendancePct)||0,
      minSessions:Number(gradingForm.minSessions)||0
    }
    const rest = gradings.filter(g=>!(g.area===rule.area && g.belt===rule.belt))
    setGradings([rule, ...rest])
    await supabase.from('gradings').upsert(rule)
    setGradingForm({area:'Midfield',belt:'Yellow',skills:'',passSkillPct:100,minAvgScore:0,minAttendancePct:0,minSessions:0})
  }

  const removeGradingRule = async (id)=>{
    setGradings(prev=>prev.filter(g=>g.id!==id))
    await supabase.from('gradings').delete().eq('id', id)
  }

  const onLogoChange = async (file)=>{
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Not logged in');
    const r = new FileReader()
    r.onload = async () => {
      const dataUrl = r.result
      setLogoDataUrl(dataUrl)
      await supabase.from('branding').upsert({ id: 'singleton', user_id: user.id, logoDataUrl: dataUrl })
    }
    if(file) r.readAsDataURL(file)
  }

  const autoSelectAttendees = () => {
    if(!sessForm.group){ alert('Pick a plan first'); return }
    const d = dayShort(sessForm.date)
    const setIds = players.filter(p => p.classGroup===sessForm.group && ( !sessForm.respectDays || (p.attendanceDays||[]).includes(d) ) ).map(p=>p.id)
    setSessForm(v=>({...v, attendees: Array.from(new Set([...(v.attendees||[]), ...setIds])) }))
  }

  const Nav = ({onTab, current}) => (
    <div className='grid grid-cols-2 md:grid-cols-8 gap-3 mb-8'>
      {['Plans','Sessions','Players','Attendance','Results','Grading','Reports','Branding'].map((label)=> (
        <Btn key={label} variant='outline' className={`h-12 ${current===label.toLowerCase()?'ring-2 ring-accent':''}`} onClick={()=>onTab(label.toLowerCase())}>{label}</Btn>
      ))}
    </div>
  )

  // ---------- header ----------
  return (
    <div className='p-8 max-w-7xl mx-auto'>
      <header className='flex items-center justify-between mb-8'>
        <div className='flex items-center gap-3'>
          <img src={logoDataUrl || '/logo.png'} className='h-10 w-10 rounded-full'/>
          <div className='font-bold text-lg'>Help Soccer Coach</div>
        </div>
        <button className='text-sm border rounded px-2 py-1' onClick={handleSignOut}>Sign out</button>
      </header>

      {
selectedPlayerId ? (
  <div className='space-y-6'>
    <Btn variant='outline' onClick={() => setSelectedPlayerId(null)}>← Back to list</Btn>
    <Section title={`Player Dashboard — ${players.find(p => p.id === selectedPlayerId)?.name || ''}`}>
      <div className='mb-4 text-sm text-slate-600'>
        Group: {players.find(p=>p.id===selectedPlayerId)?.classGroup || '—'} ·
        Position: {players.find(p=>p.id===selectedPlayerId)?.position || '—'} ·
        Joined: {players.find(p=>p.id===selectedPlayerId)?.joinDate || '—'}
      </div>
      <div className='mb-6'>
        Attendance: {attendancePct(selectedPlayerId)}% ({playerSessions(selectedPlayerId).length} / {sessions.length})
      </div>
      <div className='grid md:grid-cols-3 gap-2 mb-6'>
        {AREAS.map(area => (
          <div key={area} className='flex justify-between border rounded p-2'>
            <span>{area}</span>
            <select value={players.find(p=>p.id===selectedPlayerId)?.belts?.[area] || 'White'}
              onChange={e=>updateBelt(selectedPlayerId, area, e.target.value)}>
              {BELT_LEVELS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
        ))}
      </div>
      
<Section title='Sessions Attended'>
  {playerSessions(selectedPlayerId).map(s => {
    const note = s.notes?.[selectedPlayerId] || { score: '', fourCorners: {}, comment: '' };
    return (
      <div key={s.id} className='mb-4 p-3 border rounded'>
        <div className='font-semibold mb-1'>
          {fmt(s.date)} — {s.type} — {plans.find(p=>p.id===s.planId)?.title || '—'}
        </div>
        <div className='grid grid-cols-5 gap-2 mb-2'>
          <input
            type='number'
            placeholder='Score'
            value={note.score || ''}
            onChange={e => updateNote(s.id, selectedPlayerId, { score: e.target.value })}
            className='border rounded p-1 text-sm'
          />
          {['technical','physical','psychological','social'].map(corner => (
            <input
              key={corner}
              type='number'
              placeholder={corner}
              value={note.fourCorners?.[corner] || ''}
              onChange={e => updateNote(s.id, selectedPlayerId, {
                fourCorners: {
                  ...note.fourCorners,
                  [corner]: e.target.value
                }
              })}
              className='border rounded p-1 text-sm'
            />
          ))}
        </div>
        <textarea
          placeholder='Comments'
          value={note.comment || ''}
          onChange={e => updateNote(s.id, selectedPlayerId, { comment: e.target.value })}
          className='border rounded p-1 w-full text-sm'
        />
      </div>
    );
  })}
</Section>

      <Section title='Grading History'>
        {players.find(p=>p.id===selectedPlayerId)?.gradingHistory?.length
          ? players.find(p=>p.id===selectedPlayerId).gradingHistory.map((g,i)=>(
              <div key={i} className='text-sm'>{g.date} — {g.belt}</div>
            ))
          : <div className='text-sm text-slate-500'>No grading history</div>}
      </Section>
    </Section>
  </div>
) :
 <Nav onTab={setTab} current={tab}/>}

      {!selectedPlayerId && tab==='plans' && (
        <div className='grid md:grid-cols-2 gap-6'>
          <Section title='Create plan (repository)'>
            <form onSubmit={addPlan} className='grid gap-3'>
              <input className='border rounded p-2' placeholder='Plan title' value={planForm.title} onChange={e=>setPlanForm({...planForm,title:e.target.value})}/>
              <input className='border rounded p-2' placeholder='Focus (e.g., Turning, Pressing, GK Handling)' value={planForm.focus} onChange={e=>setPlanForm({...planForm,focus:e.target.value})}/>
              <textarea className='border rounded p-2' rows='3' placeholder='Description / coaching points' value={planForm.description} onChange={e=>setPlanForm({...planForm,description:e.target.value})}></textarea>
              <input className='border rounded p-2' placeholder='Topics (comma separated)' value={planForm.topics} onChange={e=>setPlanForm({...planForm,topics:e.target.value})}/>
              <div className='grid md:grid-cols-3 gap-3'>
                <div>
                  <label className='text-sm'>Format</label>
                  <select className='border rounded p-2 w-full' value={planForm.format} onChange={e=>setPlanForm({...planForm,format:e.target.value})}>
                    {GROUPS.map(g=> <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className='text-sm'>Default location</label>
                  <input className='border rounded p-2 w-full' value={planForm.defaultLocation} onChange={e=>setPlanForm({...planForm,defaultLocation:e.target.value})}/>
                </div>
                <div>
                  <label className='text-sm'>Default time</label>
                  <input type='time' className='border rounded p-2 w-full' value={planForm.defaultTime} onChange={e=>setPlanForm({...planForm,defaultTime:e.target.value})}/>
                </div>
              </div>
              <div><label className='text-sm block mb-1'>Image (optional)</label><input type='file' accept='image/*' className='block w-full'/></div>
              <Btn>Create plan</Btn>
            </form>
          </Section>

          <Section title='Plan repository'>
            <div className='grid gap-3'>
              {plans.length===0 && <div className='text-sm text-slate-500'>No plans yet. Create one on the left.</div>}
              {plans.map(p=> (
                <div key={p.id} className='border rounded-xl p-3 flex gap-3'>
                  {p.image && <img src={p.image} className='h-20 w-20 object-cover rounded' alt='plan'/>}
                  <div className='flex-1'>
                    <div className='font-semibold'>{p.title}</div>
                    <div className='text-xs text-slate-500'>Focus: {p.focus||'—'}</div>
                    <div className='text-xs text-slate-500'>Format: {p.format||'—'} · Default: {p.defaultLocation||'—'} {p.defaultTime? '· '+p.defaultTime: ''}</div>
                    <div className='text-sm text-slate-600'>{p.description}</div>
                    <div className='text-xs text-slate-500'>Topics: {p.topics||'—'}</div>
                  </div>
                  <div className='flex items-center'>
                    <Btn onClick={()=>usePlanToSchedule(p.id)}>Schedule this plan</Btn>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {!selectedPlayerId && tab==='sessions' && (
        <div className='grid md:grid-cols-2 gap-6'>
          <Section title='Schedule session (pick a plan)'>
            <form onSubmit={addSession} className='grid gap-3'>
              <div className='grid grid-cols-2 gap-3'>
                <div><label className='text-sm'>Date</label><input type='date' className='border rounded p-2 w-full' value={sessForm.date} onChange={e=>setSessForm({...sessForm,date:e.target.value})}/></div>
                <div><label className='text-sm'>Type</label><select className='border rounded p-2 w-full' value={sessForm.type} onChange={e=>setSessForm({...sessForm,type:e.target.value})}>{['Training','Match','Grading'].map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div>
                <label className='text-sm'>Select plan</label>
                <select className='border rounded p-2 w-full' value={sessForm.planId} onChange={e=>{
                  const id=e.target.value; const pl=plans.find(x=>x.id===id);
                  setSessForm({...sessForm, planId:id, group: pl?.format||'', location: pl?.defaultLocation||'', time: pl?.defaultTime||''})
                }}>
                  <option value=''>— choose a plan —</option>
                  {plans.map(p=> <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className='grid grid-cols-3 gap-3'>
                <div><label className='text-sm'>Format (from plan)</label><input className='border rounded p-2 w-full bg-slate-50' value={sessForm.group} readOnly/></div>
                <div><label className='text-sm'>Location</label><input className='border rounded p-2 w-full' value={sessForm.location} onChange={e=>setSessForm({...sessForm,location:e.target.value})}/></div>
                <div><label className='text-sm'>Time</label><input type='time' className='border rounded p-2 w-full' value={sessForm.time} onChange={e=>setSessForm({...sessForm,time:e.target.value})}/></div>
              </div>

              <div className='border rounded p-3'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='text-sm font-medium'>Auto-select attendees</div>
                  <label className='text-xs flex items-center gap-2'>
                    <input type='checkbox' checked={sessForm.respectDays} onChange={e=>setSessForm({...sessForm,respectDays:e.target.checked})}/>
                    match player "Regular days" for {dayShort(sessForm.date)}
                  </label>
                </div>
                <Btn variant='outline' onClick={(e)=>{e.preventDefault(); autoSelectAttendees()}}>Add players from {sessForm.group||'—'}</Btn>
              </div>

              <div>
                <div className='text-sm font-medium mb-1'>Select attendees {sessForm.group? `(showing ${sessForm.group})` : '(all players)'} </div>
                <div className='grid grid-cols-2 gap-2 max-h-40 overflow-auto'>
                  {players.filter(pl=> !sessForm.group || pl.classGroup===sessForm.group).map(pl=> (
                    <label key={pl.id} className='border rounded p-2 flex items-center gap-2'>
                      <input type='checkbox' checked={sessForm.attendees.includes(pl.id)} onChange={()=>setSessForm(v=>({...v,attendees: v.attendees.includes(pl.id)?v.attendees.filter(x=>x!==pl.id):[...v.attendees, pl.id]}))}/>
                      <span className='text-sm'>{pl.name} <span className='text-xs text-slate-500'>({pl.classGroup})</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <Btn>Create session</Btn>
            </form>
          </Section>

          <Section title='Sessions & notes'>
            <div className='space-y-3'>
              {sessions.map(s=> {
                const plan = plans.find(p=>p.id===s.planId)
                return (
                  <details key={s.id} className='border rounded-xl p-3 bg-white' open>
                    <summary className='cursor-pointer select-none font-semibold'>{fmt(s.date)} · {s.type} — {plan? plan.title : '—'} {s.group? `· ${s.group}`:''} {s.location? `· ${s.location}`:''} {s.time? `· ${s.time}`:''}</summary>
                    {plan && (
                      <div className='flex gap-3 mt-1'>
                        {plan.image && <img src={plan.image} className='h-24 w-24 object-cover rounded'/>}
                        <div className='text-sm text-slate-600'>
                          <div className='font-medium'>{plan.title}</div>
                          <div>Focus: {plan.focus||'—'}</div>
                          <div className='text-xs text-slate-500'>Format: {plan.format||'—'} · Default: {plan.defaultLocation||'—'} {plan.defaultTime? '· '+plan.defaultTime:''}</div>
                          <div className='text-xs text-slate-500'>Topics: {plan.topics||'—'}</div>
                          <div className='mt-1'>{plan.description}</div>
                        </div>
                      </div>
                    )}
                  </details>
                )})}
            </div>
          </Section>
        </div>
      )}

      {!selectedPlayerId && tab==='players' && (
        <div className='grid md:grid-cols-2 gap-6'>
          <Section title='Create player'>
            <form onSubmit={addPlayer} className='grid gap-3'>
              <input className='border rounded p-2' placeholder='Full name' value={playerForm.name} onChange={e=>setPlayerForm({...playerForm,name:e.target.value})}/>
              <label className='text-sm'>Group</label>
              <select className='border rounded p-2' value={playerForm.classGroup} onChange={e=>setPlayerForm({...playerForm,classGroup:e.target.value})}>
                {GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <input className='border rounded p-2' placeholder='Primary position' value={playerForm.position} onChange={e=>setPlayerForm({...playerForm,position:e.target.value})}/>
              <input className='border rounded p-2' placeholder='Parent email' type='email' value={playerForm.parentEmail} onChange={e=>setPlayerForm({...playerForm,parentEmail:e.target.value})}/>
              <label className='text-sm'>Join date</label>
              <input className='border rounded p-2' type='date' value={playerForm.joinDate} onChange={e=>setPlayerForm({...playerForm,joinDate:e.target.value})}/>
              <Btn>Save player</Btn>
            </form>
          </Section>

          <Section title='Players list'>
            <Table>
              <thead><tr><Th>Name</Th><Th>Group</Th><Th>Position</Th><Th>Actions</Th></tr></thead>
              <tbody className='divide-y'>
                {players.map(p=>(
                  <tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td>{p.classGroup}</Td>
                    <Td>{p.position||'—'}</Td>
                    <Td className='flex gap-2'>
                      <button className='text-xs px-2 py-1 border rounded' onClick={()=>{setSelectedPlayerId(p.id)}}>Dashboard</button>
                      <button className='text-xs px-2 py-1 border rounded' onClick={()=>markGraded(p.id)}>Mark graded today</button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>
        </div>
      )}
      {!selectedPlayerId && tab==='attendance' && (
        <Section title='Attendance overview'>
          <div className='mb-3'>
            <label className='text-sm mr-2'>Filter by group</label>
            <select className='border rounded p-2' value={reportGroup} onChange={e=>setReportGroup(e.target.value)}>
              <option value=''>All groups</option>
              {GROUPS.map(g=> <option key={g}>{g}</option>)}
            </select>
          </div>
          <Table>
            <thead><tr><Th>Player</Th><Th>Group</Th><Th>Sessions attended</Th><Th>Total sessions</Th><Th>%</Th></tr></thead>
            <tbody className='divide-y'>
              {players.filter(p=>!reportGroup || p.classGroup===reportGroup).map(p=>{
                const att=playerSessions(p.id).length; const tot=sessions.length; const pct=tot?Math.round(att/tot*100):0
                return (<tr key={p.id}><Td>{p.name}</Td><Td>{p.classGroup}</Td><Td>{att}</Td><Td>{tot}</Td><Td>{pct}%</Td></tr>)
              })}
            </tbody>
          </Table>
        </Section>
      )}

      {!selectedPlayerId && tab==='results' && (
        <Section title='Belts & player skill editing'>
          <div className='space-y-4'>
            {players.map(p=>(
              <div key={p.id} className='border rounded-xl p-3'>
                <div className='font-semibold mb-2'>{p.name} <span className='text-xs text-slate-500'>({p.classGroup})</span></div>
                <div className='grid md:grid-cols-3 gap-2'>
                  {AREAS.map(a=>(
                    <div key={a} className='flex items-center justify-between border rounded p-2'>
                      <span className='text-sm'>{a}</span>
                      <select className='border rounded p-1 text-sm' value={p.belts?.[a]||'White'} onChange={e=>updateBelt(p.id,a,e.target.value)}>
                        {BELT_LEVELS.map(b=><option key={b}>{b}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!selectedPlayerId && tab==='grading' && (
        <div className='grid md:grid-cols-2 gap-6'>
          <Section title='Create / update grading rule'>
            <form onSubmit={upsertGradingRule} className='grid gap-3'>
              <div className='grid grid-cols-2 gap-2'>
                <div><label className='text-xs'>Area</label><select className='border rounded p-2 w-full' value={gradingForm.area} onChange={e=>setGradingForm({...gradingForm,area:e.target.value})}>{AREAS.map(a=><option key={a}>{a}</option>)}</select></div>
                <div><label className='text-xs'>Target belt</label><select className='border rounded p-2 w-full' value={gradingForm.belt} onChange={e=>setGradingForm({...gradingForm,belt:e.target.value})}>{BELT_LEVELS.slice(1).map(b=><option key={b}>{b}</option>)}</select></div>
              </div>
              <div><label className='text-xs'>Skills / topics required (comma separated)</label><input className='border rounded p-2 w-full' placeholder='ex: drag-back, cruyff turn, outside cut' value={gradingForm.skills} onChange={e=>setGradingForm({...gradingForm,skills:e.target.value})}/></div>
              <div className='grid grid-cols-4 gap-2'>
                <div><label className='text-xs'>Pass skills %</label><input type='number' min='0' max='100' className='border rounded p-2 w-full' value={gradingForm.passSkillPct} onChange={e=>setGradingForm({...gradingForm,passSkillPct:e.target.value})}/></div>
                <div><label className='text-xs'>Min Avg Score</label><input type='number' className='border rounded p-2 w-full' value={gradingForm.minAvgScore} onChange={e=>setGradingForm({...gradingForm,minAvgScore:e.target.value})}/></div>
                <div><label className='text-xs'>Min Attendance %</label><input type='number' className='border rounded p-2 w-full' value={gradingForm.minAttendancePct} onChange={e=>setGradingForm({...gradingForm,minAttendancePct:e.target.value})}/></div>
                <div><label className='text-xs'>Min Sessions</label><input type='number' className='border rounded p-2 w-full' value={gradingForm.minSessions} onChange={e=>setGradingForm({...gradingForm,minSessions:e.target.value})}/></div>
              </div>
              <Btn>Save rule</Btn>
            </form>
          </Section>

          <Section title='Rules list'>
            <Table>
              <thead><tr><Th>Area</Th><Th>Belt</Th><Th>Skills</Th><Th>Pass %</Th><Th>Thresholds</Th><Th>Actions</Th></tr></thead>
              <tbody className='divide-y'>
                {gradings.length === 0 ? (
                  <tr><Td colSpan='6'>No rules yet. Create one on the left.</Td></tr>
                ) : (
                  gradings.map(g=> (
                    <tr key={g.id}>
                      <Td>{g.area}</Td>
                      <Td>{g.belt}</Td>
                      <Td>{(g.skills||[]).join(', ')||'—'}</Td>
                      <Td>{g.passSkillPct||100}%</Td>
                      <Td className='text-xs'>score ≥ {g.minAvgScore||0} · att ≥ {g.minAttendancePct||0}% · sess ≥ {g.minSessions||0}</Td>
                      <Td><button className='text-xs px-2 py-1 border rounded' onClick={()=>removeGradingRule(g.id)}>Delete</button></Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Section>
        </div>
      )}

      {!selectedPlayerId && tab==='reports' && (
        <Section title='Per-player reports'>
          <div className='flex flex-wrap gap-2 mb-4 items-end'>
            <div><label className='text-sm block'>Filter by group</label>
              <select className='border rounded p-2' value={reportGroup} onChange={e=>setReportGroup(e.target.value)}>
                <option value=''>All groups</option>
                {GROUPS.map(g=> <option key={g}>{g}</option>)}
              </select>
            </div>
            <Btn variant='outline'>Print ALL (filtered)</Btn>
            <Btn variant='outline'>Download ALL (HTML)</Btn>
          </div>
          {players.filter(p=>!reportGroup || p.classGroup===reportGroup).map(p=>(
            <details key={p.id} className='border rounded-xl p-3 mb-3'>
              <summary className='cursor-pointer select-none font-semibold flex items-center justify-between'>
                <span>{p.name} — {p.classGroup} — Attendance {attendancePct(p.id)}% — Avg score {avgScore(p.id)??'—'}</span>
                <span className='flex gap-2'>
                  <Btn variant='outline'>Print</Btn>
                  <Btn variant='outline'>Download</Btn>
                  <Btn variant='outline' onClick={(e)=>{e.preventDefault(); setSelectedPlayerId(p.id)}}>Open dashboard</Btn>
                </span>
              </summary>
            </details>
          ))}
        </Section>
      )}

      {!selectedPlayerId && tab==='branding' && (
        <Section title='Branding'>
          <div className='grid md:grid-cols-2 gap-6'>
            <div>
              <div className='text-sm mb-1'>Current logo</div>
              <img src={logoDataUrl || '/logo.png'} alt='logo' className='h-24 w-24 rounded-full border'/>
            </div>
            <div>
              <div className='text-sm mb-1'>Upload new logo</div>
              <input type='file' accept='image/*' onChange={e=>onLogoChange(e.target.files?.[0])}/>
              <div className='text-xs text-slate-500 mt-2'>The logo is embedded in printed reports so it always shows.</div>
            </div>
          </div>
        </Section>
      )}
    </div>
  )
}

