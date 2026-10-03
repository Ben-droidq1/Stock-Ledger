import 'dotenv/config'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { convertQuantity, validateUnitEdges } from './src/unitConversions.js'

const port = Number(process.env.API_PORT || 3001)
const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'shops.sqlite')
const jwtSecret = process.env.JWT_SECRET || 'local-development-secret-change-before-deploy'

if (process.env.NODE_ENV === 'production' && (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET === 'replace-this-with-a-long-random-secret'
)) {
  throw new Error('Set a unique JWT_SECRET of at least 32 characters in production')
}

mkdirSync(path.dirname(databasePath), { recursive: true })
const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT '₦',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    shop_id INTEGER REFERENCES shops(id),
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'employee')),
    active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    removed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_shops (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'employee')),
    active INTEGER NOT NULL DEFAULT 1,
    removed_at TEXT,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, shop_id)
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id),
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    price REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
    cost REAL NOT NULL DEFAULT 0 CHECK (cost >= 0),
    stock_unit TEXT NOT NULL DEFAULT 'unit',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (shop_id, sku)
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    total REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL,
    unit_cost REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY,
    shop_id INTEGER NOT NULL REFERENCES shops(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    description TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS unit_profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('bulk', 'packaged')),
    base_unit TEXT NOT NULL,
    primary_unit TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS unit_conversion_edges (
    id INTEGER PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES unit_profiles(id) ON DELETE CASCADE,
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    factor REAL NOT NULL CHECK (factor > 0),
    UNIQUE (profile_id, from_unit, to_unit)
  );
  CREATE INDEX IF NOT EXISTS items_shop_idx ON items(shop_id);
  CREATE INDEX IF NOT EXISTS sales_shop_idx ON sales(shop_id, created_at);
  CREATE INDEX IF NOT EXISTS expenses_shop_idx ON expenses(shop_id, created_at);
  CREATE INDEX IF NOT EXISTS unit_profiles_user_shop_idx ON unit_profiles(user_id, shop_id);
`)

db.prepare(`
  INSERT OR IGNORE INTO user_shops (user_id, shop_id, role, active, removed_at)
  SELECT id, shop_id, role, active, removed_at FROM users WHERE shop_id IS NOT NULL
`).run()

if (!db.pragma('table_info(items)').some((column) => column.name === 'stock_unit')) {
  db.exec("ALTER TABLE items ADD COLUMN stock_unit TEXT NOT NULL DEFAULT 'unit'")
}

const app = express()
app.use(express.json({ limit: '32kb' }))

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

const requireText = (value, label, maxLength = 120) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${label} is required`)
  }
  return value.trim()
}

const validEmail = (value) =>
  typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const normalizeUnit = (value) => String(value || '').trim().toLocaleLowerCase()

function parseUnitProfile(input) {
  const kind = input?.kind
  if (!['bulk', 'packaged'].includes(kind)) throw new HttpError(400, 'Choose bulk or packaged units')
  const baseUnit = requireText(input.base_unit, 'Base unit', 40)
  const primaryUnit = requireText(input.primary_unit, 'Primary unit', 40)
  let edges
  try {
    edges = validateUnitEdges(input.edges, baseUnit)
    convertQuantity(1, baseUnit, primaryUnit, edges)
  } catch (error) {
    throw new HttpError(400, error.message)
  }

  const pairs = new Set(edges.map((edge) => `${normalizeUnit(edge.from)}>${normalizeUnit(edge.to)}`))
  if (kind === 'packaged' && (
    normalizeUnit(baseUnit) !== 'sachet' ||
    !pairs.has('roll>sachet') ||
    !pairs.has('carton>roll')
  )) {
    throw new HttpError(400, 'Packaged products need Sachet → Roll and Roll → Carton ratios')
  }
  if (kind === 'bulk' && (
    normalizeUnit(baseUnit) !== 'cup' ||
    !pairs.has('paint>cup')
  )) {
    throw new HttpError(400, 'Bulk products need a Cups per Paint ratio and use Cup as the base unit')
  }
  return { kind, baseUnit, primaryUnit, edges }
}

