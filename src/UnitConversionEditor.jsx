import { Plus, X } from 'lucide-react'
import { defaultUnitFields } from './unitConversionForms.js'

function RatioField({ label, value, onChange, placeholder = 'e.g. 12.5', required = true }) {
  return <label className="field"><span>{label}</span><input type="number" min="0.000001" step="any" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>
}

export default function UnitConversionEditor({ fields, onChange, kindDisabled = false }) {
  const update = (key, value) => onChange({ ...fields, [key]: value })
  const updateEdge = (index, key, value) => update('extraEdges', fields.extraEdges.map((edge, edgeIndex) =>
    edgeIndex === index ? { ...edge, [key]: value } : edge,
  ))

  return <section className="unit-editor">
    <label className="field"><span>Product units</span><select value={fields.kind} disabled={kindDisabled} onChange={(event) => onChange({ ...defaultUnitFields(), ...fields, kind: event.target.value })}><option value="standard">Single unit</option><option value="bulk">Bulk foodstuff</option><option value="packaged">Packaged / sachet</option></select></label>
    {fields.kind === 'bulk' && <div className="unit-editor-body">
      <p className="unit-helper">Suggested Southern Nigerian measures: 1 Paint = 20 Cups; a Bag is usually 12–13 Paints or about 50 kg. Rice is about 4.2 kg per Paint; Garri about 2.8 kg. Adjust these per product.</p>
      <RatioField label="Cups in 1 Paint" value={fields.cupsPerPaint} onChange={(value) => update('cupsPerPaint', value)} />
      <RatioField label="Paints in 1 Bag" value={fields.paintsPerBag} onChange={(value) => update('paintsPerBag', value)} />
      <div className="field-row">
        <RatioField label="Kg in 1 Paint (optional)" value={fields.kgPerPaint} onChange={(value) => update('kgPerPaint', value)} placeholder="Product-specific" required={false} />
        <RatioField label="Kg in 1 Bag (optional)" value={fields.kgPerBag} onChange={(value) => update('kgPerBag', value)} placeholder="e.g. 50" required={false} />
      </div>
      {fields.kgPerPaint !== '' && fields.kgPerBag !== '' && <p className="form-hint">Choose kg per Paint or kg per Bag, not both, to keep the hierarchy consistent.</p>}
    </div>}
    {fields.kind === 'packaged' && <div className="unit-editor-body">
      <p className="unit-helper">Define the pack sizes once. These ratios are saved for this user and product.</p>
      <RatioField label="Sachets in 1 Roll" value={fields.sachetsPerRoll} onChange={(value) => update('sachetsPerRoll', value)} placeholder="e.g. 12" />
      <RatioField label="Rolls in 1 Carton" value={fields.rollsPerCarton} onChange={(value) => update('rollsPerCarton', value)} placeholder="e.g. 24" />
    </div>}
    {fields.kind !== 'standard' && <div className="extra-unit-list"><div className="extra-unit-heading"><span>Optional intermediate units</span><button type="button" className="text-button" onClick={() => update('extraEdges', [...fields.extraEdges, { from: '', to: '', factor: '' }])}><Plus size={14} /> Add unit</button></div>{fields.extraEdges.map((edge, index) => <div className="extra-unit-row" key={index}><label className="field"><span>Unit</span><input value={edge.from} maxLength={40} placeholder="Derica" onChange={(event) => updateEdge(index, 'from', event.target.value)} /></label><label className="field"><span>per 1</span><input value={edge.to} maxLength={40} placeholder="Paint" onChange={(event) => updateEdge(index, 'to', event.target.value)} /></label><label className="field"><span>Quantity</span><input type="number" min="0.000001" step="any" value={edge.factor} placeholder="e.g. 2" onChange={(event) => updateEdge(index, 'factor', event.target.value)} /></label><button type="button" className="icon-button danger-hover" aria-label="Remove intermediate unit" onClick={() => update('extraEdges', fields.extraEdges.filter((_, edgeIndex) => edgeIndex !== index))}><X size={15} /></button></div>)}<p className="unit-footnote">Each row means “Quantity of Unit makes 1 of per 1.” Ratios can be fractional.</p></div>}
  </section>
}
