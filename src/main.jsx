import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, supabaseConfigured } from './lib/supabase'
import './styles.css'
import './action.css'

const STATUS = ['Nog niet ontvangen', 'Ontvangen', 'Aangeleverd bij Ties']
const PAYMENT_TYPES = ['Tikkie', 'Clubfactuur', 'Anders']
const SPONSOR_PACKAGES = ['Logo klein', 'Logo groot', 'Platinum', 'Sponsorzin', 'Overig']
const TEAM_PLAYERS = ['Staf - Algemeen', 'Benning', 'Bo', 'Brackel', 'Gijs', 'Jordy', 'Kasper', 'Koch', 'Marius', 'Mark', 'Maurits', 'Max', 'Romeo', 'Sebas', 'Tobias', 'Wout']
const FRIENDS_GOAL = 70
const emptySettings = { team: 'Houten Heren 1', goal: 10000, total: 0 }
const emptySponsor = { name: '', amount: '', sourced_by: '', logo_status: STATUS[0], payment_status: '', sponsor_keuze: '', is_betaald: false, description: '' }
const euro = (value) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value) || 0)

function AdminActions({ sponsors, onUpdate, onEdit, busy }) {
  const items = sponsors.flatMap((sponsor) => [
    !sponsor.is_betaald && { id: `${sponsor.id}-payment`, sponsor, type: 'payment', label: 'Betaling ontbreekt', action: 'Markeer als betaald' },
    sponsor.logo_status !== 'Aangeleverd bij Ties' && { id: `${sponsor.id}-logo`, sponsor, type: 'logo', label: 'Logo naar Ties', action: 'Markeer als aangeleverd' },
  ].filter(Boolean))
  return <section className="actions-screen"><div className="actions-hero"><div><p className="kicker">Admin · actielijst</p><h1>Open eindjes<br /><em>wegwerken.</em></h1><p>Alles wat nog nodig is om sponsors af te ronden.</p></div><div className="action-counter"><strong>{items.length}</strong><span>openstaande acties</span></div></div><div className="action-summary"><span><i className="dot orange-dot" />{items.filter((item) => item.type === 'payment').length} betalingen</span><span><i className="dot blue-dot" />{items.filter((item) => item.type === 'logo').length} logo's naar Ties</span><span className="action-tip">Klik op een actie om hem direct af te ronden</span></div><div className="action-list">{items.map((item) => <article className="action-row" key={item.id}><div className={`action-icon ${item.type}`}>{item.type === 'payment' ? '€' : '◈'}</div><div className="action-main"><div className="action-title"><strong>{item.sponsor.name}</strong><span className={`action-tag ${item.type}`}>{item.label}</span></div><p>{item.type === 'payment' ? `${euro(item.sponsor.amount)} · betaling nog niet geregistreerd` : 'Logo nog niet aangeleverd bij Ties'}</p></div><div className="action-owner"><span>Verantwoordelijk</span><strong>{item.sponsor.sourced_by || 'Nog niet toegewezen'}</strong></div><button className="action-complete" disabled={busy} onClick={() => onUpdate(item.sponsor, item.type)}>{item.action}<span>→</span></button><button className="action-edit" onClick={() => onEdit(item.sponsor)} aria-label={`Bewerk ${item.sponsor.name}`}>•••</button></article>)}{!items.length && <div className="all-done"><span>✓</span><strong>Alles bijgewerkt</strong><p>Er staan geen openstaande sponsoracties meer.</p></div>}</div></section>
}

