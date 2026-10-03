import { defaultBulkRatios } from './unitConversions.js'

export const defaultUnitFields = (productName = '') => {
  const bulk = defaultBulkRatios(productName)
  return {
    kind: 'standard',
    cupsPerPaint: String(bulk.cupsPerPaint),
    paintsPerBag: String(bulk.paintsPerBag),
    kgPerPaint: bulk.kgPerPaint === '' ? '' : String(bulk.kgPerPaint),
    kgPerBag: '',
    sachetsPerRoll: '',
    rollsPerCarton: '',
    extraEdges: [],
  }
}

export function fieldsFromProfile(profile, productName = '') {
  const fields = defaultUnitFields(productName)
  if (!profile) return fields
  const edgeFactor = (from, to) => profile.edges.find((edge) =>
    edge.from.toLocaleLowerCase() === from && edge.to.toLocaleLowerCase() === to,
  )?.factor ?? ''
  const corePairs = profile.kind === 'packaged'
    ? new Set(['roll>sachet', 'carton>roll'])
    : new Set(['paint>cup', 'bag>paint', 'paint>kg', 'bag>kg'])
  return {
    ...fields,
    kind: profile.kind,
    cupsPerPaint: edgeFactor('paint', 'cup') || fields.cupsPerPaint,
    paintsPerBag: edgeFactor('bag', 'paint') || fields.paintsPerBag,
    kgPerPaint: edgeFactor('paint', 'kg'),
    kgPerBag: edgeFactor('bag', 'kg'),
    sachetsPerRoll: edgeFactor('roll', 'sachet'),
    rollsPerCarton: edgeFactor('carton', 'roll'),
    extraEdges: profile.edges.filter((edge) => !corePairs.has(`${edge.from.toLocaleLowerCase()}>${edge.to.toLocaleLowerCase()}`))
      .map((edge) => ({ from: edge.to, to: edge.from, factor: edge.factor })),
  }
}

export function buildUnitProfile(fields) {
  if (fields.kind === 'packaged') {
    return {
      kind: 'packaged',
      base_unit: 'sachet',
      primary_unit: 'carton',
      edges: [
        { from: 'roll', to: 'sachet', factor: Number(fields.sachetsPerRoll) },
        { from: 'carton', to: 'roll', factor: Number(fields.rollsPerCarton) },
        ...fields.extraEdges.filter((edge) => edge.from.trim() && edge.to.trim() && edge.factor !== '')
          .map((edge) => ({ from: edge.to, to: edge.from, factor: Number(edge.factor) })),
      ],
    }
  }
  if (fields.kind === 'bulk') {
    const edges = [
      { from: 'paint', to: 'cup', factor: Number(fields.cupsPerPaint) },
      { from: 'bag', to: 'paint', factor: Number(fields.paintsPerBag) },
    ]
    if (fields.kgPerPaint !== '') edges.push({ from: 'paint', to: 'kg', factor: Number(fields.kgPerPaint) })
    else if (fields.kgPerBag !== '') edges.push({ from: 'bag', to: 'kg', factor: Number(fields.kgPerBag) })
    edges.push(...fields.extraEdges.filter((edge) => edge.from.trim() && edge.to.trim() && edge.factor !== '')
      .map((edge) => ({ from: edge.to, to: edge.from, factor: Number(edge.factor) })))
    return { kind: 'bulk', base_unit: 'cup', primary_unit: 'paint', edges }
  }
  return null
}