import { useEffect, useState } from 'react'
import {
  ArrowDownLeft, ArrowRight, BarChart3, Boxes, BriefcaseBusiness, Check, ChevronDown, CircleHelp,
  Clock3, CreditCard, LayoutDashboard, LogOut, Menu, MoreHorizontal, Package,
  Plus, Ruler, Search, Settings2, ShieldCheck, ShoppingBag, ShoppingCart, TrendingUp,
  UserPlus, Users, X,
} from 'lucide-react'
import UnitConversionEditor from './UnitConversionEditor.jsx'
import { buildUnitProfile, fieldsFromProfile } from './unitConversionForms.js'
import { convertQuantity, validateUnitEdges } from './unitConversions.js'
import './App.css'

async function apiRequest(token, path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (response.status === 204) return null
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

const formatMoney = (amount, currency = '₦') => `${currency}${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatDate = (value) => new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const initials = (email = '') => email.split('@')[0].slice(0, 2).toUpperCase()
const isValidUnitProfile = (profile) => {
  if (!profile) return false
  try {
    const edges = validateUnitEdges(profile.edges, profile.base_unit)
    convertQuantity(1, profile.base_unit, profile.primary_unit, edges)
    return true
  } catch {
    return false
  }
}

const navGroups = [
  { label: 'Workspace', links: [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, owner: true },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'sales', label: 'Sales', icon: ShoppingCart },
  ] },
  { label: 'Insights', links: [
    { id: 'expenses', label: 'Expenses', icon: CreditCard, owner: true },
    { id: 'reports', label: 'Reports', icon: BarChart3, owner: true },
  ] },
  { label: 'Preferences', links: [
    { id: 'settings', label: 'Settings', icon: Ruler },
    { id: 'account', label: 'Account', icon: BriefcaseBusiness },
  ] },
  { label: 'Platform', links: [
    { id: 'platform-admin', label: 'Platform admin', icon: ShieldCheck, platformAdmin: true },
  ] },
]

function Field({ label, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} /></label>
}

function AuthScreen({ onAuth, busy, error, setError }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (mode === 'signup' && password !== passwordConfirmation) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const credentials = { email, password }
      if (mode === 'signup') credentials.password_confirmation = passwordConfirmation
      const result = await apiRequest(null, `/auth/${mode === 'login' ? 'login' : 'signup'}`, {
        method: 'POST', body: JSON.stringify(credentials),
      })
      onAuth(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (busy) return <div className="auth-loading"><span className="brand-mark"><ShoppingBag size={21} /></span></div>

  return <main className="auth-layout">
    <section className="auth-side">
      <div className="brand-lockup"><span className="brand-mark"><ShoppingBag size={20} /></span><span>Stock <span className="brand-dot">Ledger.</span></span></div>
      <div className="auth-editorial">
        <div className="eyebrow"><span className="eyebrow-line" /> THE BUSINESS, IN BALANCE</div>
        <h1>Make room<br />for <em>what's next.</em></h1>
        <p>One calm place to keep stock, sales and your shop's numbers in order.</p>
        <div className="auth-note"><span className="note-icon"><TrendingUp size={18} /></span><div><strong>A clearer view, every day.</strong><span>Built for the people behind the counter.</span></div></div>
      </div>
      <div className="auth-footer"><span>© 2026 Stock Ledger</span><span>Made for independent business</span></div>
    </section>
    <section className="auth-main">
      <div className="auth-form-wrap">
        <div className="mobile-brand brand-lockup"><span className="brand-mark"><ShoppingBag size={20} /></span><span>Stock <span className="brand-dot">Ledger.</span></span></div>
        <div className="form-heading"><div className="eyebrow">YOUR WORKSPACE</div><h2>{mode === 'login' ? 'Welcome back' : 'Start your account'}</h2><p>{mode === 'login' ? 'Sign in to pick up where you left off.' : 'Create an account for your shop.'}</p></div>
        <form className="stack-form" onSubmit={submit}>
          <Field label="Email address" type="email" autoComplete="email" placeholder="you@yourshop.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Field label="Password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          {mode === 'signup' && <Field label="Confirm password" type="password" autoComplete="new-password" placeholder="Enter your password again" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} minLength={8} required />}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary button-wide" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">{mode === 'login' ? 'New to Stock Ledger?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setPasswordConfirmation(''); setError('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        <div className="secure-note"><ShieldCheck size={15} /> Your shop data stays private to your team.</div>
      </div>
    </section>
  </main>
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ledger_token'))
  const [user, setUser] = useState(null)
  const [shop, setShop] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [salesVersion, setSalesVersion] = useState(0)
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('ledger_token')))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [data, setData] = useState({ items: [], sales: [], expenses: [], employees: [], unitItems: [], accountShops: [] })
  const [dialog, setDialog] = useState(null)
  const [query, setQuery] = useState('')
  const [mobileNav, setMobileNav] = useState(false)

  const isOwner = user?.role === 'owner'
  const isPlatformAdmin = Boolean(user?.is_platform_admin)

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentDate(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!token) return
    apiRequest(token, '/auth/me').then(({ user: currentUser, shop: currentShop }) => {
      setUser(currentUser)
      setShop(currentShop)
      setPage(currentUser.is_platform_admin ? 'platform-admin' : currentUser.role === 'employee' ? 'inventory' : 'dashboard')
      setLoading(false)
    }).catch(() => {
      localStorage.removeItem('ledger_token')
      setToken(null)
      setUser(null)
      setShop(null)
      setLoading(false)
    })
  }, [token])

  useEffect(() => {
    if (!token || !user || user.must_change_password) return
    if (page === 'platform-admin') {
      if (!isPlatformAdmin) return
      apiRequest(token, '/platform/admin/overview').then((overview) => {
        setData((current) => ({ ...current, platformAdminOverview: overview }))
        setError('')
      }).catch((requestError) => setError(requestError.message))
      return
    }
    if (!user.shop_id) return
    if (page === 'sales' && !isOwner) return
    if (page === 'settings') {
      const requests = [apiRequest(token, '/unit-conversions')]
      if (isOwner) requests.push(apiRequest(token, '/team'))
      Promise.all(requests).then(([units, team]) => {
        setData((current) => ({
          ...current,
          unitItems: units.items,
          ...(team ? { employees: team.employees } : {}),
        }))
        setError('')
      }).catch((requestError) => setError(requestError.message))
      return
    }
    if (page === 'account') {
      const requests = [apiRequest(token, '/account/shops')]
      if (isOwner) requests.push(apiRequest(token, '/team'))
      Promise.all(requests).then(([account, team]) => {
        setData((current) => ({
          ...current,
          accountShops: account.shops,
          ...(team ? { employees: team.employees } : {}),
        }))
        setError('')
      }).catch((requestError) => setError(requestError.message))
      return
    }
    const endpoints = {
      dashboard: ['/dashboard', 'dashboard'],
      inventory: ['/items', 'items'],
      sales: ['/sales', 'sales'],
      expenses: ['/expenses', 'expenses'],
      reports: ['/reports', 'reports'],
    }
    const [endpoint, key] = endpoints[page] || endpoints.inventory
    apiRequest(token, endpoint).then((result) => {
      setData((current) => ({ ...current, [key]: result[key] ?? result }))
      setError('')
    }).catch((requestError) => setError(requestError.message))
  }, [token, user, page, isOwner, isPlatformAdmin])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function perform(path, options = {}) {
    setError('')
    setBusy(true)
    try {
      return await apiRequest(token, path, options)
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    } finally {
      setBusy(false)
    }
  }

  async function acceptAuth(result) {
    localStorage.setItem('ledger_token', result.token)
    setToken(result.token)
    setLoading(true)
    setError('')
    try {
      const current = await apiRequest(result.token, '/auth/me')
      setUser(current.user)
      setShop(current.shop)
      setPage(current.user.is_platform_admin ? 'platform-admin' : current.user.role === 'employee' ? 'inventory' : 'dashboard')
    } catch (requestError) {
      localStorage.removeItem('ledger_token')
      setToken(null)
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  function activateShop(result) {
    localStorage.setItem('ledger_token', result.token)
    setToken(result.token)
    setUser(result.user)
    setShop(result.shop)
    setData({ items: [], sales: [], expenses: [], employees: [], unitItems: [], accountShops: [] })
    setPage(result.user.role === 'owner' ? 'dashboard' : 'inventory')
  }

  async function createShop(name, currency) {
    try {
      const result = await perform('/shops', { method: 'POST', body: JSON.stringify({ name, currency }) })
      activateShop(result)
      setNotice(`Switched to ${result.shop.name}`)
    } catch { /* Error is shown in the shared alert. */ }
  }

  async function selectShop(shopId) {
    try {
      const result = await perform('/account/shops/select', { method: 'POST', body: JSON.stringify({ shop_id: shopId }) })
      activateShop(result)
      setNotice(`Switched to ${result.shop.name}`)
    } catch { /* Error is shown in the shared alert. */ }
  }

  function signOut() {
    localStorage.removeItem('ledger_token')
    setToken(null)
    setUser(null)
    setShop(null)
    setData({ items: [], sales: [], expenses: [], employees: [], unitItems: [], accountShops: [] })
    setPage('dashboard')
    setError('')
  }

  if (!token || !user) return <AuthScreen onAuth={acceptAuth} busy={loading} error={error} setError={setError} />

  if (user.must_change_password) return <PasswordSetup onSubmit={async (password) => {
    try {
      await perform('/auth/change-password', { method: 'POST', body: JSON.stringify({ password }) })
      setUser((current) => ({ ...current, must_change_password: false }))
      setNotice('Password updated')
    } catch { /* The form keeps the API error visible. */ }
  }} error={error} busy={busy} signOut={signOut} />

  if ((!user.shop_id || !shop) && !(isPlatformAdmin && page === 'platform-admin')) return <ShopSetup onCreate={createShop} error={error} busy={busy} signOut={signOut} />

  const pageTitle = {
    dashboard: [currentDate.getHours() < 12 ? 'Good morning' : currentDate.getHours() < 17 ? 'Good afternoon' : 'Good evening', 'A little overview of how things are moving.'],
    inventory: ['Inventory', "Keep track of what's on your shelves."],
    sales: ['Sales', isOwner ? 'A record of everything sold.' : 'Ring up a sale and keep stock in sync.'],
    expenses: ['Expenses', 'Keep the running costs in one place.'],
    reports: ['Reports', 'A closer look at your shop’s performance.'],
    settings: ['Settings', 'Manage the people who can access your shop.'],
    account: ['Account', 'Manage your shops, access, and team.'],
    'platform-admin': ['Platform admin', 'Monitor accounts, shop memberships, and recent activity.'],
  }[page] || ['Inventory', 'Keep track of what’s on your shelves.']

  async function refresh() {
    const routes = isOwner
      ? [['/items', 'items'], ['/dashboard', 'dashboard'], ['/sales', 'sales'], ['/expenses', 'expenses'], ['/reports', 'reports'], ['/team', 'employees'], ['/unit-conversions', 'unitItems', 'items']]
      : [['/items', 'items'], ['/unit-conversions', 'unitItems', 'items']]
    const results = await Promise.all(routes.map(([endpoint]) => apiRequest(token, endpoint)))
    const refreshed = Object.fromEntries(routes.map(([, key, resultKey], index) => [
      key,
      results[index][resultKey || key] ?? results[index],
    ]))
    setData((current) => ({
      ...current,
      ...refreshed,
    }))
  }

  async function saveAndRefresh(path, options, message) {
    try {
      await perform(path, options)
      setDialog(null)
      await refresh()
      setNotice(message)
    } catch { /* Error is rendered in the workspace banner. */ }
  }

  const filteredItems = data.items.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(query.toLowerCase()))

  return <div className="app-shell">
    {mobileNav && <button aria-label="Close navigation" className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><span className="brand-mark"><ShoppingBag size={18} /></span><span>Stock <span className="brand-dot">Ledger.</span></span><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      {shop && <div className="shop-switcher"><span className="shop-avatar">{shop.name.slice(0, 1).toUpperCase()}</span><span className="shop-switch-info"><strong>{shop.name}</strong><small>{isOwner ? 'Owner workspace' : 'Team workspace'}</small></span><ChevronDown size={15} /></div>}
      <nav className="side-nav" aria-label="Main navigation">
        {navGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.links.filter((link) => link.platformAdmin ? isPlatformAdmin : Boolean(user.shop_id) && (isOwner || !link.owner)).map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? 'nav-active' : ''}`} onClick={() => { setPage(id); setMobileNav(false); setQuery('') }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === 'inventory' && data.items.some((item) => item.quantity < 5) && <span className="nav-alert" />}</button>)}</div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><span className="help-icon"><CircleHelp size={16} /></span><div><strong>Need a hand?</strong><small>We’re here to help.</small></div><ArrowRight size={14} /></div>
        <button className="profile-row" onClick={signOut}><span className="profile-avatar">{initials(user.email)}</span><span className="profile-info"><strong>{user.email.split('@')[0]}</strong><small>{isPlatformAdmin && !shop ? 'Platform admin' : isOwner ? 'Owner' : 'Employee'}</small></span><LogOut size={15} className="logout-icon" /><span className="sr-only">Sign out</span></button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={19} /></button><span className="crumb-muted">Workspace</span><span className="crumb-divider">/</span><span className="crumb-current">{pageTitle[0]}</span></div><div className="topbar-right"><span className="today-label"><Clock3 size={14} /> {currentDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="top-avatar">{initials(user.email)}</span></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">{shop?.name.toUpperCase() || 'PLATFORM ADMINISTRATION'}</div><h1>{pageTitle[0]}{page === 'dashboard' && <span className="heading-dot">.</span>}</h1><p>{pageTitle[1]}</p></div>{page === 'inventory' && <button className="button button-primary" onClick={() => setDialog({ type: 'item' })}><Plus size={16} /> Add item</button>}{page === 'expenses' && isOwner && <button className="button button-primary" onClick={() => setDialog({ type: 'expense' })}><Plus size={16} /> Add expense</button>}</div>
        {error && <div className="alert-banner" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss" onClick={() => setError('')}><X size={15} /></button></div>}
        {page === 'dashboard' && isOwner && <Dashboard dashboard={data.dashboard} currency={shop.currency} today={currentDate} onGo={setPage} />}
        {page === 'inventory' && <><Inventory items={filteredItems} currency={shop.currency} isOwner={isOwner} query={query} setQuery={setQuery} onAdd={() => setDialog({ type: 'item' })} onEdit={(item) => setDialog({ type: 'item', item })} onDelete={(item) => setDialog({ type: 'delete-item', item })} /><InventoryUnitTools items={data.items} onAddStock={(item) => setDialog({ type: 'add-stock', item })} onDefineUnits={(item) => setDialog({ type: 'unit-profile', item, firstSetup: true })} onEdit={(item) => setDialog({ type: 'item', item })} isOwner={isOwner} /></>}
        {page === 'sales' && <Sales key={salesVersion} items={data.items} sales={data.sales} currency={shop.currency} isOwner={isOwner} onSell={async (items) => {
          try { await perform('/sales', { method: 'POST', body: JSON.stringify({ items }) }); await refresh(); setSalesVersion((version) => version + 1); setNotice('Sale recorded and stock updated'); return true }
          catch { return false }
        }} busy={busy} />}
        {page === 'expenses' && isOwner && <Expenses expenses={data.expenses} currency={shop.currency} onAdd={() => setDialog({ type: 'expense' })} />}
        {page === 'reports' && isOwner && <Reports report={data.reports} currency={shop.currency} />}
        {page === 'settings' && <SettingsPage items={data.unitItems} onEditUnits={(item) => setDialog({ type: 'unit-profile', item })} onSetupUnits={(item) => setDialog({ type: 'unit-profile', item, firstSetup: true })} />}
        {page === 'account' && <AccountPage user={user} shops={data.accountShops} isOwner={isOwner} employees={data.employees} busy={busy} error={error} onCreateShop={createShop} onSelectShop={selectShop} onAddEmployee={() => setDialog({ type: 'employee' })} onToggleEmployee={(employee) => saveAndRefresh(`/team/${employee.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !employee.active }) }, employee.active ? 'Employee disabled' : 'Employee enabled')} onResetEmployee={(employee) => setDialog({ type: 'reset-password', employee })} onRemoveEmployee={(employee) => setDialog({ type: 'remove-employee', employee })} />}
        {page === 'platform-admin' && isPlatformAdmin && <PlatformAdminPage overview={data.platformAdminOverview} />}
        {page === 'platform-admin' && isPlatformAdmin && <PlatformAdminPage overview={data.platformAdminOverview} />}
      </div>
    </main>

    {dialog?.type === 'item' && <ItemDialog dialog={dialog} currency={shop.currency} isOwner={isOwner} busy={busy} error={error} onClose={() => { setDialog(null); setError('') }} onSubmit={(path, options, message) => saveAndRefresh(path, options, message)} />}
    {dialog?.type === 'unit-profile' && <UnitProfileDialog dialog={dialog} busy={busy} error={error} onClose={() => { setDialog(null); setError('') }} onSubmit={(path, options, message) => saveAndRefresh(path, options, message)} />}
    {dialog?.type === 'add-stock' && <StockEntryDialog item={dialog.item} busy={busy} error={error} onClose={() => { setDialog(null); setError('') }} onSubmit={(path, options, message) => saveAndRefresh(path, options, message)} />}
    {dialog && !['item', 'unit-profile', 'add-stock'].includes(dialog.type) && <ActionDialog dialog={dialog} currency={shop.currency} busy={busy} error={error} onClose={() => { setDialog(null); setError('') }} onSubmit={(path, options, message) => saveAndRefresh(path, options, message)} />}
    {notice && <div className="toast"><span className="toast-check"><Check size={13} /></span>{notice}</div>}
  </div>
}

function ShopSetup({ onCreate, error, busy, signOut }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('₦')
  return <main className="setup-screen"><div className="setup-top"><div className="brand-lockup"><span className="brand-mark"><ShoppingBag size={20} /></span><span>ledger<span className="brand-dot">.</span></span></div><button className="text-button" onClick={signOut}>Sign out <LogOut size={15} /></button></div><div className="setup-card"><span className="setup-illustration"><ShoppingBag size={25} /></span><div className="eyebrow">ONE LAST THING</div><h1>Create your shop</h1><p>Give your workspace a name. You’ll be its owner, and can invite your team later.</p><form className="stack-form" onSubmit={(event) => { event.preventDefault(); onCreate(name, currency) }}><Field label="Shop name" placeholder="e.g. The Corner Store" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /><label className="field"><span>Currency</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="₦">₦ &nbsp; Nigerian naira</option><option value="$">$ &nbsp; US dollar</option><option value="£">£ &nbsp; Pound sterling</option><option value="€">€ &nbsp; Euro</option><option value="GH₵">GH₵ &nbsp; Ghanaian cedi</option><option value="KSh">KSh &nbsp; Kenyan shilling</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-wide" disabled={busy}>{busy ? 'Creating your shop…' : 'Create shop'}<ArrowRight size={16} /></button></form></div><div className="setup-caption"><ShieldCheck size={15} /> Your data belongs to your shop. You control who can see it.</div></main>
}

function PasswordSetup({ onSubmit, error, busy, signOut }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [localError, setLocalError] = useState('')
  return <main className="setup-screen"><div className="setup-top"><div className="brand-lockup"><span className="brand-mark"><ShoppingBag size={20} /></span><span>ledger<span className="brand-dot">.</span></span></div><button className="text-button" onClick={signOut}>Sign out <LogOut size={15} /></button></div><div className="setup-card"><span className="setup-illustration"><ShieldCheck size={25} /></span><div className="eyebrow">ACCOUNT SECURITY</div><h1>Choose a new password</h1><p>Your owner gave you a temporary password. Set a personal password to continue.</p><form className="stack-form" onSubmit={(event) => { event.preventDefault(); if (password !== confirmation) { setLocalError('Passwords do not match'); return } setLocalError(''); onSubmit(password) }}><Field label="New password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /><Field label="Confirm new password" type="password" autoComplete="new-password" placeholder="Enter it again" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required />{(localError || error) && <p className="form-error" role="alert">{localError || error}</p>}<button className="button button-primary button-wide" disabled={busy}>{busy ? 'Updating…' : 'Save new password'}<ArrowRight size={16} /></button></form></div><div className="setup-caption"><ShieldCheck size={15} /> Your password is securely encrypted.</div></main>
}

  function Dashboard({ dashboard, currency, onGo, today }) {
  const stats = dashboard || {}
  return <div className="dashboard-grid">
    <section className="welcome-strip"><div className="welcome-copy"><span className="welcome-kicker">YOUR SHOP, AT A GLANCE</span><h2>Steady progress<br />looks good on you.</h2><p>Here’s what’s happening across your shop.</p></div><div className="welcome-graphic"><span className="graphic-ring ring-one"/><span className="graphic-ring ring-two"/><span className="graphic-stem stem-one"/><span className="graphic-stem stem-two"/><span className="graphic-stem stem-three"/><span className="graphic-stem stem-four"/><span className="graphic-dot"/></div><div className="welcome-date">{today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div></section>
    <section className="metric-grid"><Metric label="Total revenue" value={formatMoney(stats.revenue, currency)} detail={`${stats.sale_count || 0} completed sales`} icon={TrendingUp} tone="green" /><Metric label="Net profit" value={formatMoney(stats.net_profit, currency)} detail={`After ${formatMoney(stats.expenses, currency)} in expenses`} icon={ArrowDownLeft} tone="coral" /><Metric label="Inventory value" value={formatMoney(stats.inventory_value, currency)} detail={`${stats.item_count || 0} active items`} icon={Package} tone="blue" /><Metric label="Gross profit" value={formatMoney(stats.gross_profit, currency)} detail="Before operating expenses" icon={BarChart3} tone="gold" /></section>
    <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">THE LATEST</span><h2>Recent sales</h2></div><button className="text-button" onClick={() => onGo('sales')}>View all <ArrowRight size={14} /></button></div>{stats.recent_sales?.length ? <div className="recent-list">{stats.recent_sales.map((sale) => <div className="recent-row" key={sale.id}><span className="recent-icon"><ShoppingBag size={15} /></span><span className="recent-description"><strong>Sale #{String(sale.id).padStart(4, '0')}</strong><small>{sale.staff_email} · {formatDate(sale.created_at)}</small></span><strong className="recent-amount">{formatMoney(sale.total, currency)}</strong><span className="status-pill status-complete">Complete</span></div>)}</div> : <EmptyState icon={ShoppingBag} title="Your first sale is waiting" text="When something sells, you’ll see it here." action="Open inventory" onAction={() => onGo('inventory')} />}</section>
    <section className="panel quick-panel"><span className="eyebrow">QUICK ACTIONS</span><h2>Keep things moving</h2><button className="quick-link" onClick={() => onGo('inventory')}><span className="quick-icon quick-green"><Boxes size={17} /></span><span><strong>Check your stock</strong><small>See what’s on your shelves</small></span><ArrowRight size={16} /></button><button className="quick-link" onClick={() => onGo('expenses')}><span className="quick-icon quick-coral"><CreditCard size={17} /></span><span><strong>Log an expense</strong><small>Keep your numbers current</small></span><ArrowRight size={16} /></button><button className="quick-link" onClick={() => onGo('settings')}><span className="quick-icon quick-blue"><Users size={17} /></span><span><strong>Manage your team</strong><small>People with shop access</small></span><ArrowRight size={16} /></button></section>
  </div>
}

function Metric({ label, value, detail, icon: Icon, tone }) {
  return <article className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon metric-${tone}`}><Icon size={16} /></span></div><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></article>
}

function InventoryUnitTools({ items, isOwner, onAddStock, onDefineUnits, onEdit }) {
  return <section className="panel inventory-unit-tools"><div className="panel-heading"><div><span className="eyebrow">STOCK ENTRY</span><h2>Add to inventory</h2></div><span className="report-unit">Fractional amounts supported</span></div><div className="stock-entry-list">{items.map((item) => <div className="stock-entry-row" key={item.id}><span className="conversion-product-icon"><Boxes size={16} /></span><span className="conversion-product-info"><strong>{item.name}</strong><small>On hand: {item.quantity} {item.stock_unit}</small></span><button className="button button-quiet" onClick={() => onEdit(item)}>Edit item</button>{item.unit_profile && <button className="button button-quiet" onClick={() => onAddStock(item)}>Add stock <Plus size={14} /></button>}{!item.unit_profile && isOwner && <button className="button button-quiet" onClick={() => onDefineUnits(item)}>Define units</button>}</div>)}</div></section>
}

function ItemDialog({ dialog, currency, isOwner, busy, error, onClose, onSubmit }) {
  const item = dialog.item
  const existingProfile = item?.unit_profile
  const [name, setName] = useState(item?.name || '')
  const [sku, setSku] = useState(item?.sku || '')
  const [price, setPrice] = useState(item?.price ?? '')
  const [cost, setCost] = useState(item?.cost ?? '')
  const [unitFields, setUnitFields] = useState(() => fieldsFromProfile(existingProfile, item?.name || ''))
  const profile = buildUnitProfile(unitFields)
  const selectableUnits = profile ? [...new Set(profile.edges.flatMap((edge) => [edge.from, edge.to]))] : ['unit']
  const initialUnit = existingProfile?.primary_unit || 'unit'
  const [quantityUnit, setQuantityUnit] = useState(initialUnit)
  const initialQuantity = item
    ? existingProfile
      ? convertQuantity(item.quantity, existingProfile.base_unit, initialUnit, existingProfile.edges)
      : item.quantity
    : ''
  const [quantity, setQuantity] = useState(initialQuantity)
  const [localError, setLocalError] = useState('')
  const endpoint = item ? `/items/${item.id}` : '/items'
  const action = item ? 'Save changes' : 'Add item'

  function updateUnitFields(next) {
    if (next.kind !== unitFields.kind) {
      setQuantityUnit(next.kind === 'packaged' ? 'carton' : next.kind === 'bulk' ? 'paint' : 'unit')
      if (next.kind === 'bulk') {
        const defaults = fieldsFromProfile(null, name)
        next = { ...next, kgPerPaint: defaults.kgPerPaint }
      }
    }
    setUnitFields(next)
  }

  function submit(event) {
    event.preventDefault()
    if (isOwner && Number(price) < Number(cost)) setLocalError('Selling price is below the item cost. You can still save if intentional.')
    const payload = { name, sku, quantity: Number(quantity), quantity_unit: quantityUnit, price: Number(price) }
    if (isOwner) payload.cost = Number(cost)
    if (!item && profile) payload.unit_profile = profile
    onSubmit(endpoint, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(payload) }, item ? 'Item updated' : 'Item added to inventory')
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog unit-dialog" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title"><div className="dialog-heading"><div><span className="eyebrow">INVENTORY SETUP</span><h2 id="item-dialog-title">{item ? 'Edit item' : 'Add item'}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div><form className="dialog-form" onSubmit={submit}><Field label="Item name" placeholder="e.g. Rice or Tomato paste" value={name} onChange={(event) => { setName(event.target.value); if (!item && unitFields.kind === 'bulk') setUnitFields(fieldsFromProfile(null, event.target.value)) }} required /><Field label="SKU" placeholder="e.g. RICE-001" value={sku} onChange={(event) => setSku(event.target.value)} required />{item && existingProfile ? <div className="unit-profile-summary"><strong>{existingProfile.kind === 'bulk' ? 'Bulk foodstuff' : 'Packaged product'}</strong><span>{existingProfile.edges.map((edge) => `1 ${edge.from} = ${edge.factor} ${edge.to}`).join(' · ')}</span><small>Manage ratios in Settings → Unit conversions.</small></div> : !item && <UnitConversionEditor fields={unitFields} onChange={updateUnitFields} />}{item && <div className="field-row"><RatioField label="On hand" value={quantity} onChange={setQuantity} placeholder="0" /><label className="field"><span>Unit</span><select value={quantityUnit} onChange={(event) => setQuantityUnit(event.target.value)}>{selectableUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label></div>}{!item && <div className="field-row"><RatioField label={`Opening stock (${quantityUnit})`} value={quantity} onChange={setQuantity} placeholder="e.g. 1.5" />{profile && <label className="field"><span>Stock unit</span><select value={quantityUnit} onChange={(event) => setQuantityUnit(event.target.value)}>{selectableUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>}</div>}<div className="field-row"><Field label={`Price (${currency})`} type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={(event) => setPrice(event.target.value)} required />{isOwner && <Field label={`Unit cost (${currency})`} type="number" min="0" step="0.01" placeholder="0.00" value={cost} onChange={(event) => setCost(event.target.value)} required />}</div>{profile && quantity !== '' && <p className="conversion-preview">{quantity} {quantityUnit} = <strong>{Number(convertQuantity(Number(quantity), quantityUnit, profile.base_unit, profile.edges).toFixed(8))} {profile.base_unit}</strong></p>}{localError && <p className="form-hint">{localError}</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : action}<ArrowRight size={15} /></button></div></form></section></div>
}

function Inventory({ items, currency, isOwner, query, setQuery, onAdd, onEdit, onDelete }) {
  const lowStock = items.filter((item) => item.quantity <= 5).length
  return <section className="panel table-panel"><div className="table-toolbar"><div className="inventory-summary"><span className="summary-number">{items.length}</span><span>items in your shop</span>{lowStock > 0 && <span className="low-stock-tag"><span /> {lowStock} low stock</span>}</div><label className="search-field"><Search size={16} /><input aria-label="Search inventory" placeholder="Search items or SKU" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label></div><div className="table-scroll"><table><thead><tr><th>Item</th><th>SKU</th><th>In stock</th><th>Price</th>{isOwner && <th>Cost</th>}{isOwner && <th aria-label="Actions" />}</tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><span className="item-cell"><span className="item-thumb"><Package size={17} /></span><strong>{item.name}</strong></span></td><td><span className="sku-text">{item.sku}</span></td><td><span className={`stock-count ${item.quantity <= 5 ? 'stock-low' : ''}`}>{item.quantity}<small> units</small></span></td><td className="money-cell">{formatMoney(item.price, currency)}</td>{isOwner && <td className="cost-cell">{formatMoney(item.cost, currency)}</td>}{isOwner && <td><div className="row-actions"><button className="icon-button" aria-label={`Edit ${item.name}`} title="Edit item" onClick={() => onEdit(item)}><Settings2 size={15} /></button><button className="icon-button danger-hover" aria-label={`Delete ${item.name}`} title="Delete item" onClick={() => onDelete(item)}><X size={15} /></button></div></td>}</tr>)}</tbody></table>{items.length === 0 && <EmptyState icon={Boxes} title="Nothing on the shelves yet" text={isOwner ? 'Add your first item to start tracking stock.' : 'Your shop inventory will show up here.'} action={isOwner ? 'Add first item' : undefined} onAction={onAdd} />}</div><div className="table-footer"><span>Showing <strong>{items.length}</strong> {items.length === 1 ? 'item' : 'items'}</span><span>Stock updates automatically when a sale is recorded</span></div></section>
}

function Sales({ items, sales, currency, isOwner, onSell, busy }) {
  const [cart, setCart] = useState({})
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState(isOwner ? 'history' : 'record')
  const available = items.filter((item) => item.quantity > 0 && `${item.name} ${item.sku}`.toLowerCase().includes(search.toLowerCase()))
  const lines = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ item_id: Number(id), quantity }))
  const total = lines.reduce((sum, line) => sum + (items.find((item) => item.id === line.item_id)?.price || 0) * line.quantity, 0)
  function add(id) { setCart((current) => ({ ...current, [id]: Math.min((current[id] || 0) + 1, items.find((item) => item.id === id)?.quantity || 1) })) }
  return <div className="sales-page">{isOwner && <div className="view-tabs"><button className={tab === 'history' ? 'tab-active' : ''} onClick={() => setTab('history')}>Sales history</button><button className={tab === 'record' ? 'tab-active' : ''} onClick={() => setTab('record')}>Record a sale</button></div>}{(tab === 'record' || !isOwner) ? <div className="sale-layout"><section className="panel product-panel"><div className="panel-heading"><div><span className="eyebrow">AVAILABLE STOCK</span><h2>Choose items</h2></div><label className="search-field sale-search"><Search size={15} /><input placeholder="Find a product" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div><div className="product-grid">{available.map((item) => <button className="product-tile" key={item.id} onClick={() => add(item.id)}><span className="product-tile-icon"><Package size={19} /></span><strong>{item.name}</strong><small>{item.quantity} left · {formatMoney(item.price, currency)}</small><span className="product-plus"><Plus size={15} /></span></button>)}{available.length === 0 && <div className="empty-products">No available items found.</div>}</div></section><section className="panel cart-panel"><div className="panel-heading"><div><span className="eyebrow">CURRENT SALE</span><h2>Your basket</h2></div><span className="cart-count">{lines.reduce((sum, line) => sum + line.quantity, 0)} items</span></div><div className="cart-lines">{lines.map((line) => { const item = items.find((entry) => entry.id === line.item_id); return <div className="cart-line" key={line.item_id}><span className="cart-item-icon"><Package size={15} /></span><span className="cart-item-name"><strong>{item?.name}</strong><small>{formatMoney(item?.price, currency)} each</small></span><div className="quantity-control"><button aria-label={`Remove one ${item?.name}`} onClick={() => setCart((current) => ({ ...current, [line.item_id]: current[line.item_id] - 1 }))}>−</button><span>{line.quantity}</span><button aria-label={`Add one ${item?.name}`} onClick={() => add(line.item_id)}>+</button></div></div> })}{lines.length === 0 && <div className="cart-empty"><ShoppingCart size={22} /><span>Your basket is empty</span><small>Choose an item to add it here.</small></div>}</div><div className="cart-bottom"><div className="cart-total"><span>Total</span><strong>{formatMoney(total, currency)}</strong></div><button className="button button-primary button-wide" disabled={!lines.length || busy} onClick={() => onSell(lines)}>{busy ? 'Recording…' : 'Complete sale'}<ArrowRight size={16} /></button></div></section></div> : <SalesHistory sales={sales} currency={currency} />}</div>
}