function FriendsOverview({ friends, onChange, onSave, savingId }) {
  const rows = useMemo(() => friends.map((friend) => {
    const regular = Math.max(0, Number(friend.aantal_vriendjes) || 0)
    const youth = Math.max(0, Number(friend.aantal_jeugdvriendjes) || 0)
    const total = regular + youth
    const revenue = regular * 10 + youth * 5
    return { ...friend, regular, youth, total, revenue, percentage: Math.min(100, Math.round(revenue / FRIENDS_GOAL * 100)) }
  }), [friends])
  const totalFriends = rows.reduce((sum, row) => sum + row.total, 0)
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0)
  const goalReached = rows.filter((row) => row.revenue >= FRIENDS_GOAL).length
  const maxFriends = Math.max(...rows.map((row) => row.total), 1)

  return <section className="friends-screen" aria-labelledby="friends-title">
    <header className="friends-hero">
      <div><p className="kicker">Admin · vriendenactie</p><h1 id="friends-title">Vriendjes<br /><em>H1.</em></h1><p>Houd per speler bij hoeveel vriendjes er zijn binnengehaald.</p></div>
      <div className="friends-goal"><span>Persoonlijk doel</span><strong>{euro(FRIENDS_GOAL)}</strong><small>ongeacht de mix</small></div>
    </header>

    <div className="friends-summary" aria-label="Samenvatting VriendjesH1">
      <article><span>Totaal vriendjes</span><strong>{totalFriends}</strong></article>
      <article><span>Opbrengst</span><strong>{euro(totalRevenue)}</strong></article>
      <article><span>Doel behaald</span><strong>{goalReached}<small> / {rows.length} spelers</small></strong></article>
    </div>

    <section className="friends-chart-section" aria-labelledby="friends-chart-title">
      <div className="section-heading"><div><p className="kicker">Grafiek</p><h2 id="friends-chart-title">Vriendjes per speler</h2></div><div className="friends-legend"><span><i className="regular" />Vriendjes · €10</span><span><i className="youth" />Jeugd · €5</span></div></div>
      <ol className="friends-chart">
        {rows.map((row) => <li key={row.id}>
          <div className="friend-chart-name"><strong>{row.spelersnaam}</strong><span>{row.total} vriendjes</span></div>
          <div className="friend-chart-bar" aria-label={`${row.spelersnaam}: ${row.total} vriendjes, ${euro(row.revenue)} van ${euro(FRIENDS_GOAL)}`}>
            <span className="regular" style={{ width: `${row.regular / maxFriends * 100}%` }} />
            <span className="youth" style={{ width: `${row.youth / maxFriends * 100}%` }} />
          </div>
          <div className="friend-chart-score"><strong>{euro(row.revenue)}</strong><span>{row.revenue >= FRIENDS_GOAL ? 'Doel behaald' : `${euro(FRIENDS_GOAL - row.revenue)} te gaan`}</span></div>
        </li>)}
      </ol>
    </section>

    <section className="friends-table-section" aria-labelledby="friends-table-title">
      <div className="section-heading"><div><p className="kicker">Registratie</p><h2 id="friends-table-title">Aantallen bijwerken</h2></div><p className="friends-help">Sla elke speler apart op.</p></div>
      <div className="friends-table-wrap"><table className="friends-table"><thead><tr><th>Speler</th><th>Vriendjes</th><th>Jeugdvriendjes</th><th>Totaal</th><th>Opbrengst</th><th>Doel</th><th><span className="sr-only">Opslaan</span></th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.id}>
          <td data-label="Speler"><strong>{row.spelersnaam}</strong></td>
          <td data-label="Vriendjes"><label className="sr-only" htmlFor={`regular-${row.id}`}>Aantal vriendjes voor {row.spelersnaam}</label><input id={`regular-${row.id}`} type="number" min="0" step="1" inputMode="numeric" value={row.aantal_vriendjes} disabled={savingId === row.id} onChange={(event) => onChange(row.id, 'aantal_vriendjes', event.target.value)} /></td>
          <td data-label="Jeugdvriendjes"><label className="sr-only" htmlFor={`youth-${row.id}`}>Aantal jeugdvriendjes voor {row.spelersnaam}</label><input id={`youth-${row.id}`} type="number" min="0" step="1" inputMode="numeric" value={row.aantal_jeugdvriendjes} disabled={savingId === row.id} onChange={(event) => onChange(row.id, 'aantal_jeugdvriendjes', event.target.value)} /></td>
          <td data-label="Totaal"><strong>{row.total}</strong></td>
          <td className="amount" data-label="Opbrengst">{euro(row.revenue)}</td>
          <td data-label="Doel"><span className={`friend-goal-status ${row.revenue >= FRIENDS_GOAL ? 'reached' : ''}`}>{row.percentage}%</span></td>
          <td className="friend-save"><button type="button" className="button secondary" disabled={savingId === row.id} onClick={() => onSave(row)}>{savingId === row.id ? 'Opslaan…' : 'Opslaan'}</button></td>
        </tr>)}
      </tbody></table></div>
    </section>
  </section>
}

