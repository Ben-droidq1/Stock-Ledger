const unitKey = (unit) => String(unit || '').trim().toLocaleLowerCase()

export function validateUnitEdges(edges, baseUnit) {
  if (!Array.isArray(edges) || edges.length === 0 || edges.length > 20) {
    throw new Error('Add at least one conversion ratio')
  }

  const parent = new Map()
  const find = (unit) => {
    if (!parent.has(unit)) parent.set(unit, unit)
    if (parent.get(unit) !== unit) parent.set(unit, find(parent.get(unit)))
    return parent.get(unit)
  }
  const normalized = edges.map((edge) => {
    const from = String(edge.from || '').trim()
    const to = String(edge.to || '').trim()
    const factor = Number(edge.factor)
    const fromKey = unitKey(from)
    const toKey = unitKey(to)
    if (!from || !to || from.length > 40 || to.length > 40 || !fromKey || !toKey || fromKey === toKey) {
      throw new Error('Conversion units must be distinct names up to 40 characters')
    }
    if (!Number.isFinite(factor) || factor <= 0 || factor > 1_000_000) {
      throw new Error('Conversion ratios must be positive finite numbers')
    }
    if (find(fromKey) === find(toKey)) throw new Error('Conversion units must form a hierarchy without loops')
    parent.set(find(fromKey), find(toKey))
    return { from, to, factor }
  })

  const baseKey = unitKey(baseUnit)
  if (!baseKey || !parent.has(baseKey)) throw new Error('The base unit must be part of the conversion hierarchy')
  const root = find(baseKey)
  if ([...parent.keys()].some((unit) => find(unit) !== root)) {
    throw new Error('All conversion units must connect to the base unit')
  }
  return normalized
}

export function convertQuantity(quantity, from, to, edges) {
  const amount = Number(quantity)
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Quantity must be a non-negative number')
  const fromKey = unitKey(from)
  const toKey = unitKey(to)
  if (!fromKey || !toKey) throw new Error('Choose a source and target unit')
  if (fromKey === toKey) return amount

  const graph = new Map()
  const connect = (source, target, factor) => {
    if (!graph.has(source)) graph.set(source, [])
    graph.get(source).push({ unit: target, factor })
  }
  for (const edge of edges) {
    const source = unitKey(edge.from)
    const target = unitKey(edge.to)
    const factor = Number(edge.factor)
    if (!source || !target || !Number.isFinite(factor) || factor <= 0) {
      throw new Error('Conversion hierarchy contains an invalid ratio')
    }
    connect(source, target, factor)
    connect(target, source, 1 / factor)
  }

  const queue = [{ unit: fromKey, factor: 1 }]
  const visited = new Set([fromKey])
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    for (const next of graph.get(current.unit) || []) {
      if (visited.has(next.unit)) continue
      const factor = current.factor * next.factor
      if (next.unit === toKey) return amount * factor
      visited.add(next.unit)
      queue.push({ unit: next.unit, factor })
    }
  }
  throw new Error(`No conversion path from ${from} to ${to}`)
}

export function defaultBulkRatios(productName = '') {
  const name = productName.toLocaleLowerCase()
  const kgPerPaint = name.includes('garri') || name.includes('gari')
    ? 2.8
    : name.includes('rice')
      ? 4.2
      : ''
  return { cupsPerPaint: 20, paintsPerBag: 12.5, kgPerPaint }
}
