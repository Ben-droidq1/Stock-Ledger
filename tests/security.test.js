import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

// Boots a throwaway server (temp SQLite DB, fixed test secret) and checks that
// shop data is isolated and that owner-only endpoints reject employees.
const port = 3900 + Math.floor(Math.random() * 400)
const base = `http://127.0.0.1:${port}`
const tempDir = mkdtempSync(path.join(tmpdir(), 'ledger-security-'))
let server
let serverLog = ''

const api = async (token, method, urlPath, body) => {
  const response = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let data = text
  try { data = text ? JSON.parse(text) : null } catch { /* keep raw text */ }
  return { status: response.status, data, text }
}

async function signUp(email) {
  const result = await api(null, 'POST', '/api/auth/signup', {
    email,
    password: 'password123',
    password_confirmation: 'password123',
  })
  assert.equal(result.status, 201, `signup failed: ${result.text}`)
  return result.data
}

async function createShopWithItem(email, name, sku, quantity) {
  const created = await signUp(email)
  const shop = await api(created.token, 'POST', '/api/shops', { name, currency: '₦' })
  assert.equal(shop.status, 201, `create shop failed: ${shop.text}`)
  const token = shop.data.token
  const item = await api(token, 'POST', '/api/items', { name: `${name} item`, sku, quantity, price: 10, cost: 4 })
  assert.equal(item.status, 201, `create item failed: ${item.text}`)
  return { token, user: created.user, shopId: shop.data.shop.id, itemId: item.data.item.id }
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      JWT_SECRET: `test-secret-${'x'.repeat(40)}`,
      DATABASE_PATH: path.join(tempDir, 'security.sqlite'),
      API_PORT: String(port),
      ADMIN_EMAILS: 'admin@test.dev',
      AUTH_RATE_LIMIT: '1000',
      GOOGLE_CLIENT_ID: '',
      ALLOWED_ORIGINS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.on('data', (chunk) => { serverLog += chunk })
  server.stderr.on('data', (chunk) => { serverLog += chunk })
  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      const response = await fetch(`${base}/api/auth/config`)
      if (response.ok) break
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`server did not start in time\n${serverLog}`)
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
})

after(async () => {
  if (server && !server.killed) {
    server.kill()
    await new Promise((resolve) => server.once('exit', resolve))
  }
  rmSync(tempDir, { recursive: true, force: true })
})

test('a shop can only read its own items', async () => {
  const a = await createShopWithItem('isolation-a@test.dev', 'Shop A', 'SKU-A', 100)
  const b = await createShopWithItem('isolation-b@test.dev', 'Shop B', 'SKU-B', 50)

  const listA = await api(a.token, 'GET', '/api/items')
  assert.equal(listA.status, 200)
  assert.ok(listA.data.items.every((item) => item.id !== b.itemId), 'Shop A can see Shop B items')
  assert.ok(listA.data.items.some((item) => item.id === a.itemId))

  assert.equal((await api(a.token, 'PATCH', `/api/items/${b.itemId}`, { name: 'stolen' })).status, 404)
  assert.equal((await api(a.token, 'POST', `/api/items/${b.itemId}/stock`, { quantity: 10 })).status, 404)
  assert.equal((await api(a.token, 'DELETE', `/api/items/${b.itemId}`)).status, 404)
  assert.equal((await api(a.token, 'PUT', `/api/unit-conversions/${b.itemId}`, { kind: 'bulk' })).status, 404)
  assert.equal((await api(a.token, 'POST', '/api/sales', { items: [{ item_id: b.itemId, quantity: 1 }] })).status, 404)

  const listB = await api(b.token, 'GET', '/api/items')
  const shopBItem = listB.data.items.find((item) => item.id === b.itemId)
  assert.equal(shopBItem.name, 'Shop B item', 'Shop B item was modified by Shop A')
  assert.equal(shopBItem.quantity, 50, 'Shop B stock was modified by Shop A')
})