function SalesHistory({ sales, currency }) {
  return <section className="panel table-panel"><div className="panel-heading padded-heading"><div><span className="eyebrow">ALL TRANSACTIONS</span><h2>Sales history</h2></div><span className="neutral-pill">{sales.length} records</span></div><div className="table-scroll"><table><thead><tr><th>Sale</th><th>Items</th><th>Recorded by</th><th>Date</th><th>Total</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><strong>#{String(sale.id).padStart(4, '0')}</strong></td><td>{sale.summary}</td><td>{sale.staff_email}</td><td>{formatDate(sale.created_at)}</td><td className="money-cell">{formatMoney(sale.total, currency)}</td></tr>)}</tbody></table>{sales.length === 0 && <EmptyState icon={ShoppingBag} title="No sales recorded yet" text="Sales will appear here once your shop gets moving." />}</div><div className="table-footer"><span><strong>{sales.length}</strong> recent transactions</span><span>Sales are retained for your shop records</span></div></section>
}

function Expenses({ expenses, currency, onAdd }) {
  return <section className="panel table-panel"><div className="panel-heading padded-heading"><div><span className="eyebrow">OUTGOINGS</span><h2>Recent expenses</h2></div><span className="neutral-pill">{expenses.length} records</span></div><div className="table-scroll"><table><thead><tr><th>Description</th><th>Recorded by</th><th>Date</th><th>Amount</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td><span className="item-cell"><span className="expense-thumb"><ArrowDownLeft size={16} /></span><strong>{expense.description}</strong></span></td><td>{expense.staff_email}</td><td>{formatDate(expense.created_at)}</td><td className="money-cell">{formatMoney(expense.amount, currency)}</td></tr>)}</tbody></table>{expenses.length === 0 && <EmptyState icon={CreditCard} title="No expenses recorded" text="Add an expense to see how it affects your shop’s bottom line." action="Add expense" onAction={onAdd} />}</div><div className="table-footer"><span><strong>{expenses.length}</strong> recent expenses</span><span>Only owners can view and record expenses</span></div></section>
}

