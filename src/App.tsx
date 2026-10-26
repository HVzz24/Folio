import { Fragment, useEffect, useRef, useState } from 'react'
import {
  AlignCenter, AlignJustify, AlignLeft, ArrowDown, ArrowDownToLine, ArrowUp, Check,
  ChevronDown, ChevronRight, Eye, EyeOff, FileJson2, FileText, GripVertical,
  LayoutGrid, Maximize2, Minus, Moon, Plus, Printer, RotateCcw, Settings2, Sparkles, Sun,
  Trash2, Type, Upload, X,
} from 'lucide-react'
import { downloadJson } from './lib/storage'
import { analyzeResume, type AtsAnalysis } from './lib/atsAnalysis'
import { formatResumeDate, toMonthInputValue } from './lib/dates'
import { resumeSchema, type ResumeItem, type ResumeSection } from './types/resume'
import { useResumeStore } from './store/resumeStore'

const FIELD_LABELS: Record<string, string> = {
  institution: 'Institution', location: 'Location', degree: 'Degree',
  grade: 'GPA / grade', start: 'Start date', end: 'End date', description: 'Description',
  company: 'Company', position: 'Position', name: 'Project name', category: 'Category',
}

function Field({ label, value, onChange, multiline = false, placeholder = '' }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string
}) {
  return (
    <label className={`field ${multiline ? 'field-wide' : ''}`}>
      <span>{label}</span>
      {multiline
        ? <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} rows={3} />
        : <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
    </label>
  )
}

function DatePickerField({ label, value, onChange }: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const monthValue = toMonthInputValue(value)
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="month"
        aria-label={label}
        value={monthValue}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && !monthValue && <small className="date-legacy-note">Saved value: {value}. Choose a month to replace it.</small>}
    </label>
  )
}

function MiniButton({ title, onClick, children, danger = false, disabled = false }: {
  title: string; onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean
}) {
  return <button className={`icon-button ${danger ? 'danger' : ''}`} type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}>{children}</button>
}