function readUnitProfile(userId, shopId, itemId) {
  const profile = db.prepare(`
    SELECT id, kind, base_unit, primary_unit FROM unit_profiles
    WHERE user_id = ? AND shop_id = ? AND item_id = ?
  `).get(userId, shopId, itemId)
  if (!profile) return null
  return {
    kind: profile.kind,
    base_unit: profile.base_unit,
    primary_unit: profile.primary_unit,
    edges: db.prepare(`
      SELECT from_unit AS "from", to_unit AS "to", factor
      FROM unit_conversion_edges WHERE profile_id = ? ORDER BY id
    `).all(profile.id),
  }
}

function storeUnitProfile(userId, shopId, itemId, profile) {
  const existing = db.prepare('SELECT id FROM unit_profiles WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId)
  let profileId = existing?.id
  if (existing) {
    db.prepare(`
      UPDATE unit_profiles SET kind = ?, base_unit = ?, primary_unit = ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND shop_id = ?
    `).run(profile.kind, profile.baseUnit, profile.primaryUnit, profileId, userId, shopId)
    db.prepare('DELETE FROM unit_conversion_edges WHERE profile_id = ?').run(profileId)
  } else {
    const result = db.prepare(`
      INSERT INTO unit_profiles (user_id, shop_id, item_id, kind, base_unit, primary_unit)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, shopId, itemId, profile.kind, profile.baseUnit, profile.primaryUnit)
    profileId = result.lastInsertRowid
  }
  const insertEdge = db.prepare(`
    INSERT INTO unit_conversion_edges (profile_id, from_unit, to_unit, factor)
    VALUES (?, ?, ?, ?)
  `)
  for (const edge of profile.edges) insertEdge.run(profileId, edge.from, edge.to, edge.factor)
}

function convertEntryQuantity(quantity, fromUnit, profile, stockUnit = 'unit') {
  if (!profile) {
    if (fromUnit && normalizeUnit(fromUnit) !== normalizeUnit(stockUnit)) {
      throw new HttpError(409, 'Define this product’s unit hierarchy before entering stock in that unit')
    }
    return Number(quantity)
  }
  try {
    const baseUnit = profile.base_unit || profile.baseUnit
    return convertQuantity(quantity, fromUnit || baseUnit, baseUnit, profile.edges)
  } catch (error) {
    throw new HttpError(400, error.message)
  }
}

const cleanUser = (user) => ({
  id: user.id,
  email: user.email,
  shop_id: user.shop_id,
  role: user.role,
  active: Boolean(user.active),
  must_change_password: Boolean(user.must_change_password),
})

const membershipFor = (userId, shopId) => db.prepare(`
  SELECT shop_id, role, active FROM user_shops
  WHERE user_id = ? AND shop_id = ? AND active = 1 AND removed_at IS NULL
`).get(userId, shopId)

const issueToken = (user) => jwt.sign({ sub: user.id, shop_id: user.shop_id ?? null }, jwtSecret, { expiresIn: '15m' })

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
})

app.post('/api/auth/signup', loginLimiter, asyncRoute(async (req, res) => {
  const email = validEmail(req.body.email) ? req.body.email.trim().toLowerCase() : null
  const password = req.body.password
  if (!email) throw new HttpError(400, 'Enter a valid email address')
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Password must be at least 8 characters')
  }
  if (req.body.password_confirmation !== password) throw new HttpError(400, 'Passwords do not match')

  try {
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
      .run(email, await bcrypt.hash(password, 12))
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json({ token: issueToken(user), user: cleanUser(user) })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'An account with this email already exists')
    throw error
  }
}))

app.post('/api/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user || user.removed_at || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) {
    throw new HttpError(401, 'Email or password is incorrect')
  }
  let membership = user.shop_id ? membershipFor(user.id, user.shop_id) : null
  if (!membership) {
    membership = db.prepare(`
      SELECT shop_id, role, active FROM user_shops
      WHERE user_id = ? AND active = 1 AND removed_at IS NULL ORDER BY joined_at LIMIT 1
    `).get(user.id)
  }
    if (!membership && db.prepare('SELECT 1 FROM user_shops WHERE user_id = ? LIMIT 1').get(user.id)) {
      throw new HttpError(403, 'This account has no active shop memberships')
    }
  const sessionUser = membership
    ? { ...user, shop_id: membership.shop_id, role: membership.role }
    : { ...user, shop_id: null }
  if (membership && user.shop_id !== membership.shop_id) {
    db.prepare('UPDATE users SET shop_id = ?, role = ? WHERE id = ?').run(membership.shop_id, membership.role, user.id)
  }
  res.json({ token: issueToken(sessionUser), user: cleanUser(sessionUser) })
}))

const authenticate = asyncRoute(async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) throw new HttpError(401, 'Sign in to continue')
  let payload
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.')
  }
  const account = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
    if (!account || account.removed_at) throw new HttpError(401, 'This account is unavailable')
  const shopId = payload.shop_id ?? account.shop_id
  const membership = shopId ? membershipFor(account.id, shopId) : null
  if (shopId && !membership) throw new HttpError(403, 'This account no longer has access to the selected shop')
  req.user = membership ? { ...account, shop_id: membership.shop_id, role: membership.role } : { ...account, shop_id: null }
  next()
})

const requireShop = (req, res, next) => {
  if (!req.user.shop_id) return next(new HttpError(409, 'Create your shop to continue'))
  next()
}

const requireOwner = (req, res, next) => {
  if (req.user.role !== 'owner') return next(new HttpError(403, 'Owner access required'))
  next()
}

const requireReady = (req, res, next) => {
  if (req.user.must_change_password && req.path !== '/auth/change-password' && req.path !== '/auth/me') {
    return next(new HttpError(428, 'Change your temporary password to continue'))
  }
  next()
}

app.use('/api', authenticate, requireReady)

app.get('/api/auth/me', (req, res) => {
  const shop = req.user.shop_id
    ? db.prepare('SELECT id, name, currency FROM shops WHERE id = ?').get(req.user.shop_id)
    : null
  res.json({ user: cleanUser(req.user), shop })
})

app.post('/api/auth/change-password', asyncRoute(async (req, res) => {
  const password = req.body.password
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Password must be at least 8 characters')
  }
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(await bcrypt.hash(password, 12), req.user.id)
  res.json({ message: 'Password updated' })
}))

app.get('/api/account/shops', (req, res) => {
  const shops = db.prepare(`
    SELECT shops.id, shops.name, shops.currency, user_shops.role, user_shops.active,
      user_shops.joined_at, user_shops.shop_id = ? AS selected
    FROM user_shops JOIN shops ON shops.id = user_shops.shop_id
    WHERE user_shops.user_id = ? AND user_shops.active = 1 AND user_shops.removed_at IS NULL
    ORDER BY user_shops.joined_at
  `).all(req.user.shop_id, req.user.id).map((shop) => ({ ...shop, selected: Boolean(shop.selected), active: Boolean(shop.active) }))
  res.json({ shops })
})

app.post('/api/shops', asyncRoute(async (req, res) => {
  const name = requireText(req.body.name, 'Shop name', 80)
  const currency = typeof req.body.currency === 'string' && req.body.currency.trim()
    ? req.body.currency.trim().slice(0, 8)
    : '₦'
  const createShop = db.transaction(() => {
    const result = db.prepare('INSERT INTO shops (name, currency) VALUES (?, ?)').run(name, currency)
    db.prepare("INSERT INTO user_shops (user_id, shop_id, role, active) VALUES (?, ?, 'owner', 1)")
      .run(req.user.id, result.lastInsertRowid)
    db.prepare("UPDATE users SET shop_id = ?, role = 'owner' WHERE id = ?").run(result.lastInsertRowid, req.user.id)
    return db.prepare('SELECT id, name, currency FROM shops WHERE id = ?').get(result.lastInsertRowid)
  })
  const shop = createShop()
  const user = { ...req.user, shop_id: shop.id, role: 'owner' }
  res.status(201).json({ shop, user: cleanUser(user), token: issueToken(user) })
}))

app.post('/api/account/shops/select', (req, res) => {
  const shopId = Number(req.body.shop_id)
  if (!Number.isInteger(shopId) || shopId <= 0) throw new HttpError(400, 'Choose a shop')
  const membership = membershipFor(req.user.id, shopId)
  if (!membership) throw new HttpError(404, 'Shop membership not found')
  db.prepare('UPDATE users SET shop_id = ?, role = ? WHERE id = ?').run(shopId, membership.role, req.user.id)
  const user = { ...req.user, shop_id: shopId, role: membership.role }
  const shop = db.prepare('SELECT id, name, currency FROM shops WHERE id = ?').get(shopId)
  res.json({ shop, user: cleanUser(user), token: issueToken(user) })
})

app.get('/api/items', requireShop, (req, res) => {
  const columns = req.user.role === 'owner' ? 'id, name, sku, quantity, price, cost' : 'id, name, sku, quantity, price'
  const items = db.prepare(`SELECT ${columns}, stock_unit FROM items WHERE shop_id = ? AND active = 1 ORDER BY name`)
    .all(req.user.shop_id)
    .map((item) => ({ ...item, unit_profile: readUnitProfile(req.user.id, req.user.shop_id, item.id) }))
  res.json({ items })
})

app.post('/api/items', requireShop, (req, res) => {
  const name = requireText(req.body.name, 'Item name', 100)
  const sku = requireText(req.body.sku, 'SKU', 60)
  const quantity = Number(req.body.quantity)
  const price = Number(req.body.price)
  const cost = req.user.role === 'owner' ? Number(req.body.cost) : 0
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0) {
    throw new HttpError(400, 'Enter a valid quantity and price')
  }
  const profile = req.body.unit_profile ? parseUnitProfile(req.body.unit_profile) : null
  const stockUnit = profile?.baseUnit || 'unit'
  const quantityInBase = convertEntryQuantity(quantity, req.body.quantity_unit || stockUnit, profile, stockUnit)
  try {
    const createItem = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO items (shop_id, name, sku, quantity, price, cost, stock_unit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.shop_id, name, sku, quantityInBase, price, cost, stockUnit)
      if (profile) storeUnitProfile(req.user.id, req.user.shop_id, result.lastInsertRowid, profile)
      return db.prepare('SELECT id, name, sku, quantity, price, cost, stock_unit FROM items WHERE id = ? AND shop_id = ?')
        .get(result.lastInsertRowid, req.user.shop_id)
    })
    const item = createItem()
    const visibleItem = req.user.role === 'owner' ? item : (({ cost: _cost, ...visible }) => visible)(item)
    res.status(201).json({ item: { ...visibleItem, unit_profile: readUnitProfile(req.user.id, req.user.shop_id, item.id) } })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'That SKU is already in use')
    throw error
  }
})

app.patch('/api/items/:id', requireShop, (req, res) => {
  const existing = db.prepare('SELECT * FROM items WHERE id = ? AND shop_id = ? AND active = 1').get(req.params.id, req.user.shop_id)
  if (!existing) throw new HttpError(404, 'Item not found')
  const name = req.body.name === undefined ? existing.name : requireText(req.body.name, 'Item name', 100)
  const sku = req.body.sku === undefined ? existing.sku : requireText(req.body.sku, 'SKU', 60)
  const quantity = req.body.quantity === undefined ? existing.quantity : Number(req.body.quantity)
  const price = req.body.price === undefined ? existing.price : Number(req.body.price)
  const cost = req.user.role === 'owner'
    ? (req.body.cost === undefined ? existing.cost : Number(req.body.cost))
    : existing.cost
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0) {
    throw new HttpError(400, 'Enter a valid quantity and price')
  }
  const profile = readUnitProfile(req.user.id, req.user.shop_id, req.params.id)
  const quantityInBase = req.body.quantity === undefined
    ? existing.quantity
    : convertEntryQuantity(quantity, req.body.quantity_unit || profile?.base_unit || existing.stock_unit, profile, existing.stock_unit)
  db.prepare('UPDATE items SET name = ?, sku = ?, quantity = ?, price = ?, cost = ? WHERE id = ? AND shop_id = ?')
    .run(name, sku, quantityInBase, price, cost, req.params.id, req.user.shop_id)
  const visibleColumns = req.user.role === 'owner'
    ? 'id, name, sku, quantity, price, cost, stock_unit'
    : 'id, name, sku, quantity, price, stock_unit'
  const item = db.prepare(`SELECT ${visibleColumns} FROM items WHERE id = ? AND shop_id = ?`)
    .get(req.params.id, req.user.shop_id)
  res.json({ item: { ...item, unit_profile: profile } })
})

app.post('/api/items/:id/stock', requireShop, (req, res) => {
  const item = db.prepare('SELECT id, quantity, stock_unit FROM items WHERE id = ? AND shop_id = ? AND active = 1')
    .get(req.params.id, req.user.shop_id)
  if (!item) throw new HttpError(404, 'Item not found')
  const quantity = Number(req.body.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) throw new HttpError(400, 'Enter a positive stock quantity')
  const profile = readUnitProfile(req.user.id, req.user.shop_id, item.id)
  const quantityInBase = convertEntryQuantity(quantity, req.body.unit || item.stock_unit, profile, item.stock_unit)
  db.prepare('UPDATE items SET quantity = quantity + ? WHERE id = ? AND shop_id = ?')
    .run(quantityInBase, item.id, req.user.shop_id)
  res.json({ item: { ...item, quantity: item.quantity + quantityInBase, unit_profile: profile } })
})

app.get('/api/unit-conversions', requireShop, (req, res) => {
  const items = db.prepare(`
    SELECT id, name, sku, quantity, stock_unit FROM items
    WHERE shop_id = ? AND active = 1 ORDER BY name
  `).all(req.user.shop_id).map((item) => ({
    ...item,
    profile: readUnitProfile(req.user.id, req.user.shop_id, item.id),
  }))
  res.json({ items })
})

app.put('/api/unit-conversions/:itemId', requireShop, (req, res) => {
  const item = db.prepare('SELECT id, quantity, stock_unit FROM items WHERE id = ? AND shop_id = ? AND active = 1')
    .get(req.params.itemId, req.user.shop_id)
  if (!item) throw new HttpError(404, 'Item not found')
  const profile = parseUnitProfile(req.body)
  const existingProfile = readUnitProfile(req.user.id, req.user.shop_id, item.id)
  if (item.stock_unit !== 'unit' && normalizeUnit(item.stock_unit) !== normalizeUnit(profile.baseUnit)) {
    throw new HttpError(409, `This product’s stock is stored in ${item.stock_unit}; its base unit cannot be changed`)
  }
  const openingQuantity = req.body.opening_quantity === undefined ? null : Number(req.body.opening_quantity)
  if (!existingProfile && item.stock_unit === 'unit' && item.quantity > 0 && openingQuantity === null) {
    throw new HttpError(409, 'Enter the current stock quantity and unit to set up this product’s first conversion profile')
  }
  if (openingQuantity !== null && (!Number.isFinite(openingQuantity) || openingQuantity < 0)) {
    throw new HttpError(400, 'Current stock must be a non-negative number')
  }
  const rebasedQuantity = openingQuantity === null
    ? item.quantity
    : convertEntryQuantity(openingQuantity, req.body.opening_unit || profile.baseUnit, profile, profile.baseUnit)
  const saveProfile = db.transaction(() => {
    storeUnitProfile(req.user.id, req.user.shop_id, item.id, profile)
    db.prepare('UPDATE items SET stock_unit = ?, quantity = ? WHERE id = ? AND shop_id = ?')
      .run(profile.baseUnit, rebasedQuantity, item.id, req.user.shop_id)
  })
  saveProfile()
  res.json({ profile: readUnitProfile(req.user.id, req.user.shop_id, item.id) })
})

app.delete('/api/items/:id', requireShop, requireOwner, (req, res) => {
  const result = db.prepare('UPDATE items SET active = 0 WHERE id = ? AND shop_id = ? AND active = 1')
    .run(req.params.id, req.user.shop_id)
  if (!result.changes) throw new HttpError(404, 'Item not found')
  res.status(204).end()
})

app.post('/api/sales', requireShop, (req, res) => {
  const lines = req.body.items
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 50) throw new HttpError(400, 'Add at least one item to the sale')
  const createSale = db.transaction(() => {
    const normalized = new Map()
    for (const line of lines) {
      const itemId = Number(line.item_id)
      const quantity = Number(line.quantity)
      if (!Number.isInteger(itemId) || !Number.isInteger(quantity) || quantity <= 0) throw new HttpError(400, 'Sale quantities must be whole numbers')
      normalized.set(itemId, (normalized.get(itemId) || 0) + quantity)
    }
    const products = [...normalized].map(([itemId, quantity]) => {
      const item = db.prepare('SELECT id, name, price, cost, quantity FROM items WHERE id = ? AND shop_id = ? AND active = 1')
        .get(itemId, req.user.shop_id)
      if (!item) throw new HttpError(404, 'One of the selected items was not found')
      if (item.quantity < quantity) throw new HttpError(409, `Not enough stock for ${item.name}`)
      return { ...item, quantity }
    })
    const total = products.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const sale = db.prepare('INSERT INTO sales (shop_id, created_by, total) VALUES (?, ?, ?)')
      .run(req.user.shop_id, req.user.id, total)
    const insertLine = db.prepare('INSERT INTO sale_items (sale_id, item_id, quantity, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)')
    const decrement = db.prepare('UPDATE items SET quantity = quantity - ? WHERE id = ? AND shop_id = ? AND quantity >= ?')
    for (const item of products) {
      insertLine.run(sale.lastInsertRowid, item.id, item.quantity, item.price, item.cost)
      if (!decrement.run(item.quantity, item.id, req.user.shop_id, item.quantity).changes) {
        throw new HttpError(409, `Not enough stock for ${item.name}`)
      }
    }
    return { id: sale.lastInsertRowid, total }
  })
  res.status(201).json({ sale: createSale() })
})

app.get('/api/sales', requireShop, requireOwner, (req, res) => {
  res.json({ sales: db.prepare(`
    SELECT sales.id, sales.total, sales.created_at, users.email AS staff_email,
      GROUP_CONCAT(items.name || ' × ' || sale_items.quantity, ', ') AS summary
    FROM sales
    JOIN users ON users.id = sales.created_by
    JOIN sale_items ON sale_items.sale_id = sales.id
    JOIN items ON items.id = sale_items.item_id AND items.shop_id = sales.shop_id
    WHERE sales.shop_id = ?
    GROUP BY sales.id ORDER BY sales.created_at DESC LIMIT 100
  `).all(req.user.shop_id) })
})

app.get('/api/expenses', requireShop, requireOwner, (req, res) => {
  res.json({ expenses: db.prepare(`
    SELECT expenses.id, expenses.description, expenses.amount, expenses.created_at, users.email AS staff_email
    FROM expenses JOIN users ON users.id = expenses.created_by
    WHERE expenses.shop_id = ? ORDER BY expenses.created_at DESC LIMIT 100
  `).all(req.user.shop_id) })
})

app.post('/api/expenses', requireShop, requireOwner, (req, res) => {
  const description = requireText(req.body.description, 'Description', 140)
  const amount = Number(req.body.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Enter a valid expense amount')
  const result = db.prepare('INSERT INTO expenses (shop_id, created_by, description, amount) VALUES (?, ?, ?, ?)')
    .run(req.user.shop_id, req.user.id, description, amount)
  res.status(201).json({ expense: db.prepare('SELECT id, description, amount, created_at FROM expenses WHERE id = ? AND shop_id = ?')
    .get(result.lastInsertRowid, req.user.shop_id) })
})

app.get('/api/dashboard', requireShop, requireOwner, (req, res) => {
  const shop_id = req.user.shop_id
  const sales = db.prepare('SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS count FROM sales WHERE shop_id = ?')
    .get(shop_id)
  const costs = db.prepare(`
    SELECT COALESCE(SUM(si.quantity * si.unit_cost), 0) AS cost
    FROM sales s JOIN sale_items si ON si.sale_id = s.id WHERE s.shop_id = ?
  `).get(shop_id).cost
  const expenses = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE shop_id = ?').get(shop_id).total
  const inventory = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(quantity * cost), 0) AS value FROM items WHERE shop_id = ? AND active = 1')
    .get(shop_id)
  const low_stock = db.prepare('SELECT COUNT(*) AS count FROM items WHERE shop_id = ? AND active = 1 AND quantity <= 5')
    .get(shop_id).count
  const active_employees = db.prepare(`
    SELECT COUNT(*) AS count FROM user_shops
    WHERE shop_id = ? AND role = 'employee' AND active = 1 AND removed_at IS NULL
  `).get(shop_id).count
  const accessible_shops = db.prepare(`
    SELECT COUNT(*) AS count FROM user_shops
    WHERE user_id = ? AND active = 1 AND removed_at IS NULL
  `).get(req.user.id).count
  const recent = db.prepare(`
    SELECT sales.id, sales.total, sales.created_at, users.email AS staff_email
    FROM sales JOIN users ON users.id = sales.created_by WHERE sales.shop_id = ?
    ORDER BY sales.created_at DESC LIMIT 5
  `).all(shop_id)
  res.json({ dashboard: {
    revenue: sales.revenue,
    gross_profit: sales.revenue - costs,
    expenses,
    net_profit: sales.revenue - costs - expenses,
    sale_count: sales.count,
    item_count: inventory.count,
    inventory_value: inventory.value,
    low_stock_count: low_stock,
    active_employees,
    accessible_shops,
    recent_sales: recent,
  } })
})

app.get('/api/reports', requireShop, requireOwner, (req, res) => {
  const shop_id = req.user.shop_id
  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(s.total), 0) AS revenue,
      COALESCE(SUM(sale_cost.cost), 0) AS cost_of_goods,
      COUNT(s.id) AS sale_count,
      COALESCE(AVG(s.total), 0) AS average_order_value
    FROM sales s
    LEFT JOIN (
      SELECT sale_id, SUM(quantity * unit_cost) AS cost
      FROM sale_items GROUP BY sale_id
    ) sale_cost ON sale_cost.sale_id = s.id
    WHERE s.shop_id = ? AND date(s.created_at) >= date('now', '-29 days')
  `).get(shop_id)
  const expenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
    WHERE shop_id = ? AND date(created_at) >= date('now', '-29 days')
  `).get(shop_id).total
  const grossProfit = summary.revenue - summary.cost_of_goods
  const netProfit = grossProfit - expenses
  const daily = db.prepare(`
    WITH RECURSIVE calendar(day) AS (
      SELECT date('now', '-29 days')
      UNION ALL SELECT date(day, '+1 day') FROM calendar WHERE day < date('now')
    ), sale_costs AS (
      SELECT sale_id, SUM(quantity * unit_cost) AS cost
      FROM sale_items GROUP BY sale_id
    ), sale_days AS (
      SELECT date(s.created_at) AS day, SUM(s.total) AS revenue,
        SUM(COALESCE(sale_costs.cost, 0)) AS cost_of_goods, COUNT(*) AS count
      FROM sales s LEFT JOIN sale_costs ON sale_costs.sale_id = s.id
      WHERE s.shop_id = ? AND date(s.created_at) >= date('now', '-29 days')
      GROUP BY date(s.created_at)
    ), expense_days AS (
      SELECT date(created_at) AS day, SUM(amount) AS expenses
      FROM expenses WHERE shop_id = ? AND date(created_at) >= date('now', '-29 days')
      GROUP BY date(created_at)
    )
    SELECT calendar.day AS date, COALESCE(sale_days.revenue, 0) AS revenue,
      COALESCE(sale_days.cost_of_goods, 0) AS cost_of_goods,
      COALESCE(sale_days.revenue, 0) - COALESCE(sale_days.cost_of_goods, 0) AS gross_profit,
      COALESCE(expense_days.expenses, 0) AS expenses,
      COALESCE(sale_days.revenue, 0) - COALESCE(sale_days.cost_of_goods, 0) - COALESCE(expense_days.expenses, 0) AS net_profit,
      COALESCE(sale_days.count, 0) AS count
    FROM calendar LEFT JOIN sale_days ON sale_days.day = calendar.day
    LEFT JOIN expense_days ON expense_days.day = calendar.day ORDER BY calendar.day
  `).all(shop_id, shop_id)
  const bestsellers = db.prepare(`
    SELECT items.name, SUM(sale_items.quantity) AS units,
      SUM(sale_items.quantity * sale_items.unit_price) AS revenue,
      SUM(sale_items.quantity * (sale_items.unit_price - sale_items.unit_cost)) AS gross_profit
    FROM sale_items JOIN sales ON sales.id = sale_items.sale_id
    JOIN items ON items.id = sale_items.item_id AND items.shop_id = sales.shop_id
    WHERE sales.shop_id = ? AND date(sales.created_at) >= date('now', '-29 days')
    GROUP BY items.id ORDER BY revenue DESC LIMIT 5
  `).all(shop_id)
  res.json({
    period: { start: daily[0]?.date, end: daily.at(-1)?.date, days: daily.length },
    summary: {
      revenue: summary.revenue,
      cost_of_goods: summary.cost_of_goods,
      gross_profit: grossProfit,
      expenses,
      net_profit: netProfit,
      profit_margin: summary.revenue ? (netProfit / summary.revenue) * 100 : 0,
      sale_count: summary.sale_count,
      average_order_value: summary.average_order_value,
    },
    sales: daily,
    bestsellers,
  })
})

app.get('/api/team', requireShop, requireOwner, (req, res) => {
  res.json({ employees: db.prepare(`
    SELECT users.id, users.email, user_shops.active, user_shops.joined_at AS created_at
    FROM user_shops JOIN users ON users.id = user_shops.user_id
    WHERE user_shops.shop_id = ? AND user_shops.role = 'employee'
      AND user_shops.removed_at IS NULL ORDER BY users.email
  `).all(req.user.shop_id).map((employee) => ({ ...employee, active: Boolean(employee.active) })) })
})

app.post('/api/team', requireShop, requireOwner, asyncRoute(async (req, res) => {
  const email = validEmail(req.body.email) ? req.body.email.trim().toLowerCase() : null
  const password = req.body.temporary_password
  if (!email) throw new HttpError(400, 'Enter a valid email address')
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Temporary password must be at least 8 characters')
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const addMembership = db.transaction(() => {
      let account = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
      if (account) {
        const existing = db.prepare('SELECT role FROM user_shops WHERE user_id = ? AND shop_id = ?')
          .get(account.id, req.user.shop_id)
        if (existing?.role === 'owner') throw new HttpError(409, 'A shop owner cannot be added as an employee')
        db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
          .run(passwordHash, account.id)
      } else {
        const result = db.prepare(`
          INSERT INTO users (email, password_hash, shop_id, role, must_change_password)
          VALUES (?, ?, ?, 'employee', 1)
        `).run(email, passwordHash, req.user.shop_id)
        account = { id: result.lastInsertRowid }
      }
      db.prepare(`
        INSERT INTO user_shops (user_id, shop_id, role, active, removed_at)
        VALUES (?, ?, 'employee', 1, NULL)
        ON CONFLICT(user_id, shop_id) DO UPDATE SET
          role = 'employee', active = 1, removed_at = NULL, joined_at = CURRENT_TIMESTAMP
      `).run(account.id, req.user.shop_id)
      return db.prepare(`
        SELECT users.id, users.email, user_shops.active, user_shops.joined_at AS created_at
        FROM users JOIN user_shops ON user_shops.user_id = users.id
        WHERE users.id = ? AND user_shops.shop_id = ?
      `).get(account.id, req.user.shop_id)
    })
    res.status(201).json({ employee: addMembership() })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'An account with this email already exists')
    throw error
  }
}))

app.patch('/api/team/:id/status', requireShop, requireOwner, (req, res) => {
  const active = req.body.active
  if (typeof active !== 'boolean') throw new HttpError(400, 'Choose whether the account should be active')
  const result = db.prepare("UPDATE user_shops SET active = ? WHERE user_id = ? AND shop_id = ? AND role = 'employee' AND removed_at IS NULL")
    .run(Number(active), req.params.id, req.user.shop_id)
  if (!result.changes) throw new HttpError(404, 'Employee not found')
  res.json({ message: active ? 'Employee enabled' : 'Employee disabled' })
})

app.post('/api/team/:id/reset-password', requireShop, requireOwner, asyncRoute(async (req, res) => {
  const password = req.body.temporary_password
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Temporary password must be at least 8 characters')
  }
  const employee = db.prepare("SELECT user_id FROM user_shops WHERE user_id = ? AND shop_id = ? AND role = 'employee' AND removed_at IS NULL")
    .get(req.params.id, req.user.shop_id)
  if (!employee) throw new HttpError(404, 'Employee not found')
  const result = db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')
    .run(await bcrypt.hash(password, 12), employee.user_id)
  if (!result.changes) throw new HttpError(404, 'Employee not found')
  res.json({ message: 'Temporary password set' })
}))

app.delete('/api/team/:id', requireShop, requireOwner, (req, res) => {
  const result = db.prepare("UPDATE user_shops SET active = 0, removed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND shop_id = ? AND role = 'employee' AND removed_at IS NULL")
    .run(req.params.id, req.user.shop_id)
  if (!result.changes) throw new HttpError(404, 'Employee not found')
  res.status(204).end()
})

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  const status = error instanceof HttpError ? error.status : 500
  if (status === 500) console.error(error)
  res.status(status).json({ error: status === 500 ? 'Something went wrong' : error.message })
})

app.listen(port, () => console.log(`Shop Analytics API listening on http://localhost:${port}`))