test('employees are blocked from owner-only endpoints', async () => {
  const owner = await createShopWithItem('staff-owner@test.dev', 'Staff Shop', 'SKU-OWNER', 20)
  const added = await api(owner.token, 'POST', '/api/team', { email: 'employee@test.dev', temporary_password: 'temporary123' })
  assert.equal(added.status, 201, `add employee failed: ${added.text}`)

  const login = await api(null, 'POST', '/api/auth/login', { email: 'employee@test.dev', password: 'temporary123' })
  assert.equal(login.status, 200)
  const employeeToken = login.data.token

  // Temporary-password gate blocks the workspace until it is changed.
  assert.equal((await api(employeeToken, 'GET', '/api/items')).status, 428)
  assert.equal((await api(employeeToken, 'POST', '/api/auth/change-password', { password: 'employeePass123' })).status, 200)

  for (const [method, endpoint] of [
    ['GET', '/api/expenses'],
    ['POST', '/api/expenses'],
    ['GET', '/api/reports'],
    ['GET', '/api/sales'],
    ['GET', '/api/dashboard'],
    ['GET', '/api/team'],
    ['DELETE', `/api/items/${owner.itemId}`],
  ]) {
    const response = await api(employeeToken, method, endpoint, method === 'POST' ? { description: 'x', amount: 1 } : undefined)
    assert.equal(response.status, 403, `${method} ${endpoint} should be owner-only, got ${response.status}`)
  }

  // Employees keep read access to inventory but never receive cost data.
  const inventory = await api(employeeToken, 'GET', '/api/items')
  assert.equal(inventory.status, 200)
  assert.ok(inventory.data.items.every((item) => !('cost' in item)), 'employee response leaked cost')
})

test('admin endpoints require an admin email', async () => {
  const owner = await createShopWithItem('nonadmin@test.dev', 'Plain Shop', 'SKU-PLAIN', 5)
  assert.equal((await api(owner.token, 'GET', '/api/admin/users')).status, 403)
  const admin = await signUp('admin@test.dev')
  assert.equal((await api(admin.token, 'GET', '/api/admin/users')).status, 200)
  assert.equal((await api(admin.token, 'GET', '/api/admin/overview')).status, 200)
})

test('passwords are hashed and never returned', async () => {
  const created = await signUp('hash@test.dev')
  assert.ok(!JSON.stringify(created).includes('password_hash'), 'signup leaked password_hash')
  assert.equal(created.user.password_hash, undefined)
  const login = await api(null, 'POST', '/api/auth/login', { email: 'hash@test.dev', password: 'password123' })
  assert.ok(!login.text.includes('password_hash'), 'login leaked password_hash')
  const me = await api(login.data.token, 'GET', '/api/auth/me')
  assert.ok(!me.text.includes('password_hash'), '/auth/me leaked password_hash')
})

test('weak passwords and out-of-range numbers are rejected', async () => {
  const short = await api(null, 'POST', '/api/auth/signup', { email: 'weak@test.dev', password: 'short', password_confirmation: 'short' })
  assert.equal(short.status, 400)

  const owner = await createShopWithItem('bounds@test.dev', 'Bounds Shop', 'SKU-BOUNDS', 10)
  assert.equal((await api(owner.token, 'POST', '/api/items', { name: 'bad', sku: 'SKU-NEG', quantity: 1, price: -5 })).status, 400)
  assert.equal((await api(owner.token, 'POST', '/api/items', { name: 'bad', sku: 'SKU-HUGE', quantity: 1e13, price: 1 })).status, 400)
  assert.equal((await api(owner.token, 'POST', '/api/items', { name: 'bad', sku: 'SKU-NAN', quantity: 'abc', price: 1 })).status, 400)
  assert.equal((await api(owner.token, 'POST', '/api/expenses', { description: 'x', amount: -1 })).status, 400)
  assert.equal((await api(owner.token, 'POST', '/api/sales', { items: [{ item_id: owner.itemId, quantity: 0 }] })).status, 400)
  assert.equal((await api(owner.token, 'POST', '/api/sales', { items: [{ item_id: owner.itemId, quantity: 999 }] })).status, 409)
})