function getContactHref(kind: 'email' | 'phone' | 'location' | 'linkedin' | 'portfolio', value: string): string | undefined {
  if (kind === 'email') return `mailto:${value.trim()}`
  if (kind === 'phone') {
    const phone = value.trim().replace(/[^\d+]/g, '')
    return phone ? `tel:${phone}` : undefined
  }
  if (kind === 'linkedin' || kind === 'portfolio') {
    const address = value.trim()
    if (!address) return undefined
    const candidate = /^[a-z][a-z\d+.-]*:/i.test(address) ? address : `https://${address}`
    try {
      const url = new URL(candidate)
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

function EntryEditor({ section, item, index }: { section: ResumeSection; item: ResumeItem; index: number }) {
  const { updateItem, deleteItem, moveItem, addBullet, updateBullet, deleteBullet, moveBullet } = useResumeStore()
  const { start = '', end = '', ...regularFields } = item.fields
  const hasDates = Object.hasOwn(item.fields, 'start') || Object.hasOwn(item.fields, 'end')
  const isCurrent = end.toLowerCase() === 'present'
  const supportsDetails = section.type === 'custom'

  function updateDates(updates: { start?: string; end?: string }) {
    updateItem(section.id, item.id, { fields: { ...item.fields, ...updates } })
  }

  function removeDates() {
    const fields = { ...item.fields }
    delete fields.start
    delete fields.end
    updateItem(section.id, item.id, { fields })
  }

  return (
    <div className="entry-card">
      <div className="entry-topline">
        <span className="entry-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="entry-title">{item.fields.position || item.fields.degree || item.fields.name || 'New entry'}</span>
        <MiniButton title="Move up" disabled={index === 0} onClick={() => moveItem(section.id, item.id, -1)}><ArrowUp size={14} /></MiniButton>
        <MiniButton title="Move down" disabled={index === section.items.length - 1} onClick={() => moveItem(section.id, item.id, 1)}><ArrowDown size={14} /></MiniButton>
        <MiniButton title="Delete entry" danger onClick={() => deleteItem(section.id, item.id)}><Trash2 size={14} /></MiniButton>
      </div>
      <div className="form-grid">
        {Object.entries(regularFields).map(([key, value]) => (
          <Field
            key={key}
            label={FIELD_LABELS[key] ?? key}
            value={value}
            multiline={key === 'description'}
            onChange={(next) => updateItem(section.id, item.id, { fields: { ...item.fields, [key]: next } })}
          />
        ))}
        {supportsDetails && <div className="field-wide">
          <div className="subsection-title"><span>Custom details</span><button className="text-action" type="button" onClick={() => updateItem(section.id, item.id, {
            details: [...item.details, { id: crypto.randomUUID(), label: '', content: '' }],
          })}><Plus size={13} /> Add detail</button></div>
          {item.details.map((detail) => (
            <div className="form-grid" key={detail.id}>
              <Field
                label="Detail title (optional)"
                value={detail.label}
                placeholder="e.g. Technologies, Tools, or Role"
                onChange={(value) => updateItem(section.id, item.id, {
                  details: item.details.map((entry) => entry.id === detail.id ? { ...entry, label: value } : entry),
                })}
              />
              <Field
                label="Detail content"
                value={detail.content}
                multiline
                onChange={(value) => updateItem(section.id, item.id, {
                  details: item.details.map((entry) => entry.id === detail.id ? { ...entry, content: value } : entry),
                })}
              />
              <MiniButton title="Remove detail" danger onClick={() => updateItem(section.id, item.id, {
                details: item.details.filter((entry) => entry.id !== detail.id),
              })}><X size={13} /></MiniButton>
            </div>
          ))}
        </div>}
        {hasDates && <>
          <DatePickerField label="Start date" value={start} onChange={(value) => updateDates({ start: value })} />
          {!isCurrent && <DatePickerField label="End date" value={end} onChange={(value) => updateDates({ end: value })} />}
          <label className="current-date-toggle">
            <input type="checkbox" checked={isCurrent} onChange={(event) => updateDates({ end: event.target.checked ? 'Present' : '' })} />
            <span>Ongoing / present</span>
          </label>
        </>}
      </div>
      <div className="entry-date-actions">
        {hasDates
          ? <button className="text-action" type="button" onClick={removeDates}><X size={13} /> Remove dates</button>
          : <button className="text-action" type="button" onClick={() => updateDates({ start: '', end: '' })}><Plus size={13} /> Add date range</button>}
      </div>
      <div className="bullet-editor">
        <div className="subsection-title"><span>Bullet points</span><button className="text-action" onClick={() => addBullet(section.id, item.id)}><Plus size={13} /> Add bullet</button></div>
        {item.bullets.map((bullet, bulletIndex) => (
          <div className="bullet-edit-row" key={`${item.id}-${bulletIndex}`}>
            <span className="bullet-dot">•</span>
            <input value={bullet} placeholder="Describe an impact or achievement" onChange={(event) => updateBullet(section.id, item.id, bulletIndex, event.target.value)} />
            <MiniButton title="Move bullet up" disabled={bulletIndex === 0} onClick={() => moveBullet(section.id, item.id, bulletIndex, -1)}><ArrowUp size={13} /></MiniButton>
            <MiniButton title="Move bullet down" disabled={bulletIndex === item.bullets.length - 1} onClick={() => moveBullet(section.id, item.id, bulletIndex, 1)}><ArrowDown size={13} /></MiniButton>
            <MiniButton title="Remove bullet" danger onClick={() => deleteBullet(section.id, item.id, bulletIndex)}><X size={13} /></MiniButton>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListSectionEditor({ section }: { section: ResumeSection }) {
  const { updateSubsection, addSubsection, deleteSubsection, moveSubsection, addListItem, updateListItem, deleteListItem, moveListItem } = useResumeStore()
  return (
    <div className="subsections">
      {section.subsections.map((subsection, index) => (
        <div className="subsection-editor" key={subsection.id}>
          <div className="subsection-heading-edit">
            <input aria-label="Subsection heading" value={subsection.heading} onChange={(event) => updateSubsection(section.id, subsection.id, { heading: event.target.value })} />
            <MiniButton title="Move subsection up" disabled={index === 0} onClick={() => moveSubsection(section.id, subsection.id, -1)}><ArrowUp size={13} /></MiniButton>
            <MiniButton title="Move subsection down" disabled={index === section.subsections.length - 1} onClick={() => moveSubsection(section.id, subsection.id, 1)}><ArrowDown size={13} /></MiniButton>
            <MiniButton title="Delete subsection" danger onClick={() => deleteSubsection(section.id, subsection.id)}><Trash2 size={14} /></MiniButton>
          </div>
          {subsection.items.map((item, index) => (
            <div className="list-edit-row" key={`${subsection.id}-${index}`}>
              <span className="bullet-dot">•</span>
              <input value={item} placeholder="Add information" onChange={(event) => updateListItem(section.id, subsection.id, index, event.target.value)} />
              <MiniButton title="Move up" disabled={index === 0} onClick={() => moveListItem(section.id, subsection.id, index, -1)}><ArrowUp size={13} /></MiniButton>
              <MiniButton title="Move down" disabled={index === subsection.items.length - 1} onClick={() => moveListItem(section.id, subsection.id, index, 1)}><ArrowDown size={13} /></MiniButton>
              <MiniButton title="Remove item" danger onClick={() => deleteListItem(section.id, subsection.id, index)}><X size={13} /></MiniButton>
            </div>
          ))}
          <button className="text-action add-list-item" onClick={() => addListItem(section.id, subsection.id)}><Plus size={13} /> Add item</button>
        </div>
      ))}
      <button className="outline-action" onClick={() => addSubsection(section.id)}><Plus size={14} /> Add subsection</button>
    </div>
  )
}

function ContentSidebar({ active, setActive, dragId, setDragId }: {
  active: string; setActive: (id: string) => void; dragId: string | null; setDragId: (id: string | null) => void
}) {
  const resume = useResumeStore((state) => state.resume)
  const store = useResumeStore()
  const [newHeading, setNewHeading] = useState('')
  const profile = resume.profile

  function moveDropped(targetId: string) {
    if (dragId && dragId !== targetId) store.moveSection(dragId, targetId)
    setDragId(null)
  }

  function toggleSection(section: ResumeSection) {
    const enabled = !section.enabled
    store.updateSection(section.id, { enabled })
    if (section.type === 'summary') store.updateProfile('summaryEnabled', enabled)
  }

  return (
    <aside className="content-sidebar">
      <div className="sidebar-heading">
        <div><span className="eyebrow">YOUR DOCUMENT</span><h2>Content</h2></div>
        <span className="saved-pill"><Check size={12} /> Saved locally</span>
      </div>
      <div className="accordion-list">
        <section className={`accordion ${active === 'profile' ? 'open' : ''}`}>
          <button className="accordion-trigger" onClick={() => setActive(active === 'profile' ? '' : 'profile')}>
            <span className="accordion-icon"><Sparkles size={16} /></span><span className="accordion-name">Personal profile<small>Name, contact & summary</small></span>
            {active === 'profile' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {active === 'profile' && <div className="accordion-content">
            <div className="form-grid">
              <Field label="Full name" value={profile.name} onChange={(value) => store.updateProfile('name', value)} />
              <Field label="Professional title" value={profile.title} onChange={(value) => store.updateProfile('title', value)} />
              <Field label="Email" value={profile.email} onChange={(value) => store.updateProfile('email', value)} />
              <Field label="Phone" value={profile.phone} onChange={(value) => store.updateProfile('phone', value)} />
              <Field label="Location" value={profile.location} onChange={(value) => store.updateProfile('location', value)} />
              <Field label="LinkedIn" value={profile.linkedin} onChange={(value) => store.updateProfile('linkedin', value)} />
              <Field label="Portfolio" value={profile.portfolio} onChange={(value) => store.updateProfile('portfolio', value)} />
              <label className="summary-toggle">
                <span><strong>Clickable hyperlinks</strong><small>Link email, phone, LinkedIn & portfolio</small></span>
                <input
                  type="checkbox"
                  checked={profile.hyperlinksEnabled}
                  onChange={(event) => store.updateProfile('hyperlinksEnabled', event.target.checked)}
                />
              </label>
              <label className="field field-wide"><span>Profile photo (optional)</span><input type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => store.updateProfile('photo', String(reader.result ?? ''))
                reader.onerror = () => window.alert('The selected image could not be read.')
                reader.readAsDataURL(file)
              }} /></label>
              {profile.photo && <button className="text-action" onClick={() => store.updateProfile('photo', '')}><X size={13} /> Remove photo</button>}
            </div>
          </div>}
        </section>
        <div className="section-list-heading"><span>RESUME SECTIONS</span><span className="drag-hint"><GripVertical size={13} /> Drag to reorder</span></div>
        {resume.sections.map((section, index) => (
          <section
            className={`accordion section-accordion ${active === section.id ? 'open' : ''}`}
            key={section.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => moveDropped(section.id)}
          >
            <div className="section-trigger-row">
              <span
                className="drag-handle"
                title="Drag to reorder"
                draggable
                onDragStart={(event) => {
                  event.stopPropagation()
                  setDragId(section.id)
                }}
                onDragEnd={() => setDragId(null)}
              ><GripVertical size={15} /></span>
              <button className="accordion-trigger section-trigger" onClick={() => setActive(active === section.id ? '' : section.id)}>
                <span className="accordion-name">{section.heading || 'Untitled section'}<small>{section.type === 'summary' ? 'Summary statement' : `${section.items.length} entries`}</small></span>
                {active === section.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <MiniButton title={section.enabled ? 'Hide section' : 'Show section'} onClick={() => toggleSection(section)}>{section.enabled ? <Eye size={15} /> : <EyeOff size={15} />}</MiniButton>
            </div>
            {active === section.id && <div className="accordion-content section-content">
              {section.type === 'summary'
                ? <>
                  <Field label="Summary content" value={profile.summary} multiline onChange={(value) => store.updateProfile('summary', value)} />
                  <div className="count-row"><span>{profile.summary.length} characters</span><span>{profile.summary.trim() ? profile.summary.trim().split(/\s+/).length : 0} words</span></div>
                </>
                : <>
                  {section.type === 'custom' && <Field label="Section heading" value={section.heading} onChange={(value) => store.updateSection(section.id, { heading: value })} />}
                  {section.items.map((item, itemIndex) => <EntryEditor key={item.id} section={section} item={item} index={itemIndex} />)}
                  <button className="outline-action" onClick={() => store.addItem(section.id)}><Plus size={14} /> Add {section.type === 'education' ? 'education' : section.type === 'experience' ? 'position' : 'entry'}</button>
                  <div className="subsections"><ListSectionEditor section={section} /></div>
                </>}
              {section.type === 'custom' && section.items.length === 0 && <p className="helper-copy">Start with an entry or create titled subsections and list items.</p>}
              {section.type === 'custom' && <button className="remove-section" onClick={() => store.deleteSection(section.id)}><Trash2 size={14} /> Delete section</button>}
            </div>}
            {index !== resume.sections.length - 1 && <div className="section-separator" />}
          </section>
        ))}
        <form className="add-section-form" onSubmit={(event) => {
          event.preventDefault()
          if (newHeading.trim()) {
            store.addSection(newHeading.trim())
            setNewHeading('')
          }
        }}>
          <input value={newHeading} onChange={(event) => setNewHeading(event.target.value)} placeholder="Create a custom section" aria-label="Custom section heading" />
          <button aria-label="Add section" type="submit"><Plus size={16} /></button>
        </form>
      </div>
    </aside>
  )
}

function ResumePreview({ zoom, containerRef }: { zoom: number; containerRef?: React.RefObject<HTMLDivElement | null> }) {
  const resume = useResumeStore((state) => state.resume)
  const { profile, settings } = resume
  const contactValues: { kind: 'email' | 'phone' | 'location' | 'linkedin' | 'portfolio'; value: string }[] = [
    { kind: 'email', value: profile.email },
    { kind: 'phone', value: profile.phone },
    { kind: 'location', value: profile.location },
    { kind: 'linkedin', value: profile.linkedin },
    { kind: 'portfolio', value: profile.portfolio },
  ]
  const contacts = contactValues.filter((contact) => contact.value.trim())
  const style = {
    '--font-family': settings.fontFamily,
    '--name-size': `${settings.nameFontSize}pt`,
    '--title-size': `${settings.titleFontSize}pt`,
    '--heading-size': `${settings.headingFontSize}pt`,
    '--subheading-size': `${settings.subheadingFontSize}pt`,
    '--body-size': `${settings.bodyFontSize}pt`,
    '--contact-size': `${settings.contactFontSize}pt`,
    '--line-height': settings.lineHeight,
    '--letter-spacing': `${settings.letterSpacing}px`,
    '--margin-top': `${settings.marginTop}mm`,
    '--margin-bottom': `${settings.marginBottom}mm`,
    '--margin-side': `${settings.marginSide}mm`,
    '--section-spacing': `${settings.sectionSpacing}px`,
    '--bullet-spacing': `${settings.bulletSpacing}px`,
    '--paragraph-spacing': `${settings.paragraphSpacing}px`,
    '--divider-thickness': `${settings.dividerThickness}px`,
    '--paper-width': settings.pageSize === 'A4' ? '210mm' : '8.5in',
    '--paper-height': settings.pageSize === 'A4' ? '297mm' : '11in',
    '--document-alignment': settings.alignment,
    '--body-weight': settings.fontWeight,
  } as React.CSSProperties

  return (
    <div className="preview-scroll" ref={containerRef}>
      <div className="paper-scale" style={{ transform: `scale(${zoom / 100})` }}>
        <article className={`resume-paper ${settings.showDivider ? '' : 'no-dividers'}`} style={style}>
          <header className={`resume-header ${profile.photo ? 'has-photo' : ''}`}>
            {profile.photo && <img className="resume-photo" src={profile.photo} alt="" />}
            <div className="resume-header-copy">
              {profile.name && <h1>{profile.name}</h1>}
              {profile.title && <p className="resume-title">{profile.title}</p>}
              {contacts.length > 0 && <div className="resume-contact">{contacts.map(({ kind, value }, index) => {
                const href = profile.hyperlinksEnabled ? getContactHref(kind, value) : undefined
                return <Fragment key={kind}>
                  {index > 0 && <span className="contact-separator"> | </span>}
                  <span>{href
                    ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{value}</a>
                    : value}</span>
                </Fragment>
              })}</div>}
            </div>
          </header>
          <div className={`resume-body ${settings.layout === 'two' ? 'two-column' : ''}`}>
          {resume.sections.filter((section) => section.enabled).map((section) => section.type === 'summary' ? (
            <section className="resume-section" key={section.id}>
              {section.heading && <h2>{section.heading}</h2>}
              {profile.summary.trim() && <p>{profile.summary}</p>}
            </section>
          ) : (
            <section className="resume-section" key={section.id}>
              {section.heading && <h2>{section.heading}</h2>}
              {section.subsections.map((subsection) => (
                <div className="resume-subsection" key={subsection.id}>
                  {subsection.heading && <h3>{subsection.heading}</h3>}
                  {subsection.items.length > 0 && <ul>{subsection.items.filter(Boolean).map((item, index) => (
                    <li key={`${subsection.id}-${index}`}>
                      <span className="bullet-prefix" aria-hidden="true">- </span>
                      {item}
                    </li>
                  ))}</ul>}
                </div>
              ))}
              {section.items.map((item) => {
                const title = section.type === 'education'
                  ? item.fields.institution
                  : section.type === 'experience'
                    ? item.fields.company
                    : item.fields.name || item.fields.position || item.fields.degree || item.fields.company
                const subheading = section.type === 'education'
                  ? [item.fields.degree, item.fields.grade ? `GPA: ${item.fields.grade.replace(/^GPA\s*/i, '')}` : ''].filter(Boolean).join(' | ')
                  : section.type === 'experience'
                    ? item.fields.position
                    : item.fields.category
                const date = [item.fields.start, item.fields.end].filter(Boolean).map(formatResumeDate).join(' – ')
                const details = Object.entries(item.fields).filter(([key, value]) =>
                  value && !['position', 'degree', 'name', 'company', 'institution', 'category', 'start', 'end', 'location', 'grade', 'technologies', 'technologiesLabel'].includes(key),
                )
                return (
                  <div className={`resume-entry ${section.type === 'education' ? 'education-entry' : ''} ${section.type === 'experience' ? 'experience-entry' : ''}`} key={item.id}>
                    <div className="resume-entry-head">
                      <div className="resume-entry-title"><strong>{title}</strong></div>
                      {date && <span className="resume-date"><span className="resume-print-separator"> | </span>{date}</span>}
                    </div>
                    {(subheading || item.fields.location) && (
                      <div className="resume-entry-meta">
                        <span>{subheading}</span>
                        {subheading && item.fields.location && <span className="resume-print-separator"> | </span>}
                        {item.fields.location && <span>{item.fields.location}</span>}
                      </div>
                    )}
                    {details.filter(([key]) => key !== 'description').length > 0 && (
                      <p className="resume-detail">{details.filter(([key]) => key !== 'description').map(([, value]) => value).join(' · ')}</p>
                    )}
                    {item.fields.description && <p className="resume-detail">{item.fields.description}</p>}
                    {item.details.filter((detail) => detail.content).map((detail) => (
                      <p className="resume-detail" key={detail.id}>{detail.label.trim() && <><strong>{detail.label.trim()}:</strong> </>}{detail.content}</p>
                    ))}
                    {item.bullets.filter(Boolean).length > 0 && <ul>{item.bullets.filter(Boolean).map((bullet, index) => <li key={`${item.id}-${index}`}><span className="bullet-prefix" aria-hidden="true">- </span>{bullet}</li>)}</ul>}
                  </div>
                )
              })}
            </section>
          ))}
          </div>
        </article>
      </div>
    </div>
  )
}

const TYPE_SETTINGS: { key: 'nameFontSize' | 'titleFontSize' | 'headingFontSize' | 'subheadingFontSize' | 'bodyFontSize' | 'contactFontSize'; label: string; min: number; max: number }[] = [
  { key: 'nameFontSize', label: 'Name', min: 16, max: 42 },
  { key: 'titleFontSize', label: 'Professional title', min: 8, max: 20 },
  { key: 'headingFontSize', label: 'Section heading', min: 8, max: 20 },
  { key: 'subheadingFontSize', label: 'Subheading', min: 8, max: 18 },
  { key: 'bodyFontSize', label: 'Body text', min: 7, max: 16 },
  { key: 'contactFontSize', label: 'Contact information', min: 7, max: 14 },
]

function NumberSetting({ label, value, min, max, step = 1, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; unit?: string
}) {
  return (
    <label className="setting-number">
      <span>{label}</span>
      <div className="number-control"><input type="number" min={min} max={max} step={step} value={value} onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
      }} /><small>{unit}</small></div>
      <input className="range-input" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function DesignSidebar({ zoom, setZoom, className = '' }: { zoom: number; setZoom: (zoom: number) => void; className?: string }) {
  const { settings } = useResumeStore((state) => state.resume)
  const update = useResumeStore((state) => state.updateSettings)
  const [tab, setTab] = useState<'type' | 'layout'>('type')
  return (
    <aside className={`design-sidebar ${className}`}>
      <div className="sidebar-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h2>Design</h2></div><Settings2 size={17} className="muted-icon" /></div>
      <div className="settings-tabs">
        <button className={tab === 'type' ? 'selected' : ''} onClick={() => setTab('type')}><Type size={14} /> Type</button>
        <button className={tab === 'layout' ? 'selected' : ''} onClick={() => setTab('layout')}><LayoutGrid size={14} /> Layout</button>
      </div>
      {tab === 'type' ? <div className="settings-content">
        <div className="setting-group">
          <div className="setting-group-heading"><Type size={15} /><strong>Typography</strong></div>
          <label className="select-setting"><span>Font family</span><select value={settings.fontFamily} onChange={(event) => update('fontFamily', event.target.value)}>
            {['Arial', 'Calibri', 'Carlito', 'Inter', 'Roboto', 'Lato', 'Times New Roman', 'Georgia'].map((font) => <option key={font}>{font}</option>)}
          </select></label>
          <label className="select-setting"><span>Font weight</span><select value={settings.fontWeight} onChange={(event) => update('fontWeight', event.target.value)}>
            <option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option>
          </select></label>
          {TYPE_SETTINGS.map((setting) => <NumberSetting key={setting.key} label={setting.label} value={settings[setting.key]} min={setting.min} max={setting.max} step={0.5} unit="pt" onChange={(value) => update(setting.key, value)} />)}
          <NumberSetting label="Line height" value={settings.lineHeight} min={1} max={2} step={0.05} onChange={(value) => update('lineHeight', value)} unit="×" />
          <NumberSetting label="Letter spacing" value={settings.letterSpacing} min={-0.5} max={2} step={0.1} onChange={(value) => update('letterSpacing', value)} unit="px" />
        </div>
        <div className="setting-group">
          <div className="setting-group-heading"><AlignLeft size={15} /><strong>Alignment</strong></div>
          <div className="segmented alignment-options">
            <button className={settings.alignment === 'left' ? 'active' : ''} aria-pressed={settings.alignment === 'left'} onClick={() => update('alignment', 'left')}><AlignLeft size={15} /> Left</button>
            <button className={settings.alignment === 'justify' ? 'active' : ''} aria-pressed={settings.alignment === 'justify'} onClick={() => update('alignment', 'justify')}><AlignJustify size={15} /> Justify</button>
            <button className={settings.alignment === 'center' ? 'active' : ''} aria-pressed={settings.alignment === 'center'} onClick={() => update('alignment', 'center')}><AlignCenter size={15} /> Center</button>
          </div>
        </div>
      </div> : <div className="settings-content">
        <div className="setting-group">
          <div className="setting-group-heading"><LayoutGrid size={15} /><strong>Page & layout</strong></div>
          <label className="select-setting"><span>Paper size</span><select value={settings.pageSize} onChange={(event) => update('pageSize', event.target.value)}><option>A4</option><option>Letter</option></select></label>
          <label className="select-setting"><span>Columns</span><select value={settings.layout} onChange={(event) => update('layout', event.target.value)}><option value="single">Single column · ATS friendly</option><option value="two">Two columns</option></select></label>
          <NumberSetting label="Top margin" value={settings.marginTop} min={5} max={35} onChange={(value) => update('marginTop', value)} unit="mm" />
          <NumberSetting label="Bottom margin" value={settings.marginBottom} min={5} max={35} onChange={(value) => update('marginBottom', value)} unit="mm" />
          <NumberSetting label="Side margins" value={settings.marginSide} min={5} max={35} onChange={(value) => update('marginSide', value)} unit="mm" />
        </div>
        <div className="setting-group">
          <div className="setting-group-heading"><Minus size={15} /><strong>Spacing & details</strong></div>
          <NumberSetting label="Section spacing" value={settings.sectionSpacing} min={2} max={32} onChange={(value) => update('sectionSpacing', value)} unit="px" />
          <NumberSetting label="Bullet spacing" value={settings.bulletSpacing} min={0} max={12} onChange={(value) => update('bulletSpacing', value)} unit="px" />
          <NumberSetting label="Paragraph spacing" value={settings.paragraphSpacing} min={0} max={16} onChange={(value) => update('paragraphSpacing', value)} unit="px" />
          <NumberSetting label="Divider thickness" value={settings.dividerThickness} min={0.2} max={2} step={0.1} onChange={(value) => update('dividerThickness', value)} unit="px" />
          <label className="toggle-setting"><span>Section dividers</span><input type="checkbox" checked={settings.showDivider} onChange={(event) => update('showDivider', event.target.checked)} /></label>
        </div>
        <div className="setting-group">
          <div className="setting-group-heading"><Eye size={15} /><strong>Preview zoom</strong></div>
          <NumberSetting label="Zoom" value={zoom} min={50} max={120} onChange={setZoom} unit="%" />
        </div>
      </div>}
      <div className="privacy-note"><span className="privacy-dot" /><div><strong>Your CV stays yours</strong><p>Saved only in this browser on this device.</p></div></div>
    </aside>
  )
}

function AtsAnalysisModal({ resume, onClose }: { resume: ReturnType<typeof useResumeStore.getState>['resume']; onClose: () => void }) {
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [analysis, setAnalysis] = useState<AtsAnalysis | null>(null)
  const canAnalyze = Boolean(jobDescription.trim())

  function runAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canAnalyze) return
    setAnalysis(analyzeResume(resume, jobTitle, jobDescription))
  }

  return (
    <div className="modal-backdrop no-print ats-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="ats-modal" role="dialog" aria-modal="true" aria-labelledby="ats-title">
        <header className="ats-modal-header">
          <div><span className="eyebrow">PRIVATE · LOCAL ANALYSIS</span><h2 id="ats-title">ATS match analysis</h2></div>
          <button className="icon-button" type="button" aria-label="Close analysis" onClick={onClose}><X size={17} /></button>
        </header>
        <p className="ats-intro">Compare your current CV with a job description. This transparent, rule-based estimate runs in your browser; it is not an employer’s actual ATS score.</p>
        <form className="ats-form" onSubmit={runAnalysis}>
          <label className="field"><span>Job title <small>Optional</small></span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Business Analyst" /></label>
          <label className="field"><span>Job description</span><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={8} required placeholder="Paste the full job description here…" /></label>
          <div className="ats-form-footer">
            <span>Job description stays in memory only. Re-run after CV edits to refresh the score.</span>
            <button className="export-button" type="submit" disabled={!canAnalyze}><Sparkles size={15} /> {analysis ? 'Update analysis' : 'Analyze CV'}</button>
          </div>
        </form>
        {analysis && <div className="ats-results" aria-live="polite">
          <div className="ats-score-card">
            <div className={`ats-score ${analysis.passed ? 'passed' : 'below-threshold'}`}><strong>{analysis.overall}</strong><span>/100</span></div>
            <div><span className={`ats-verdict ${analysis.passed ? 'passed' : 'below-threshold'}`}>{analysis.passed ? 'PASS' : 'BELOW THRESHOLD'}</span><h3>{analysis.passed ? 'Meets the initial-screening target' : 'Below the 80-point target'}</h3><p>This is an estimate, not a guarantee of screening outcome.</p></div>
          </div>
          <section className="ats-result-section">
            <h3>Score breakdown</h3>
            {([
              ['Keyword match', analysis.scores.keywords, 30],
              ['Hard / technical skills', analysis.scores.skills, 30],
              ['Experience alignment', analysis.scores.experience, 20],
              ['Formatting & parsability', analysis.scores.formatting, 20],
            ] as const).map(([label, score, max]) => (
              <div className="ats-breakdown-row" key={label}>
                <div><span>{label}</span><strong>{score}<small> / {max}</small></strong></div>
                <div className="ats-progress-track"><span style={{ width: `${(score / max) * 100}%` }} /></div>
              </div>
            ))}
            <p className="ats-method-note">Scans the entire enabled CV, including summary, experience, projects, and skills. Recognized aliases include MySQL → SQL, Git/GitHub, React.js → React, and WordPress / Word Press. Compared {analysis.keywordCount} job-description terms{analysis.skillCount ? `, including ${analysis.skillCount} recognized technical skills` : '; no known technical skills were detected, so the skills score uses keyword coverage'}. Formatting points check structure only—not actual compatibility with any specific ATS.</p>
          </section>
          <div className="ats-result-grid">
            <section className="ats-result-section"><h3>Top missing keywords</h3>
              {analysis.missingKeywords.length ? <ul>{analysis.missingKeywords.map((term) => <li key={term}>{term}</li>)}</ul> : <p>No missing terms were found in the selected keyword set.</p>}
            </section>
            <section className="ats-result-section"><h3>Missing critical skills</h3>
              {analysis.missingSkills.length ? <ul>{analysis.missingSkills.map((term) => <li key={term}>{term}</li>)}</ul> : <p>{analysis.skillCount ? 'All recognized skills from the job description appear in your CV.' : 'No recognized technical skills were detected in the job description.'}</p>}
            </section>
            <section className="ats-result-section"><h3>Action verbs to consider</h3>
              {analysis.missingActionVerbs.length ? <ul className="ats-inline-list">{analysis.missingActionVerbs.map((verb) => <li key={verb}>{verb}</li>)}</ul> : <p>No additional common action verbs were identified.</p>}
            </section>
            <section className="ats-result-section"><h3>Formatting checks</h3><ul>{analysis.formatChecks.map((check) => <li key={check}>{check}</li>)}</ul></section>
          </div>
          <section className="ats-result-section ats-suggestions"><h3>Three quick improvements</h3><ol>{analysis.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ol></section>
          <p className="ats-disclaimer">Use only accurate claims. Keyword coverage is based on text matching, so equivalent wording and context may not be recognized.</p>
        </div>}
      </section>
    </div>
  )
}

function App() {
  const resume = useResumeStore((state) => state.resume)
  const { replaceResume, resetResume } = useResumeStore()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (
    localStorage.getItem('folio-theme') === 'dark' ? 'dark' : 'light'
  ))
  const [activeSection, setActiveSection] = useState('profile')
  const [zoom, setZoom] = useState(82)
  const [designOpen, setDesignOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [importError, setImportError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [atsOpen, setAtsOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  function fitPreview() {
    const pageWidthMm = resume.settings.pageSize === 'A4' ? 210 : 215.9
    const pageWidthPx = pageWidthMm * 96 / 25.4
    const availableWidth = (previewRef.current?.clientWidth ?? 0) - 48
    if (availableWidth > 0) setZoom(Math.max(50, Math.min(100, Math.floor((availableWidth / pageWidthPx) * 100))))
  }

  useEffect(() => {
    const frame = requestAnimationFrame(fitPreview)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    localStorage.setItem('folio-theme', theme)
  }, [theme])

  async function importFile(file?: File) {
    if (!file) return
    try {
      const parsed = resumeSchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success) {
        setImportError(`This file does not match the resume format: ${parsed.error.issues[0]?.path.join('.') || 'invalid data'}.`)
        return
      }
      replaceResume(parsed.data)
      setImportError('')
    } catch {
      setImportError('Could not read this file. Choose a valid resume JSON export.')
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="topbar no-print">
        <div className="brand"><div className="brand-mark">f.</div><div><strong>folio</strong><span>RESUME STUDIO</span></div></div>
        <div className="document-name"><span className="status-dot" /> {resume.profile.name || 'Untitled resume'} <span className="document-type">· Resume</span></div>
        <div className="topbar-actions">
          <button className="topbar-button ats-open-button" onClick={() => setAtsOpen(true)}><Sparkles size={15} /> <span>Analyze CV</span></button>
          <button
            className="topbar-button theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'dark'}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
          <button className="topbar-button" onClick={() => fileInput.current?.click()}><Upload size={15} /> <span>Import</span></button>
          <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
          <button className="topbar-button" onClick={() => downloadJson(resume)}><FileJson2 size={15} /> <span>Export JSON</span></button>
          <span className="topbar-divider" />
          <button className="export-button" onClick={() => printResume(resume.settings)}><ArrowDownToLine size={16} /> Export PDF</button>
          <button className="print-icon" title="Print resume" aria-label="Print resume" onClick={() => printResume(resume.settings)}><Printer size={16} /></button>
        </div>
      </header>
      {importError && <div role="alert" className="import-error no-print">{importError}<button onClick={() => setImportError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
      <div className="workspace no-print">
        <ContentSidebar active={activeSection} setActive={setActiveSection} dragId={dragId} setDragId={setDragId} />
        <section className="preview-workspace">
          <div className="preview-toolbar">
            <div><span className="preview-label">LIVE PREVIEW</span><span className="preview-page"><FileText size={13} /> {resume.settings.pageSize} · Resume</span></div>
            <div className="toolbar-actions">
              <button className="design-toggle" onClick={() => setDesignOpen(!designOpen)}><Settings2 size={14} /> Design</button>
              <div className="zoom-tools"><button title="Zoom out" onClick={() => setZoom(Math.max(50, zoom - 5))}><Minus size={14} /></button><span>{zoom}%</span><button title="Zoom in" onClick={() => setZoom(Math.min(120, zoom + 5))}><Plus size={14} /></button><span className="zoom-separator" /><button title="Fit page to preview width" onClick={fitPreview}><Maximize2 size={14} /></button></div>
            </div>
          </div>
          <ResumePreview zoom={zoom} containerRef={previewRef} />
          <div className="preview-footnote"><Check size={12} /> Changes save automatically <span>·</span> Export a PDF to share or print</div>
        </section>
        <DesignSidebar zoom={zoom} setZoom={setZoom} className={designOpen ? 'design-open' : ''} />
      </div>
      {designOpen && <button className="design-backdrop no-print" aria-label="Close design settings" onClick={() => setDesignOpen(false)} />}
      <div className="mobile-preview no-print"><ResumePreview zoom={100} /></div>
      <footer className="app-footer no-print"><span><span className="privacy-dot" /> Private by design</span><div><button onClick={() => downloadJson(resume)}>Backup data</button><button onClick={() => setResetOpen(true)}><RotateCcw size={13} /> Reset CV</button></div></footer>
      {resetOpen && <div className="modal-backdrop no-print" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetOpen(false) }}>
        <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><div className="modal-icon"><RotateCcw size={19} /></div><h2 id="reset-title">Start fresh?</h2><p>This replaces the current CV with the original sample data. You can export a JSON backup before continuing.</p><div className="modal-actions"><button className="cancel-button" onClick={() => setResetOpen(false)}>Keep editing</button><button className="confirm-button" onClick={() => { resetResume(); setActiveSection('profile'); setResetOpen(false) }}>Reset CV</button></div></div>
      </div>}
      {atsOpen && <AtsAnalysisModal resume={resume} onClose={() => setAtsOpen(false)} />}
      <div className="print-root"><ResumePreview zoom={100} /></div>
    </main>
  )
}

function printResume(settings: ReturnType<typeof useResumeStore.getState>['resume']['settings']) {
  document.getElementById('folio-print-page')?.remove()
  const style = document.createElement('style')
  style.id = 'folio-print-page'
  style.textContent = `@page { size: ${settings.pageSize}; margin: ${settings.marginTop}mm ${settings.marginSide}mm ${settings.marginBottom}mm; }`
  document.head.append(style)
  const cleanup = () => {
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}

export default App
