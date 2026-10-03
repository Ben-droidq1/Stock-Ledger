import assert from 'node:assert/strict'
import test from 'node:test'
import { convertQuantity, defaultBulkRatios, validateUnitEdges } from '../src/unitConversions.js'

test('converts fractional packaged quantities in either direction', () => {
  const edges = validateUnitEdges([
    { from: 'roll', to: 'sachet', factor: 12 },
    { from: 'carton', to: 'roll', factor: 24 },
  ], 'sachet')

  assert.equal(convertQuantity(1.5, 'carton', 'sachet', edges), 432)
  assert.equal(convertQuantity(288, 'sachet', 'carton', edges), 1)
  assert.equal(convertQuantity(0.5, 'roll', 'sachet', edges), 6)
})

test('converts bulk measures across optional kilogram edges', () => {
  const edges = validateUnitEdges([
    { from: 'paint', to: 'cup', factor: 20 },
    { from: 'bag', to: 'paint', factor: 12.5 },
    { from: 'paint', to: 'kg', factor: 4.2 },
  ], 'cup')

  assert.equal(convertQuantity(0.5, 'bag', 'cup', edges), 125)
  assert.equal(convertQuantity(4.2, 'kg', 'paint', edges), 1)
})

test('suggests Southern Nigerian defaults by product', () => {
  assert.deepEqual(defaultBulkRatios('Rice'), { cupsPerPaint: 20, paintsPerBag: 12.5, kgPerPaint: 4.2 })
  assert.deepEqual(defaultBulkRatios('Garri'), { cupsPerPaint: 20, paintsPerBag: 12.5, kgPerPaint: 2.8 })
  assert.deepEqual(defaultBulkRatios('Beans'), { cupsPerPaint: 20, paintsPerBag: 12.5, kgPerPaint: '' })
})

test('rejects cyclic and disconnected unit hierarchies', () => {
  assert.throws(() => validateUnitEdges([
    { from: 'sachet', to: 'roll', factor: 12 },
    { from: 'roll', to: 'carton', factor: 24 },
    { from: 'carton', to: 'sachet', factor: 1 },
  ], 'sachet'), /without loops/)
  assert.throws(() => validateUnitEdges([
    { from: 'sachet', to: 'roll', factor: 12 },
    { from: 'piece', to: 'box', factor: 10 },
  ], 'sachet'), /connect to the base unit/)
})
