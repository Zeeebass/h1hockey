import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, supabaseConfigured } from './lib/supabase'
import './styles.css'

const STATUS = ['Nog niet ontvangen', 'Ontvangen']
const PAYMENT = ['Nog niet betaald', 'Clubfactuur', 'Tikkie', 'Contant/anders']
const TEAM_PLAYERS = ["Romeo", 'Bo', 'Kasper', 'Tobias', 'Marius', 'Sebas', 'Maurits', 'Brackel', 'Koch', 'Benning', 'Jordy', 'Mark', 'Gijs', 'Max', 'Wout'].sort((a, b) => a.localeCompare(b, 'nl'))
const emptySettings = { team: 'Houten Heren 1', goal: 10000, total: 0 }
const SUBGOAL_PERCENTAGES = [10, 20, 30, 40, 50, 60, 75, 100]
const euro = (value) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value) || 0)

function App() {
  const [progress, setProgress] = useState(emptySettings)
  const [displayTotal, setDisplayTotal] = useState(0)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [sponsors, setSponsors] = useState([])
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Alle statussen')
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    loadPublicProgress()
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) loadPrivateData() }, [session])

  async function loadPublicProgress() {
    if (!supabase) return
    const { data, error } = await supabase.from('public_progress').select('*').single()
    if (!error && data) { setProgress(data); setProgressLoaded(true) }
  }
  useEffect(() => {
    if (!progressLoaded) return
    const target = Number(progress.total || 0)
    let frame
    const startedAt = performance.now()
    const duration = 1500
    setCelebrating(target > 0)
    const tick = (now) => {
      const eased = 1 - Math.pow(1 - Math.min((now - startedAt) / duration, 1), 3)
      setDisplayTotal(Math.round(target * eased))
      if (eased < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const celebrationTimer = window.setTimeout(() => setCelebrating(false), 2400)
    return () => { cancelAnimationFrame(frame); window.clearTimeout(celebrationTimer) }
  }, [progress.total, progressLoaded])
  async function loadPrivateData() {
    const [{ data: rows, error: sponsorsError }, { data: profile, error: profileError }] = await Promise.all([supabase.from('sponsors').select('*').order('created_at', { ascending: false }), supabase.from('profiles').select('role').eq('id', session.user.id).single()])
    if (sponsorsError) setMessage(`Sponsorregels konden niet worden geladen: ${sponsorsError.message}`)
    if (profileError || !profile) {
      setRole(null)
      setMessage(`Login gelukt, maar deze gebruiker heeft nog geen rol in profiles. User ID: ${session.user.id}`)
      await supabase.auth.signOut()
      return
    }
    setSponsors(rows || []); setRole(profile.role)
  }
  async function login() {
    if (!password) return setMessage('Vul een wachtwoord in.')
    setBusy(true); setMessage('Toegang controleren…')
    const emails = [
      import.meta.env.VITE_MEMBER_EMAIL || 'hockeylid@houtenheren1.local',
      import.meta.env.VITE_ADMIN_EMAIL || 'admin@houtenheren1.local',
    ]
    let lastError
    for (const email of emails) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) {
        setBusy(false); setPassword(''); setMessage('')
        return
      }
      lastError = error
    }
    setBusy(false); setPassword('')
    setMessage(`Supabase login mislukt: ${lastError?.message || 'onbekende fout'}`)
  }
  async function logout() { await supabase.auth.signOut(); setSession(null); setRole(null); setSponsors([]) }
  async function saveSponsor(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries()); payload.amount = Number(payload.amount || 0)
    setBusy(true); const query = editing.id ? supabase.from('sponsors').update(payload).eq('id', editing.id) : supabase.from('sponsors').insert(payload)
    const { error } = await query; setBusy(false)
    if (error) setMessage(error.message); else { setEditing(null); setMessage('Sponsor opgeslagen.'); await loadPrivateData(); await loadPublicProgress() }
  }
  async function removeSponsor(id) { if (!window.confirm('Sponsor echt verwijderen?')) return; const { error } = await supabase.from('sponsors').delete().eq('id', id); if (error) setMessage(error.message); else { await loadPrivateData(); await loadPublicProgress() } }
  async function updateGoal() { const value = window.prompt('Nieuw doelbedrag', progress.goal); if (!value || role !== 'admin') return; const { error } = await supabase.from('settings').update({ goal: Number(value), updated_at: new Date().toISOString() }).eq('id', true); if (error) setMessage(error.message); else { setMessage('Doelbedrag aangepast.'); await loadPublicProgress() } }

  const total = Number(progress.total || 0); const goal = Number(progress.goal || 0); const percentage = Math.min(100, goal ? Math.round(total / goal * 100) : 0)
  const animatedPercentage = Math.min(100, goal ? displayTotal / goal * 100 : 0)
  const subgoals = SUBGOAL_PERCENTAGES.map((percent) => ({ percent, amount: goal * percent / 100, reached: total >= goal * percent / 100 }))
  const nextSubgoal = subgoals.find((item) => !item.reached) || subgoals[subgoals.length - 1]
  const previousSubgoal = [...subgoals].reverse().find((item) => item.reached && item.amount < nextSubgoal.amount) || { amount: 0 }
  const amountToNext = Math.max(nextSubgoal.amount - total, 0)
  const subgoalRange = Math.max(nextSubgoal.amount - previousSubgoal.amount, 1)
  const subgoalPercentage = nextSubgoal.reached ? 100 : Math.min(100, Math.max(0, (total - previousSubgoal.amount) / subgoalRange * 100))
  const animatedSubgoalPercentage = nextSubgoal.reached ? 100 : Math.min(100, Math.max(0, (displayTotal - previousSubgoal.amount) / subgoalRange * 100))
  const filtered = sponsors.filter((item) => `${item.name} ${item.sourced_by} ${item.description}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'Alle statussen' || item.payment_status === filter || item.logo_status === filter))
  const people = useMemo(() => Object.values(sponsors.reduce((map, item) => { const key = item.sourced_by || 'Onbekend'; map[key] ||= { name: key, count: 0, amount: 0 }; map[key].count++; map[key].amount += Number(item.amount || 0); return map }, {})).sort((a, b) => b.amount - a.amount), [sponsors])

  if (!supabaseConfigured) return <div className="setup-error"><h1>Supabase configuratie ontbreekt</h1><p>Controleer de Supabase-configuratie in de lokale ontwikkelomgeving.</p></div>
  return <div className="app-shell"><header className="topbar"><div className="brand-mark">H1</div><div><p className="eyebrow">Sponsoractie · seizoen 2025/26</p><h1>Houten Heren 1</h1></div><div className="topbar-actions">{session ? <button className="button ghost" onClick={logout}>Uitloggen</button> : <form className="topbar-login" onSubmit={(event) => { event.preventDefault(); login() }}><label className="sr-only" htmlFor="topbar-password">Wachtwoord</label><input id="topbar-password" type="password" placeholder="Wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="button orange" disabled={busy}>{busy ? 'Controleren…' : 'Inloggen'}</button></form>}</div></header><main>
    <section className="hero"><div className="hero-copy"><p className="eyebrow accent">Samen naar de stip</p><h2>Elke sponsor telt.<br /><em>Elke meter ook.</em></h2><p className="hero-text">Volg de gezamenlijke sponsorvoortgang van Houten Heren 1.</p></div><div className={`goal-card ${celebrating ? 'is-celebrating' : ''}`}><div className="goal-card-top"><span>Tot nu toe</span><span>{percentage}%</span></div><strong className="animated-total" aria-live="polite">{euro(displayTotal)}</strong><div className="progress-track" aria-label={`${percentage}% van het doel bereikt`}><div className="progress-fill" style={{ transform: `scaleX(${animatedPercentage / 100})` }} /></div><div className="goal-card-bottom"><span>Doel {euro(goal)}</span><span>{euro(Math.max(goal - total, 0))} te gaan</span></div><div className="milestone-strip" aria-label="Subdoelen"><div className="milestone-subgoal-label"><span>Volgende mijlpaal</span><span>{Math.round(subgoalPercentage)}%</span></div><div className="milestone-line" aria-label={`${Math.round(subgoalPercentage)}% naar de volgende mijlpaal`}><span className="milestone-line-fill" style={{ transform: `scaleX(${animatedSubgoalPercentage / 100})` }} /></div><div className="milestone-points">{subgoals.map((item) => <span key={item.percent} className={`milestone-point ${item.reached ? 'reached' : ''}`} style={{ left: `${item.percent}%` }} title={`${euro(item.amount)} subdoel`}><i /></span>)}</div><p className="milestone-message">{amountToNext > 0 ? <><b>{euro(amountToNext)}</b> tot {euro(nextSubgoal.amount)}</> : <><b>Hoofddoel behaald!</b> Wat een team.</>}</p></div></div></section>
    <section className="stat-grid"><div className="stat-card"><span className="stat-label">Totaal opgehaald</span><strong>{euro(total)}</strong><span className="stat-note">publiek zichtbaar</span></div><div className="stat-card"><span className="stat-label">Sponsor doel</span><strong>{euro(goal)}</strong><span className="stat-note">{percentage}% behaald</span></div><div className="stat-card dark"><span className="stat-label">Nog nodig</span><strong>{euro(Math.max(goal - total, 0))}</strong><span className="stat-note">Op naar de volgende mijlpaal</span></div></section>
    <section className="access-panel"><div><p className="eyebrow">Afgeschermd teamoverzicht</p><h3>{session ? `Ingelogd als ${role === 'admin' ? 'admin' : 'hockeylid'}` : 'Sponsorinformatie openen'}</h3><p>{session ? 'Wijzigingen worden direct veilig opgeslagen.' : 'De publieke pagina toont geen namen of individuele bedragen.'}</p></div>{!session && <span className="access-hint">Log in via de balk hierboven</span>}</section>
    {message && <div className="notice">{message}</div>}
    {session && <><section className="private-area"><div className="section-heading"><div><p className="eyebrow accent">{role === 'admin' ? 'Adminruimte' : 'Teamruimte'}</p><h2>Sponsorbacklog</h2></div><div className="heading-actions">{role === 'admin' && <button className="button outline" onClick={updateGoal}>Doel aanpassen</button>}<button className="button orange" onClick={() => setEditing({ name: '', amount: '', sourced_by: '', logo_status: STATUS[0], payment_status: PAYMENT[0], description: '' })}>+ Sponsor toevoegen</button></div></div><div className="toolbar"><input placeholder="Zoek sponsor of binnenhaler…" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>Alle statussen</option>{PAYMENT.map((item) => <option key={item}>{item}</option>)}{STATUS.map((item) => <option key={item}>{item}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>Sponsor</th><th>Bedrag</th><th>Binnengehaald door</th><th>Logo</th><th>Betaling</th><th /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.description}</small></td><td className="amount">{euro(item.amount)}</td><td>{item.sourced_by || '—'}</td><td><span className="pill">{item.logo_status}</span></td><td><span className={`pill ${item.payment_status === 'Nog niet betaald' ? 'warning' : 'success'}`}>{item.payment_status}</span></td><td className="row-actions"><button onClick={() => setEditing(item)}>Bewerk</button>{role === 'admin' && <button className="danger" onClick={() => removeSponsor(item.id)}>Verwijder</button>}</td></tr>)}</tbody></table>{!filtered.length && <div className="empty">Nog geen sponsorregels gevonden.</div>}</div></section><section className="ranking"><div className="section-heading"><div><p className="eyebrow accent">Teamprestatie</p><h2>Opbrengst per persoon</h2></div></div><div className="ranking-list">{people.map((person, index) => <div className="rank-row" key={person.name}><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><div className="rank-person"><strong>{person.name}</strong><small>{person.count} sponsor{person.count === 1 ? '' : 's'}</small></div><div className="rank-bar"><i style={{ width: `${total ? person.amount / total * 100 : 0}%` }} /></div><strong className="rank-amount">{euro(person.amount)}</strong></div>)}</div></section></>}
  </main><footer><span>Houten Heren 1</span><span>Interne sponsoradministratie</span></footer>{editing && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditing(null)}><form className="modal" onSubmit={saveSponsor}><div className="modal-heading"><div><p className="eyebrow accent">Sponsorregel</p><h2>{editing.id ? 'Sponsor bewerken' : 'Nieuwe sponsor'}</h2></div><button type="button" className="close" onClick={() => setEditing(null)}>×</button></div><label>Sponsornaam<input required name="name" defaultValue={editing.name} /></label><label>Bedrag (€)<input required type="number" min="0" step="1" name="amount" defaultValue={editing.amount} /></label><label>Binnengehaald door<select required name="sourced_by" defaultValue={editing.sourced_by}>{editing.sourced_by && !TEAM_PLAYERS.includes(editing.sourced_by) && <option value={editing.sourced_by}>{editing.sourced_by}</option>}<option value="" disabled>Kies een speler</option>{TEAM_PLAYERS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="form-grid"><label>Logo<select name="logo_status" defaultValue={editing.logo_status}>{STATUS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Betaling<select name="payment_status" defaultValue={editing.payment_status}>{PAYMENT.map((item) => <option key={item}>{item}</option>)}</select></label></div><label>Omschrijving<textarea name="description" rows="3" defaultValue={editing.description} /></label><button className="button orange full" disabled={busy}>Opslaan</button></form></div>}</div>
}
createRoot(document.getElementById('root')).render(<App />)