function ReportsLegacy({ report, currency }) {
  const days = report?.sales || []
  const bestsellers = report?.bestsellers || []
  const maxRevenue = Math.max(...days.map((day) => day.revenue), 1)
  return <div className="reports-grid"><section className="panel report-panel"><div className="panel-heading"><div><span className="eyebrow">MOST RECENT 14 DAYS</span><h2>Daily sales</h2></div><span className="report-unit">Revenue</span></div>{days.length ? <div className="sales-chart" role="img" aria-label="Daily revenue bar chart">{days.slice(-14).map((day) => <div className="chart-column" key={day.date} title={`${day.date}: ${formatMoney(day.revenue, currency)}`}><span className="chart-bar" style={{ height: `${Math.max(5, day.revenue / maxRevenue * 100)}%` }} /><small>{new Date(`${day.date}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</small></div>)}</div> : <EmptyState icon={BarChart3} title="Your report is taking shape" text="Daily sales will appear after the first sale." />}</section><section className="panel report-panel"><div className="panel-heading"><div><span className="eyebrow">CUSTOMER FAVOURITES · 30 DAYS</span><h2>Top sellers</h2></div><span className="report-unit">By revenue</span></div>{bestsellers.length ? <div className="bestseller-list">{bestsellers.map((item, index) => <div className="bestseller-row" key={item.name}><span className="rank-number">0{index + 1}</span><span className="bestseller-details"><strong>{item.name}</strong><small>{item.units} units sold · {formatMoney(item.gross_profit, currency)} gross profit</small></span><strong className="bestseller-revenue">{formatMoney(item.revenue, currency)}</strong></div>)}</div> : <EmptyState icon={TrendingUp} title="No bestsellers yet" text="Your top sellers appear after a few sales." />}</section><section className="report-footnote"><ShieldCheck size={15} /><span>Reports are visible to shop owners only.</span></section></div>
}

function Reports({ report, currency }) {
  const summary = report?.summary || {}
  const period = report?.period || {}
  const metrics = [
    { label: 'Revenue', value: summary.revenue },
    { label: 'Cost of goods', value: summary.cost_of_goods },
    { label: 'Gross profit', value: summary.gross_profit },
    { label: 'Operating expenses', value: summary.expenses },
    { label: 'Net profit', value: summary.net_profit },
  ]
  const dates = period.start && period.end ? `${period.start} – ${period.end}` : 'Last 30 days'
  return <div className="business-report-layout"><section className="panel analytics-overview"><div className="panel-heading"><div><span className="eyebrow">BUSINESS PERFORMANCE</span><h2>30-day financial summary</h2></div><span className="neutral-pill">{dates}</span></div><div className="analytics-metrics">{metrics.map((metric) => <article className="analytics-metric" key={metric.label}><span>{metric.label}</span><strong>{formatMoney(metric.value, currency)}</strong></article>)}</div><div className="analytics-footer"><span>{summary.sale_count || 0} completed sales</span><span>Average order value: <strong>{formatMoney(summary.average_order_value, currency)}</strong></span><span>Net margin: <strong>{Number(summary.profit_margin || 0).toFixed(1)}%</strong></span></div></section><ReportsLegacy report={report} currency={currency} /></div>
}

function PlatformAdminPage({ overview }) {
  const [query, setQuery] = useState('')
  const summary = overview?.summary || {}
  const users = (overview?.users || []).filter((account) => account.email.toLowerCase().includes(query.toLowerCase()))
  const shops = overview?.shops || []
  const metrics = [
    ['Accounts', summary.accounts || 0],
    ['Shops', summary.shops || 0],
    ['Active memberships', summary.activeMemberships || 0],
    ['Logged in · 30 days', summary.loginsLast30Days || 0],
  ]
  const formatTimestamp = (value) => value
    ? new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Never'

  return <div className="platform-admin-layout">
    <section className="admin-stat-grid">{metrics.map(([label, value]) => <article className="panel admin-stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="panel table-panel platform-user-panel"><div className="panel-heading padded-heading"><div><span className="eyebrow">PLATFORM ACCOUNTS</span><h2>People</h2></div><span className="neutral-pill">Latest 100</span></div><div className="table-toolbar"><span className="inventory-summary"><span className="summary-number">{users.length}</span> accounts</span><label className="search-field"><Search size={15} /><input aria-label="Search accounts" placeholder="Search email" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="table-scroll"><table><thead><tr><th>Email</th><th>Created</th><th>Last login</th><th>Shops</th><th>Account</th></tr></thead><tbody>{users.map((account) => <tr key={account.id}><td><strong>{account.email}</strong></td><td>{formatTimestamp(account.created_at)}</td><td>{formatTimestamp(account.last_login_at)}</td><td>{account.shop_count}</td><td><span className={`platform-status ${account.active ? 'platform-active' : 'platform-disabled'}`}>{account.active ? 'Active' : 'Disabled'}</span></td></tr>)}</tbody></table>{users.length === 0 && <EmptyState icon={Users} title="No accounts match" text="Try another email search." />}</div><div className="table-footer"><span>Only platform admins can access this directory</span><span>Passwords and sales details are not shown</span></div></section>
    <section className="panel table-panel platform-shop-panel"><div className="panel-heading padded-heading"><div><span className="eyebrow">WORKSPACES</span><h2>Shops</h2></div><span className="neutral-pill">{shops.length} shown</span></div><div className="table-scroll"><table><thead><tr><th>Shop</th><th>Created</th><th>Members</th><th>Items</th></tr></thead><tbody>{shops.map((shop) => <tr key={shop.id}><td><strong>{shop.name}</strong></td><td>{formatTimestamp(shop.created_at)}</td><td>{shop.member_count}</td><td>{shop.item_count}</td></tr>)}</tbody></table>{shops.length === 0 && <EmptyState icon={BriefcaseBusiness} title="No shops yet" text="New shops will appear here." />}</div></section>
  </div>
}

function SettingsPage({ items, onEditUnits, onSetupUnits }) {
  return <div className="conversion-settings-layout">
    <section className="panel conversion-settings-panel">
      <div className="panel-heading padded-heading"><div><span className="eyebrow">YOUR PRODUCT MEASURES</span><h2>Unit conversions</h2></div><span className="neutral-pill">Saved per user and product</span></div>
      <p className="conversion-intro">Set the measures you use for each product. Your ratios stay personal; every entry is converted into the product’s shared stock unit.</p>
      <div className="conversion-product-list">{items.map((item) => {
        const profile = item.profile
        const summary = profile?.edges.map((edge) => `1 ${edge.from} = ${edge.factor} ${edge.to}`).join(' · ')
        return <article className="conversion-product-row" key={item.id}>
          <span className="conversion-product-icon"><Boxes size={17} /></span>
          <span className="conversion-product-info"><strong>{item.name}</strong><small>{profile ? `${profile.kind === 'bulk' ? 'Bulk foodstuff' : 'Packaged'} · ${summary}` : 'Units not defined yet'}</small></span>
          <span className="conversion-stock">{item.quantity} {item.stock_unit}</span>
          <button className="button button-quiet conversion-edit-button" onClick={() => profile ? onEditUnits({ ...item, unit_profile: profile }) : onSetupUnits({ ...item, unit_profile: null })}>{profile ? 'Edit units' : 'Define units'}</button>
        </article>
      })}{items.length === 0 && <EmptyState icon={Ruler} title="No products to configure" text="Add a product to define its bulk or packaged unit hierarchy." />}</div>
      <div className="table-footer"><span><strong>{items.filter((item) => item.profile).length}</strong> configured products</span><span>Ratios can differ by user for the same product</span></div>
    </section>
  </div>
}

function AccountPage({ user, shops, isOwner, employees, busy, error, onCreateShop, onSelectShop, onAddEmployee, onToggleEmployee, onResetEmployee, onRemoveEmployee }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('₦')
  function submit(event) {
    event.preventDefault()
    onCreateShop(name, currency)
  }
  return <div className="account-layout">
    <section className="panel account-panel">
      <div className="panel-heading padded-heading"><div><span className="eyebrow">YOUR WORKSPACES</span><h2>Shops</h2></div><span className="neutral-pill">{shops.length} memberships</span></div>
      <div className="account-shop-list">{shops.map((membership) => <article className={`account-shop-row ${membership.selected ? 'account-shop-selected' : ''}`} key={membership.id}><span className="shop-avatar account-shop-avatar">{membership.name.slice(0, 1).toUpperCase()}</span><span className="account-shop-info"><strong>{membership.name}</strong><small>{membership.role} · {membership.currency} · {membership.active ? 'Active' : 'Disabled'}</small></span>{membership.selected ? <span className="current-shop-label"><Check size={13} /> Current</span> : <button className="button button-quiet" disabled={busy || !membership.active} onClick={() => onSelectShop(membership.id)}>Switch shop <ArrowRight size={14} /></button>}</article>)}{shops.length === 0 && <EmptyState icon={BriefcaseBusiness} title="No shop access yet" text="Create your first shop or ask an owner to add your account." />}</div>
      <div className="table-footer"><span>Signed in as <strong>{user.email}</strong></span><span>Access is managed per shop</span></div>
    </section>
    <section className="panel account-create-panel"><div className="panel-heading"><div><span className="eyebrow">NEW WORKSPACE</span><h2>Create a shop</h2></div><span className="conversion-product-icon"><Plus size={17} /></span></div><p className="account-copy">Create another shop under this account. You’ll become its owner and can switch shops at any time.</p><form className="account-create-form" onSubmit={submit}><Field label="Shop name" placeholder="e.g. Market Street Store" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /><label className="field"><span>Currency</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="₦">₦ Nigerian naira</option><option value="$">$ US dollar</option><option value="£">£ Pound sterling</option><option value="€">€ Euro</option><option value="GH₵">GH₵ Ghanaian cedi</option><option value="KSh">KSh Kenyan shilling</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? 'Creating…' : 'Create and switch to shop'}<ArrowRight size={15} /></button></form></section>
    {isOwner && <Team employees={employees} onAdd={onAddEmployee} onToggle={onToggleEmployee} onReset={onResetEmployee} onRemove={onRemoveEmployee} />}
  </div>
}

function UnitProfileDialog({ dialog, busy, error, onClose, onSubmit }) {
  const item = dialog.item
  const existingProfile = item.unit_profile || item.profile
  const [fields, setFields] = useState(() => fieldsFromProfile(existingProfile, item.name))
  const [openingQuantity, setOpeningQuantity] = useState('')
  const profile = buildUnitProfile(fields)
  const profileValid = isValidUnitProfile(profile) && !(fields.kind === 'bulk' && fields.kgPerPaint !== '' && fields.kgPerBag !== '')
  const needsOpeningStock = Boolean(profile) && dialog.firstSetup && item.stock_unit === 'unit' && item.quantity > 0
  const units = profile ? [...new Set(profile.edges.flatMap((edge) => [edge.from, edge.to]))] : []
  function submit(event) {
    event.preventDefault()
    if (!profileValid) return
    const body = { ...profile }
    if (needsOpeningStock) {
      body.opening_quantity = Number(openingQuantity)
      body.opening_unit = profile.primary_unit
    }
    onSubmit(`/unit-conversions/${item.id}`, { method: 'PUT', body: JSON.stringify(body) }, `${item.name} unit conversions saved`)
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog unit-dialog" role="dialog" aria-modal="true" aria-labelledby="unit-dialog-title"><div className="dialog-heading"><div><span className="eyebrow">{item.name.toUpperCase()}</span><h2 id="unit-dialog-title">{existingProfile ? 'Edit unit hierarchy' : 'Define product units'}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div><form className="dialog-form" onSubmit={submit}><UnitConversionEditor fields={fields} onChange={setFields} kindDisabled={Boolean(existingProfile)} />{needsOpeningStock && <div className="opening-stock-field"><RatioField label={`Current stock in ${profile?.primary_unit || 'selected unit'}`} value={openingQuantity} onChange={setOpeningQuantity} placeholder={`Current ${item.quantity} ${item.stock_unit} count`} /><p className="unit-footnote">Confirm what the existing quantity represents so it can be safely converted to {profile?.base_unit || 'the base unit'}.</p></div>}{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || !profileValid || (needsOpeningStock && openingQuantity === '')}>{busy ? 'Saving…' : 'Save unit hierarchy'}<ArrowRight size={15} /></button></div><span className="sr-only">Available units: {units.join(', ')}</span></form></section></div>
}

function RatioField({ label, value, onChange, placeholder }) {
  return <label className="field"><span>{label}</span><input type="number" min="0" step="any" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required /></label>
}

function StockEntryDialog({ item, busy, error, onClose, onSubmit }) {
  const [quantity, setQuantity] = useState('')
  const profile = item.unit_profile
  const units = profile ? [...new Set(profile.edges.flatMap((edge) => [edge.from, edge.to]))] : [item.stock_unit]
  const [unit, setUnit] = useState(profile?.primary_unit || item.stock_unit)
  let preview = null
  if (quantity !== '' && Number.isFinite(Number(quantity))) {
    preview = profile
      ? unitPreviewValue(Number(quantity), unit, profile)
      : Number(quantity)
  }
  function submit(event) {
    event.preventDefault()
    onSubmit(`/items/${item.id}/stock`, { method: 'POST', body: JSON.stringify({ quantity: Number(quantity), unit }) }, `Stock added for ${item.name}`)
  }
  const baseUnit = profile?.base_unit || item.stock_unit
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="stock-dialog-title"><div className="dialog-heading"><div><span className="eyebrow">INVENTORY ENTRY</span><h2 id="stock-dialog-title">Add stock</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div><form className="dialog-form" onSubmit={submit}><p className="dialog-copy">Add more <strong>{item.name}</strong>.{profile ? ` The amount will be converted into ${baseUnit} automatically.` : ` The amount is entered in ${baseUnit}.`}</p><RatioField label="Quantity" value={quantity} onChange={setQuantity} placeholder="e.g. 1.5" /><label className="field"><span>Entry unit</span><select value={unit} onChange={(event) => setUnit(event.target.value)}>{units.map((unitName) => <option key={unitName} value={unitName}>{unitName}</option>)}</select></label>{preview !== null && <p className="conversion-preview">{quantity} {unit} = <strong>{Number(preview.toFixed(8))} {baseUnit}</strong></p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || quantity === ''}>{busy ? 'Saving…' : 'Add stock'}<Plus size={15} /></button></div></form></section></div>
}

function unitPreviewValue(quantity, from, profile) {
  try { return convertQuantity(quantity, from, profile.base_unit, profile.edges) }
  catch { return null }
}

function Team({ employees, onAdd, onToggle, onReset, onRemove }) {
  return <div className="team-layout"><section className="panel team-panel"><div className="panel-heading padded-heading"><div><span className="eyebrow">SHOP ACCESS</span><h2>Your team</h2></div><button className="button button-primary" onClick={onAdd}><UserPlus size={16} /> Add employee</button></div><div className="team-list">{employees.map((employee) => <div className="team-row" key={employee.id}><span className="team-avatar">{initials(employee.email)}</span><span className="team-person"><strong>{employee.email}</strong><small>Employee · Added {new Date(`${employee.created_at.replace(' ', 'T')}Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small></span><span className={`team-status ${employee.active ? 'team-active' : 'team-disabled'}`}><i />{employee.active ? 'Active' : 'Disabled'}</span><details className="team-menu"><summary aria-label={`Actions for ${employee.email}`}><MoreHorizontal size={19} /></summary><div className="team-menu-pop"><button onClick={() => onToggle(employee)}>{employee.active ? 'Disable access' : 'Enable access'}</button><button onClick={() => onReset(employee)}>Reset password</button><button className="menu-danger" onClick={() => onRemove(employee)}>Remove employee</button></div></details></div>)}{employees.length === 0 && <EmptyState icon={Users} title="It’s just you for now" text="Add an employee to let them record sales and view inventory." action="Add your first employee" onAction={onAdd} />}</div><div className="table-footer"><span><strong>{employees.length}</strong> {employees.length === 1 ? 'employee' : 'employees'}</span><span>Disabled team members can no longer sign in</span></div></section><section className="access-note"><span className="access-note-icon"><ShieldCheck size={19} /></span><div><strong>Access stays in its lane</strong><p>Employees can see inventory and record sales. Shop finances, reports and team settings are reserved for owners.</p></div></section></div>
}

function ActionDialog({ dialog, currency, busy, error, onClose, onSubmit }) {
  const { type } = dialog
  let title = 'Add item'
  let action = 'Add item'
  let endpoint = '/items'
  let method = 'POST'
  let message = 'Item added to inventory'
  if (type === 'item' && dialog.item) { title = 'Edit item'; action = 'Save changes'; endpoint = `/items/${dialog.item.id}`; method = 'PATCH'; message = 'Item updated' }
  if (type === 'expense') { title = 'Add expense'; action = 'Save expense'; endpoint = '/expenses'; message = 'Expense recorded' }
  if (type === 'employee') { title = 'Add employee'; action = 'Add to team'; endpoint = '/team'; message = 'Employee added. They’ll need to change their password on first sign-in.' }
  if (type === 'reset-password') { title = 'Reset password'; action = 'Set temporary password'; endpoint = `/team/${dialog.employee.id}/reset-password`; message = 'Temporary password set. Share it with the employee.' }
  if (type === 'delete-item' || type === 'remove-employee') {
    const removingEmployee = type === 'remove-employee'
    title = removingEmployee ? 'Remove employee?' : 'Delete item?'
    action = removingEmployee ? 'Remove employee' : 'Delete item'
    endpoint = removingEmployee ? `/team/${dialog.employee.id}` : `/items/${dialog.item.id}`
    method = 'DELETE'
    message = removingEmployee ? 'Employee removed' : 'Item deleted'
  }
  const confirmOnly = type === 'delete-item' || type === 'remove-employee'
  const start = dialog.item || {}
  const [fields, setFields] = useState({ name: start.name || '', sku: start.sku || '', quantity: start.quantity ?? '', price: start.price ?? '', cost: start.cost ?? '', description: '', amount: '', email: dialog.employee?.email || '', temporary_password: '' })
  const [localError, setLocalError] = useState('')
  function submit(event) {
    event.preventDefault()
    const body = type === 'expense'
      ? { description: fields.description, amount: Number(fields.amount) }
      : type === 'employee'
        ? { email: fields.email, temporary_password: fields.temporary_password }
        : type === 'reset-password'
          ? { temporary_password: fields.temporary_password }
          : { name: fields.name, sku: fields.sku, quantity: Number(fields.quantity), price: Number(fields.price), cost: Number(fields.cost) }
    if (type === 'item' && Number(body.price) < Number(body.cost)) setLocalError('Selling price is below the item cost. You can still save if intentional.')
    onSubmit(endpoint, { method, ...(confirmOnly ? {} : { body: JSON.stringify(body) }) }, message)
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-heading"><div><span className="eyebrow">{type === 'employee' || type === 'reset-password' || type === 'remove-employee' ? 'TEAM ACCESS' : 'SHOP RECORDS'}</span><h2 id="dialog-title">{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div>{confirmOnly ? <><p className="dialog-copy">{type === 'remove-employee' ? <>Remove <strong>{dialog.employee.email}</strong> from this shop? They will lose access immediately. Past sales will remain in your records.</> : <>Delete <strong>{dialog.item.name}</strong> from your inventory? This can’t be undone.</>}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-danger" disabled={busy} onClick={() => onSubmit(endpoint, { method }, message)}>{action}</button></div></> : <form className="dialog-form" onSubmit={submit}>{type === 'item' && <><Field label="Item name" placeholder="e.g. Ground coffee" value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} required /><Field label="SKU" placeholder="e.g. COF-001" value={fields.sku} onChange={(event) => setFields({ ...fields, sku: event.target.value })} required /><div className="field-row"><Field label="Quantity" type="number" min="0" step="1" placeholder="0" value={fields.quantity} onChange={(event) => setFields({ ...fields, quantity: event.target.value })} required /><Field label={`Price (${currency})`} type="number" min="0" step="0.01" placeholder="0.00" value={fields.price} onChange={(event) => setFields({ ...fields, price: event.target.value })} required /></div><Field label={`Unit cost (${currency})`} type="number" min="0" step="0.01" placeholder="0.00" value={fields.cost} onChange={(event) => setFields({ ...fields, cost: event.target.value })} required />{localError && <p className="form-hint">{localError}</p>}</>}{type === 'expense' && <><Field label="Description" placeholder="e.g. Shop rent" value={fields.description} onChange={(event) => setFields({ ...fields, description: event.target.value })} required /><Field label={`Amount (${currency})`} type="number" min="0.01" step="0.01" placeholder="0.00" value={fields.amount} onChange={(event) => setFields({ ...fields, amount: event.target.value })} required /></>}{type === 'employee' && <><Field label="Employee email" type="email" placeholder="colleague@yourshop.com" value={fields.email} onChange={(event) => setFields({ ...fields, email: event.target.value })} required /><Field label="Temporary password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={fields.temporary_password} onChange={(event) => setFields({ ...fields, temporary_password: event.target.value })} minLength={8} required /><p className="dialog-hint">They’ll be asked to change this password the first time they sign in.</p></>}{type === 'reset-password' && <><p className="dialog-copy reset-copy">Set a temporary password for <strong>{dialog.employee.email}</strong>.</p><Field label="Temporary password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={fields.temporary_password} onChange={(event) => setFields({ ...fields, temporary_password: event.target.value })} minLength={8} required /><p className="dialog-hint">The employee must choose a new password at their next sign-in.</p></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : action}<ArrowRight size={15} /></button></div></form>}</section></div>
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={20} /></span><strong>{title}</strong><p>{text}</p>{action && <button className="text-button" onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div>
}

export default App