function App() {
  const [progress, setProgress] = useState(emptySettings)
  const [sponsors, setSponsors] = useState([])
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('Alle betaaltypes')
  const [editing, setEditing] = useState(null)
  const [celebration, setCelebration] = useState(null)
  const [adminScreen, setAdminScreen] = useState('dashboard')
  const [friends, setFriends] = useState([])
  const [friendSavingId, setFriendSavingId] = useState(null)

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
    if (profile.role === 'admin') await loadFriends()
    else setFriends([])
  }
  async function loadFriends() {
    const { data, error } = await supabase.from('vriendjes_h1').select('*')
    if (error) return setMessage(`VriendjesH1 laden mislukt: ${error.message}`)
    const playerOrder = new Map(TEAM_PLAYERS.map((player, index) => [player, index]))
    setFriends((data || []).sort((a, b) => (playerOrder.get(a.spelersnaam) ?? 999) - (playerOrder.get(b.spelersnaam) ?? 999)))
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
  async function logout() { await supabase.auth.signOut(); setSession(null); setRole(null); setSponsors([]); setFriends([]); setEditing(null); setAdminScreen('dashboard') }
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
  async function quickUpdate(sponsor, type) {
    const data = type === 'payment' ? { is_betaald: true, updated_at: new Date().toISOString() } : { logo_status: 'Aangeleverd bij Ties', updated_at: new Date().toISOString() }
    setBusy(true)
    const { error } = await supabase.from('sponsors').update(data).eq('id', sponsor.id)
    setBusy(false)
    if (error) setMessage(`Actie kon niet worden opgeslagen: ${error.message}`)
    else { setMessage(`${type === 'payment' ? 'Betaling' : 'Logo aangeleverd bij Ties'} bijgewerkt voor ${sponsor.name}.`); await loadPrivateData(); await loadPublicProgress() }
  }
  async function updatePaid(sponsor, isBetaald) {
    setBusy(true); setMessage('')
    const { error } = await supabase.from('sponsors').update({ is_betaald: isBetaald, updated_at: new Date().toISOString() }).eq('id', sponsor.id)
    setBusy(false)
    if (error) return setMessage(`Betaalstatus kon niet worden opgeslagen: ${error.message}`)
    setMessage(`${sponsor.name} is gemarkeerd als ${isBetaald ? 'betaald' : 'niet betaald'}.`)
    await loadPrivateData()
  }
  function updateFriendCount(id, field, value) {
    setFriends((current) => current.map((friend) => friend.id === id ? { ...friend, [field]: value } : friend))
  }
  async function saveFriend(row) {
    const aantalVriendjes = Number(row.aantal_vriendjes)
    const aantalJeugdvriendjes = Number(row.aantal_jeugdvriendjes)
    if (!Number.isInteger(aantalVriendjes) || aantalVriendjes < 0 || !Number.isInteger(aantalJeugdvriendjes) || aantalJeugdvriendjes < 0) {
      setMessage('Vul voor beide soorten vriendjes een heel getal van 0 of hoger in.')
      return
    }
    setFriendSavingId(row.id); setMessage('')
    const { data, error } = await supabase.from('vriendjes_h1').update({ aantal_vriendjes: aantalVriendjes, aantal_jeugdvriendjes: aantalJeugdvriendjes }).eq('id', row.id).select().single()
    setFriendSavingId(null)
    if (error) return setMessage(`VriendjesH1 opslaan mislukt: ${error.message}`)
    setFriends((current) => current.map((friend) => friend.id === row.id ? data : friend))
    setMessage(`${row.spelersnaam} is bijgewerkt.`)
  }

  const total = Number(progress.total || 0); const goal = Number(progress.goal || 0)
  const percentage = Math.min(100, goal ? Math.round(total / goal * 100) : 0)
  const nextMilestone = Math.min(goal, Math.ceil(Math.max(total + 1, goal * 0.1) / (goal * 0.1)) * (goal * 0.1))
  const amountToNext = Math.max(nextMilestone - total, 0)
  const filtered = sponsors.filter((item) => `${item.name} ${item.sourced_by} ${item.sponsor_keuze} ${item.description}`.toLowerCase().includes(search.toLowerCase()) && (paymentFilter === 'Alle betaaltypes' || item.payment_status === paymentFilter))
  const people = useMemo(() => Object.values(sponsors.reduce((map, item) => { const key = item.sourced_by || 'Onbekend'; map[key] ||= { name: key, count: 0, amount: 0 }; map[key].count += 1; map[key].amount += Number(item.amount || 0); return map }, {})).sort((a, b) => b.amount - a.amount), [sponsors])
  const formValue = editing || emptySponsor
  if (!supabaseConfigured) return <div className="setup-error"><h1>Configuratie ontbreekt</h1><p>Controleer de Supabase-configuratie in de lokale ontwikkelomgeving.</p></div>

  return <div className="app-shell">
    <a className="skip-link" href="#content">Ga naar inhoud</a>
    <header className="topbar"><div className="identity" translate="no"><span className="brand-mark">H1</span><span>Houten Heren 1</span></div>{session ? <div className="account"><span>{role === 'admin' ? 'Beheerder' : 'Teamlid'}</span><button className="text-button" onClick={logout}>Uitloggen</button></div> : <form className="topbar-login" onSubmit={login}><label className="sr-only" htmlFor="password">Wachtwoord</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Wachtwoord…" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="button primary" disabled={busy}>{busy ? 'Controleren…' : 'Inloggen'}</button></form>}</header>
    <main id="content">
      {session && role === 'admin' && <nav className="admin-menu" aria-label="Beheermenu"><button className={adminScreen === 'dashboard' ? 'active' : ''} onClick={() => setAdminScreen('dashboard')}>Dashboard</button><button className={adminScreen === 'actions' ? 'active' : ''} onClick={() => setAdminScreen('actions')}>Actielijst <b className="nav-badge">{sponsors.reduce((count, sponsor) => count + Number(!sponsor.is_betaald) + Number(sponsor.logo_status !== 'Aangeleverd bij Ties'), 0)}</b></button><button className={adminScreen === 'friends' ? 'active' : ''} onClick={() => setAdminScreen('friends')}>VriendjesH1</button><button onClick={updateGoal}>Doel aanpassen</button></nav>}
      {message && <p className="notice" aria-live="polite">{message}</p>}
      {session ? (role === 'admin' && adminScreen === 'actions' ? <AdminActions sponsors={sponsors} onUpdate={quickUpdate} onEdit={setEditing} busy={busy} /> : role === 'admin' && adminScreen === 'friends' ? <FriendsOverview friends={friends} onChange={updateFriendCount} onSave={saveFriend} savingId={friendSavingId} /> : <>
        <section className="workbench" aria-labelledby="add-sponsor-title"><div className="workbench-intro"><p className="kicker">Sponsoractie</p><h1 id="add-sponsor-title">Sponsor toevoegen</h1><p>Leg een nieuwe toezegging direct vast.</p></div>
          <form key={editing?.id || 'new'} className="sponsor-form" onSubmit={saveSponsor}>
            <div className="field wide"><label htmlFor="sponsor-name">Sponsornaam</label><input id="sponsor-name" name="name" required autoComplete="organization" defaultValue={formValue.name} placeholder="Bedrijfsnaam…" /></div>
            <div className="field"><label htmlFor="amount">Bedrag</label><div className="money-input"><span aria-hidden="true">€</span><input id="amount" name="amount" required type="number" min="0" step="1" inputMode="numeric" defaultValue={formValue.amount} placeholder="0" /></div></div>
            <div className="field"><label htmlFor="sourced-by">Binnengehaald door</label><select id="sourced-by" name="sourced_by" required defaultValue={formValue.sourced_by}><option value="" disabled>Kies speler</option>{TEAM_PLAYERS.map((person) => <option key={person} value={person}>{person}</option>)}</select></div>
            <div className="field"><label htmlFor="payment">Betalingstype <span>(verplicht)</span></label><select id="payment" name="payment_status" required defaultValue={formValue.payment_status}><option value="" disabled>Kies betalingstype</option>{PAYMENT_TYPES.map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="field"><label htmlFor="sponsor-keuze">Sponsorpakket <span>(verplicht)</span></label><select id="sponsor-keuze" name="sponsor_keuze" required defaultValue={formValue.sponsor_keuze}><option value="" disabled>Kies sponsorpakket</option>{SPONSOR_PACKAGES.map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="field"><label htmlFor="logo">Logo</label><select id="logo" name="logo_status" defaultValue={formValue.logo_status}>{STATUS.map((option) => <option key={option}>{option}</option>)}</select></div>
            <div className="field wide"><label htmlFor="description">Notitie <span>(optioneel)</span></label><input id="description" name="description" autoComplete="off" defaultValue={formValue.description} placeholder="Extra informatie..." /></div>
            <div className="form-actions wide"><button className="button primary" disabled={busy}>{busy ? 'Opslaan…' : editing?.id ? 'Wijziging opslaan' : 'Sponsor opslaan'}</button>{editing?.id && <button className="button secondary" type="button" onClick={() => setEditing(null)}>Annuleren</button>}</div>
          </form>
          <aside className="public-progress dashboard-goal" aria-label={`Hoofddoel: ${euro(total)} van ${euro(goal)} opgehaald`}><p className="kicker">Opgehaald</p><strong>{euro(total)}</strong><div className="progress-track" aria-label={`${percentage}% van het doel bereikt`}><span style={{ transform: `scaleX(${percentage / 100})` }} /></div><div><span>{percentage}% van {euro(goal)}</span><span>{amountToNext ? `${euro(amountToNext)} tot ${euro(nextMilestone)}` : 'Doel behaald'}</span></div></aside>
        </section>
        <section className="overview" aria-labelledby="overview-title">
          <div className="section-heading"><div><p className="kicker">Overzicht</p><h2 id="overview-title">Sponsors</h2></div></div>
          <div className="toolbar">
            <label className="search-field"><span className="sr-only">Zoek sponsors</span><input name="search" autoComplete="off" placeholder="Zoek sponsor, pakket of speler…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <label className="filter-field"><span className="sr-only">Filter op betalingstype</span><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option>Alle betaaltypes</option>{PAYMENT_TYPES.map((option) => <option key={option}>{option}</option>)}</select></label>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Sponsor</th><th>Bedrag</th><th>Speler</th><th>Betalingstype</th><th>Sponsorpakket</th>{role === 'admin' && <th>Betaald</th>}<th>Logo</th><th><span className="sr-only">Acties</span></th></tr></thead><tbody>
            {filtered.map((item) => <tr key={item.id}>
              <td><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</td>
              <td className="amount" data-label="Bedrag">{euro(item.amount)}</td>
              <td data-label="Speler">{item.sourced_by}</td>
              <td data-label="Betaling"><span className="status">{item.payment_status}</span></td>
              <td data-label="Sponsorpakket"><span className="status">{item.sponsor_keuze || 'Overig'}</span></td>
              {role === 'admin' && <td className="paid-cell" data-label="Betaald"><input type="checkbox" checked={Boolean(item.is_betaald)} disabled={busy} onChange={(event) => updatePaid(item, event.target.checked)} aria-label={`${item.name}: betaald`} /></td>}
              <td data-label="Logo"><span className={`status ${item.logo_status === 'Ontvangen' ? 'received' : 'pending'}`}>{item.logo_status}</span></td>
              <td className="row-actions"><button onClick={() => setEditing(item)}>Bewerken</button>{role === 'admin' && <button className="danger" onClick={() => removeSponsor(item.id)}>Verwijderen</button>}</td>
            </tr>)}
          </tbody></table>{!filtered.length && <p className="empty">Geen sponsors gevonden.</p>}</div>
        </section>
        {people.length > 0 && <section className="team-score" aria-labelledby="team-score-title"><div className="section-heading"><div><p className="kicker">Teaminzet</p><h2 id="team-score-title">Opbrengst per speler</h2></div></div><ol>{people.map((person) => <li key={person.name}><span>{person.name}</span><div><i style={{ transform: `scaleX(${total ? person.amount / total : 0})` }} /></div><strong>{euro(person.amount)}</strong></li>)}</ol></section>}
       </>) : <>
        <section className="public-hero" aria-labelledby="page-title"><div><p className="kicker">Sponsoractie 2025/26</p><h1 id="page-title">Houten Heren 1<br /><em>speelt voor meer.</em></h1><p className="public-intro">Samen bouwen we aan een sterk seizoen.</p></div><div className="public-progress"><p className="kicker">Opgehaald</p><strong>{euro(total)}</strong><div className="progress-track" aria-label={`${percentage}% van het doel bereikt`}><span style={{ transform: `scaleX(${percentage / 100})` }} /></div><div><span>{percentage}% van {euro(goal)}</span><span>{amountToNext ? `${euro(amountToNext)} tot ${euro(nextMilestone)}` : 'Doel behaald'}</span></div></div></section>
      </>}
    </main>
    {celebration && <aside className="success-splash" aria-live="polite"><div className="confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div><p className="kicker">Sponsor toegevoegd</p><strong>{euro(celebration.amount)}</strong><p>{celebration.name}</p><button type="button" onClick={() => setCelebration(null)}>Sluiten</button></aside>}
    <footer><span translate="no">Houten Heren 1</span><span>Interne sponsoradministratie</span></footer>
  </div>
}
createRoot(document.getElementById('root')).render(<App />)
