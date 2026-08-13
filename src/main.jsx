import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, supabaseConfigured } from './lib/supabase'
import './styles.css'

const STATUS = ['Nog niet ontvangen', 'Ontvangen']
const PAYMENT = ['Nog niet betaald', 'Clubfactuur', 'Tikkie', 'Contant/anders']
const TEAM_PLAYERS = ['Romeo', 'Bo', 'Kasper', 'Tobias', 'Marius', 'Sebas', 'Maurits', 'Brackel', 'Koch', 'Benning', 'Jordy', 'Mark', 'Gijs', 'Max', 'Wout'].sort((a, b) => a.localeCompare(b, 'nl'))
const emptySettings = { team: 'Houten Heren 1', goal: 10000, total: 0 }
const emptySponsor = { name: '', amount: '', sourced_by: '', logo_status: STATUS[0], payment_status: PAYMENT[0], description: '' }
const euro = (value) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value) || 0)

function App() {
  const [progress, setProgress] = useState(emptySettings)
  const [sponsors, setSponsors] = useState([])
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('Alle betalingen')
  const [editing, setEditing] = useState(null)
  const [celebration, setCelebration] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    loadPublicProgress()
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (session) loadPrivateData() }, [session])
  useEffect(() => {
    if (!celebration) return
    const timer = window.setTimeout(() => setCelebration(null), 4200)
    return () => window.clearTimeout(timer)
  }, [celebration])

  async function loadPublicProgress() {
    if (!supabase) return
    const { data, error } = await supabase.from('public_progress').select('*').single()
    if (!error && data) setProgress(data)
  }
  async function loadPrivateData() {
    const [{ data: rows, error: sponsorsError }, { data: profile, error: profileError }] = await Promise.all([
      supabase.from('sponsors').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('role').eq('id', session.user.id).single(),
    ])
    if (sponsorsError) setMessage(`Sponsors laden mislukt: ${sponsorsError.message}`)
    if (profileError || !profile) {
      setRole(null); setMessage('Dit account heeft nog geen rol. Vraag een beheerder om toegang.'); await supabase.auth.signOut(); return
    }
    setSponsors(rows || []); setRole(profile.role)
  }
  async function login(event) {
    event.preventDefault()
    if (!password) return setMessage('Vul je wachtwoord in.')
    setBusy(true); setMessage('')
    const emails = [import.meta.env.VITE_MEMBER_EMAIL || 'hockeylid@houtenheren1.local', import.meta.env.VITE_ADMIN_EMAIL || 'admin@houtenheren1.local']
    let lastError
    for (const email of emails) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) { setPassword(''); setBusy(false); return }
      lastError = error
    }
    setBusy(false); setPassword(''); setMessage(`Inloggen mislukt: ${lastError?.message || 'probeer het opnieuw.'}`)
  }
  async function logout() { await supabase.auth.signOut(); setSession(null); setRole(null); setSponsors([]); setEditing(null) }
  async function saveSponsor(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const payload = Object.fromEntries(new FormData(formElement).entries())
    payload.amount = Number(payload.amount || 0)
    setBusy(true); setMessage('')
    const isEditing = Boolean(editing?.id)
    const query = isEditing ? supabase.from('sponsors').update(payload).eq('id', editing.id) : supabase.from('sponsors').insert(payload).select().single()
    const { data, error } = await query
    setBusy(false)
    if (error) return setMessage(`Opslaan mislukt: ${error.message}`)
    formElement.reset()
    setEditing(null)
    if (!isEditing && data) {
      setSponsors((current) => [data, ...current])
      setProgress((current) => ({ ...current, total: Number(current.total || 0) + payload.amount }))
      setCelebration({ name: payload.name, amount: payload.amount })
    }
    setMessage(isEditing ? 'Sponsor bijgewerkt.' : 'Sponsor toegevoegd.')
    await Promise.all([loadPrivateData(), loadPublicProgress()])
  }
  async function removeSponsor(id) {
    if (!window.confirm('Sponsor verwijderen? Dit kan niet ongedaan worden gemaakt.')) return
    const { error } = await supabase.from('sponsors').delete().eq('id', id)
    if (error) setMessage(`Verwijderen mislukt: ${error.message}`)
    else { setMessage('Sponsor verwijderd.'); await Promise.all([loadPrivateData(), loadPublicProgress()]) }
  }
  async function updateGoal() {
    const value = window.prompt('Nieuw doelbedrag', progress.goal)
    if (!value || role !== 'admin') return
    const { error } = await supabase.from('settings').update({ goal: Number(value), updated_at: new Date().toISOString() }).eq('id', true)
    if (error) setMessage(`Doel aanpassen mislukt: ${error.message}`)
    else { setMessage('Doelbedrag aangepast.'); await loadPublicProgress() }
  }

  const total = Number(progress.total || 0); const goal = Number(progress.goal || 0)
  const percentage = Math.min(100, goal ? Math.round(total / goal * 100) : 0)
  const nextMilestone = Math.min(goal, Math.ceil(Math.max(total + 1, goal * 0.1) / (goal * 0.1)) * (goal * 0.1))
  const amountToNext = Math.max(nextMilestone - total, 0)
  const filtered = sponsors.filter((item) => `${item.name} ${item.sourced_by} ${item.description}`.toLowerCase().includes(search.toLowerCase()) && (paymentFilter === 'Alle betalingen' || item.payment_status === paymentFilter))
  const people = useMemo(() => Object.values(sponsors.reduce((map, item) => { const key = item.sourced_by || 'Onbekend'; map[key] ||= { name: key, count: 0, amount: 0 }; map[key].count += 1; map[key].amount += Number(item.amount || 0); return map }, {})).sort((a, b) => b.amount - a.amount), [sponsors])
  const formValue = editing || emptySponsor
  if (!supabaseConfigured) return <div className="setup-error"><h1>Configuratie ontbreekt</h1><p>Controleer de Supabase-configuratie in de lokale ontwikkelomgeving.</p></div>

  return <div className="app-shell">
    <a className="skip-link" href="#content">Ga naar inhoud</a>
    <header className="topbar"><div className="identity" translate="no"><span className="brand-mark">H1</span><span>Houten Heren 1</span></div>{session ? <div className="account"><span>{role === 'admin' ? 'Beheerder' : 'Teamlid'}</span><button className="text-button" onClick={logout}>Uitloggen</button></div> : <form className="topbar-login" onSubmit={login}><label className="sr-only" htmlFor="password">Wachtwoord</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Wachtwoord…" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="button primary" disabled={busy}>{busy ? 'Controleren…' : 'Inloggen'}</button></form>}</header>
    <main id="content">
      {session ? <>
        <section className="workbench" aria-labelledby="add-sponsor-title"><div className="workbench-intro"><p className="kicker">Sponsoractie</p><h1 id="add-sponsor-title">Sponsor toevoegen</h1><p>Leg een nieuwe toezegging direct vast.</p></div>
          <form key={editing?.id || 'new'} className="sponsor-form" onSubmit={saveSponsor}>
            <div className="field wide"><label htmlFor="sponsor-name">Sponsornaam</label><input id="sponsor-name" name="name" required autoComplete="organization" defaultValue={formValue.name} placeholder="Bedrijfsnaam…" /></div>
            <div className="field"><label htmlFor="amount">Bedrag</label><div className="money-input"><span aria-hidden="true">€</span><input id="amount" name="amount" required type="number" min="0" step="1" inputMode="numeric" defaultValue={formValue.amount} placeholder="0" /></div></div>
            <div className="field"><label htmlFor="sourced-by">Binnengehaald door</label><select id="sourced-by" name="sourced_by" required defaultValue={formValue.sourced_by}><option value="" disabled>Kies speler</option>{TEAM_PLAYERS.map((person) => <option key={person} value={person}>{person}</option>)}</select></div>
            <div className="field"><label htmlFor="payment">Betaling</label><select id="payment" name="payment_status" defaultValue={formValue.payment_status}>{PAYMENT.map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="field"><label htmlFor="logo">Logo</label><select id="logo" name="logo_status" defaultValue={formValue.logo_status}>{STATUS.map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="field wide"><label htmlFor="description">Notitie <span>(optioneel)</span></label><input id="description" name="description" autoComplete="off" defaultValue={formValue.description} placeholder="Bijvoorbeeld: factuur volgt" /></div>
            <div className="form-actions wide"><button className="button primary" disabled={busy}>{busy ? 'Opslaan…' : editing?.id ? 'Wijziging opslaan' : 'Sponsor opslaan'}</button>{editing?.id && <button className="button secondary" type="button" onClick={() => setEditing(null)}>Annuleren</button>}</div>
          </form>
          <aside className="impact-card" aria-label="Stand van de sponsoractie"><p className="kicker">Volgende mijlpaal</p><strong>{amountToNext ? euro(amountToNext) : 'Doel behaald'}</strong><p>{amountToNext ? `nodig voor ${euro(nextMilestone)}` : `${euro(total)} opgehaald`}</p><div className="progress-track" aria-label={`${percentage}% van het doel bereikt`}><span style={{ transform: `scaleX(${percentage / 100})` }} /></div><div className="impact-numbers"><span><b>{percentage}%</b> van doel</span><span><b>{euro(total)}</b> totaal</span></div></aside>
        </section>
        {message && <p className="notice" aria-live="polite">{message}</p>}
        <section className="overview" aria-labelledby="overview-title"><div className="section-heading"><div><p className="kicker">Overzicht</p><h2 id="overview-title">Sponsors</h2></div>{role === 'admin' && <button className="text-button settings" onClick={updateGoal}>Doel aanpassen</button>}</div><div className="toolbar"><label className="search-field"><span className="sr-only">Zoek sponsors</span><input name="search" autoComplete="off" placeholder="Zoek sponsor of speler…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-field"><span className="sr-only">Filter op betaling</span><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option>Alle betalingen</option>{PAYMENT.map((option) => <option key={option}>{option}</option>)}</select></label></div><div className="table-wrap"><table><thead><tr><th>Sponsor</th><th>Bedrag</th><th>Speler</th><th>Betaling</th><th>Logo</th><th><span className="sr-only">Acties</span></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</td><td className="amount">{euro(item.amount)}</td><td>{item.sourced_by}</td><td><span className={`status ${item.payment_status === 'Nog niet betaald' ? 'pending' : 'received'}`}>{item.payment_status}</span></td><td><span className={`status ${item.logo_status === 'Ontvangen' ? 'received' : 'pending'}`}>{item.logo_status}</span></td><td className="row-actions"><button onClick={() => setEditing(item)}>Bewerken</button>{role === 'admin' && <button className="danger" onClick={() => removeSponsor(item.id)}>Verwijderen</button>}</td></tr>)}</tbody></table>{!filtered.length && <p className="empty">Geen sponsors gevonden.</p>}</div></section>
        {people.length > 0 && <section className="team-score" aria-labelledby="team-score-title"><div className="section-heading"><div><p className="kicker">Teaminzet</p><h2 id="team-score-title">Opbrengst per speler</h2></div></div><ol>{people.map((person) => <li key={person.name}><span>{person.name}</span><div><i style={{ transform: `scaleX(${total ? person.amount / total : 0})` }} /></div><strong>{euro(person.amount)}</strong></li>)}</ol></section>}
      </> : <>
        <section className="public-hero" aria-labelledby="page-title"><div><p className="kicker">Sponsoractie 2025/26</p><h1 id="page-title">Houten Heren 1<br /><em>speelt voor meer.</em></h1><p className="public-intro">Samen bouwen we aan een sterk seizoen.</p></div><div className="public-progress"><p className="kicker">Opgehaald</p><strong>{euro(total)}</strong><div className="progress-track" aria-label={`${percentage}% van het doel bereikt`}><span style={{ transform: `scaleX(${percentage / 100})` }} /></div><div><span>{percentage}% van {euro(goal)}</span><span>{amountToNext ? `${euro(amountToNext)} tot ${euro(nextMilestone)}` : 'Doel behaald'}</span></div></div></section>
        {message && <p className="notice" aria-live="polite">{message}</p>}
      </>}
    </main>
    {celebration && <aside className="success-splash" aria-live="polite"><div className="confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><p className="kicker">Sponsor toegevoegd</p><strong>{euro(celebration.amount)}</strong><p>{celebration.name}</p><button type="button" onClick={() => setCelebration(null)}>Sluiten</button></aside>}
    <footer><span translate="no">Houten Heren 1</span><span>Interne sponsoradministratie</span></footer>
  </div>
}
createRoot(document.getElementById('root')).render(<App />)
