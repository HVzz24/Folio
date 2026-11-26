import { Fragment, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, AlignJustify, AlignLeft, ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, BriefcaseBusiness, Check, ClipboardPaste,
  ChevronDown, ChevronRight, Eye, EyeOff, FileJson2, FileText, FolderKanban, GraduationCap, GripVertical,
  LayoutGrid, Maximize2, Minus, Moon, PanelLeftClose, PanelLeftOpen, Plus, Printer, RotateCcw, Settings2, Sparkles, Sun,
  ListChecks, Trash2, Type, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { DateRangePicker } from './components/DateRangePicker'
import { downloadAtsText, downloadJson } from './lib/storage'
import { parseResumeImport } from './lib/resumeImport'
import { analyzeResume, type AtsAnalysis } from './lib/atsAnalysis'
import { formatResumeDate, toDateFromResumeValue } from './lib/dates'
import { parseResumeText } from './lib/resumeParser'
import { type Resume, type ResumeItem, type ResumeSection } from './types/resume'
import { useResumeStore } from './store/resumeStore'

const FIELD_LABELS: Record<string, string> = {
  institution: 'Institution', location: 'Location', degree: 'Degree',
  grade: 'GPA / grade', start: 'Start date', end: 'End date', description: 'Description',
  company: 'Company', position: 'Position', name: 'Project name', category: 'Category',
}

const RESUME_COLORS = [
  { name: 'Forest', value: '#365a42' },
  { name: 'Navy', value: '#2f4d75' },
  { name: 'Plum', value: '#6e4668' },
  { name: 'Terracotta', value: '#99513d' },
  { name: 'Charcoal', value: '#263238' },
]

const EDITOR_PANEL_MIN_WIDTH = 320
const EDITOR_PANEL_MAX_WIDTH = 600
const EDITOR_PANEL_DEFAULT_WIDTH = 360

const RESUME_TEMPLATES: { name: string; description: string; settings: Partial<Resume['settings']> }[] = [
  {
    name: 'Classic',
    description: 'A clean, ATS-friendly single-column layout.',
    settings: { pageSize: 'A4', layout: 'single', accentColor: '#263238', fontFamily: 'Arial', alignment: 'left', lineHeight: 1.2 },
  },
  {
    name: 'Modern',
    description: 'A refined style with a subtle color accent.',
    settings: { pageSize: 'A4', layout: 'single', accentColor: '#365a42', fontFamily: 'Inter', alignment: 'left', lineHeight: 1.25 },
  },
  {
    name: 'Compact',
    description: 'A two-column option to fit more detail on a page.',
    settings: { pageSize: 'A4', layout: 'two', accentColor: '#2f4d75', fontFamily: 'Carlito', alignment: 'left', lineHeight: 1.15, marginTop: 8, marginBottom: 8, marginSide: 9 },
  },
]

function Field({ label, value, onChange, multiline = false, placeholder = '' }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string
}) {
  return (
    <label className={`field ${multiline ? 'field-wide' : ''}`}>
      <span>{label}</span>
      {multiline
        ? <Textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} rows={3} />
        : <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
    </label>
  )
}

function MiniButton({ title, onClick, children, danger = false, disabled = false }: {
  title: string; onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean
}) {
  return <Button variant="ghost" size="icon" className={`icon-button ${danger ? 'danger' : ''}`} type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}>{children}</Button>
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

function EntryEditor({ section, item, index, expanded, onToggle }: {
  section: ResumeSection
  item: ResumeItem
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  const { updateItem, deleteItem, moveItem, addBullet, updateBullet, deleteBullet, moveBullet } = useResumeStore()
  const { start = '', end = '', ...regularFields } = item.fields
  const primaryFields = Object.entries(regularFields).filter(([key]) => key !== 'description')
  const detailFields = Object.entries(regularFields).filter(([key]) => key === 'description')
  const hasDates = Object.hasOwn(item.fields, 'start') || Object.hasOwn(item.fields, 'end')
  const isCurrent = end.toLowerCase() === 'present'
  const supportsDetails = section.type === 'custom'
  const hasMoreDetails = detailFields.length > 0 || item.bullets.length > 0 || supportsDetails
  const title = item.fields.position || item.fields.degree || item.fields.name || item.fields.company || item.fields.institution || 'New entry'
  const subtitle = [
    item.fields.company !== title ? item.fields.company : '',
    item.fields.institution !== title ? item.fields.institution : '',
    item.fields.category,
    item.fields.location,
    !item.fields.company && !item.fields.institution && item.fields.start
      ? [item.fields.start, item.fields.end].filter(Boolean).map(formatResumeDate).join(' – ')
      : '',
  ].filter(Boolean).join(' · ')
  const startDate = toDateFromResumeValue(start)
  const endDate = isCurrent ? undefined : toDateFromResumeValue(end)
  const range: DateRange | undefined = startDate || endDate
    ? { from: startDate, to: endDate }
    : undefined

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
    <div className={`entry-card ${expanded ? 'entry-card-expanded' : ''}`}>
      <div className="entry-topline">
        <Button
          variant="ghost"
          className="entry-disclosure"
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Edit'} ${title}`}
          onClick={onToggle}
        >
          <span className="entry-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="entry-summary">
            <span className="entry-title">{title}</span>
            {subtitle && <small>{subtitle}</small>}
          </span>
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </Button>
        <MiniButton title="Move up" disabled={index === 0} onClick={() => moveItem(section.id, item.id, -1)}><ArrowUp size={14} /></MiniButton>
        <MiniButton title="Move down" disabled={index === section.items.length - 1} onClick={() => moveItem(section.id, item.id, 1)}><ArrowDown size={14} /></MiniButton>
        <MiniButton title="Delete entry" danger onClick={() => deleteItem(section.id, item.id)}><Trash2 size={14} /></MiniButton>
      </div>
      {expanded && <div className="entry-editor-fields">
        <div className="form-grid">
          {primaryFields.map(([key, value]) => (
            <Field
              key={key}
              label={FIELD_LABELS[key] ?? key}
              value={value}
              onChange={(next) => updateItem(section.id, item.id, { fields: { ...item.fields, [key]: next } })}
            />
          ))}
        </div>
        {hasDates && <div className="entry-date-fields">
          <DateRangePicker
            range={range}
            setRange={(nextRange) => updateDates({
              start: nextRange?.from ? format(nextRange.from, 'yyyy-MM-dd') : '',
              end: nextRange?.to
                ? format(nextRange.to, 'yyyy-MM-dd')
                : nextRange?.from && isCurrent ? 'Present' : '',
            })}
          />
          {(start && !startDate || end && !isCurrent && !endDate) && (
            <small className="date-legacy-note">Saved date values could not be recognized. Choose a range to replace them.</small>
          )}
          <label className="current-date-toggle">
            <Checkbox checked={isCurrent} onCheckedChange={(checked) => updateDates({ end: checked ? 'Present' : '' })} />
            <span>Ongoing / present</span>
          </label>
          <div className="entry-date-actions">
            <Button variant="link" size="sm" className="text-action" type="button" onClick={removeDates}><X size={13} /> Remove dates</Button>
          </div>
        </div>}
        {!hasDates && <div className="entry-date-actions">
          <Button variant="link" size="sm" className="text-action" type="button" onClick={() => updateDates({ start: '', end: '' })}><Plus size={13} /> Add date range</Button>
        </div>}
        {hasMoreDetails && <details className="editor-disclosure entry-more-details">
          <summary>
            <span><strong>More details</strong><small>{[
              detailFields.length ? 'description' : '',
              item.bullets.length ? `${item.bullets.filter(Boolean).length} achievements` : '',
              supportsDetails && item.details.length ? `${item.details.length} custom details` : '',
            ].filter(Boolean).join(' · ') || 'Add achievements or context'}</small></span>
            <ChevronDown size={15} />
          </summary>
          <div className="entry-more-content">
            {detailFields.length > 0 && <div className="form-grid">
              {detailFields.map(([key, value]) => (
                <Field
                  key={key}
                  label={FIELD_LABELS[key] ?? key}
                  value={value}
                  multiline
                  onChange={(next) => updateItem(section.id, item.id, { fields: { ...item.fields, [key]: next } })}
                />
              ))}
            </div>}
            {supportsDetails && <div className="field-wide">
              <div className="subsection-title"><span>Custom details</span><Button variant="link" size="sm" className="text-action" type="button" onClick={() => updateItem(section.id, item.id, {
                details: [...item.details, { id: crypto.randomUUID(), label: '', content: '' }],
              })}><Plus size={13} /> Add detail</Button></div>
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
            <div className="bullet-editor">
              <div className="subsection-title"><span>Achievements</span><Button variant="link" size="sm" className="text-action" type="button" onClick={() => addBullet(section.id, item.id)}><Plus size={13} /> Add achievement</Button></div>
              {item.bullets.map((bullet, bulletIndex) => (
                <div className="bullet-edit-row" key={`${item.id}-${bulletIndex}`}>
                  <span className="bullet-dot">•</span>
                  <Input value={bullet} placeholder="Describe an impact or achievement" onChange={(event) => updateBullet(section.id, item.id, bulletIndex, event.target.value)} />
                  <MiniButton title="Move bullet up" disabled={bulletIndex === 0} onClick={() => moveBullet(section.id, item.id, bulletIndex, -1)}><ArrowUp size={13} /></MiniButton>
                  <MiniButton title="Move bullet down" disabled={bulletIndex === item.bullets.length - 1} onClick={() => moveBullet(section.id, item.id, bulletIndex, 1)}><ArrowDown size={13} /></MiniButton>
                  <MiniButton title="Remove bullet" danger onClick={() => deleteBullet(section.id, item.id, bulletIndex)}><X size={13} /></MiniButton>
                </div>
              ))}
            </div>
          </div>
        </details>}
      </div>}
    </div>
  )
}

function ListSectionEditor({ section }: { section: ResumeSection }) {
  const { updateSubsection, addSubsection, deleteSubsection, moveSubsection, addListItem, updateListItem, deleteListItem, moveListItem } = useResumeStore()
  const [expandedSubsection, setExpandedSubsection] = useState<string | null>(null)
  return (
    <div className="subsections">
      {section.subsections.map((subsection, index) => (
        <div className={`subsection-editor ${expandedSubsection === subsection.id ? 'expanded' : ''}`} key={subsection.id}>
          <div className="subsection-heading-edit">
            <Button
              variant="ghost"
              className="subsection-disclosure"
              type="button"
              aria-expanded={expandedSubsection === subsection.id}
              onClick={() => setExpandedSubsection(expandedSubsection === subsection.id ? null : subsection.id)}
            >
              <span><strong>{subsection.heading || 'Untitled group'}</strong><small>{subsection.items.length} {subsection.items.length === 1 ? 'item' : 'items'}</small></span>
              {expandedSubsection === subsection.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </Button>
            <MiniButton title="Move subsection up" disabled={index === 0} onClick={() => moveSubsection(section.id, subsection.id, -1)}><ArrowUp size={13} /></MiniButton>
            <MiniButton title="Move subsection down" disabled={index === section.subsections.length - 1} onClick={() => moveSubsection(section.id, subsection.id, 1)}><ArrowDown size={13} /></MiniButton>
            <MiniButton title="Delete subsection" danger onClick={() => deleteSubsection(section.id, subsection.id)}><Trash2 size={14} /></MiniButton>
          </div>
          {expandedSubsection === subsection.id && <div className="subsection-items">
            <Input aria-label="Subsection heading" value={subsection.heading} onChange={(event) => updateSubsection(section.id, subsection.id, { heading: event.target.value })} />
            {subsection.items.map((item, index) => (
              <div className="list-edit-row" key={`${subsection.id}-${index}`}>
                <span className="bullet-dot">•</span>
                <Input value={item} placeholder="Add information" onChange={(event) => updateListItem(section.id, subsection.id, index, event.target.value)} />
                <MiniButton title="Move up" disabled={index === 0} onClick={() => moveListItem(section.id, subsection.id, index, -1)}><ArrowUp size={13} /></MiniButton>
                <MiniButton title="Move down" disabled={index === subsection.items.length - 1} onClick={() => moveListItem(section.id, subsection.id, index, 1)}><ArrowDown size={13} /></MiniButton>
                <MiniButton title="Remove item" danger onClick={() => deleteListItem(section.id, subsection.id, index)}><X size={13} /></MiniButton>
              </div>
            ))}
            <Button variant="link" size="sm" className="text-action add-list-item" type="button" onClick={() => addListItem(section.id, subsection.id)}><Plus size={13} /> Add item</Button>
          </div>}
        </div>
      ))}
      <Button variant="outline" className="outline-action" type="button" onClick={() => addSubsection(section.id)}><Plus size={14} /> Add subsection</Button>
    </div>
  )
}

function getSectionCardKind(section: ResumeSection) {
  if (section.type === 'summary') return 'Summary'
  if (section.type === 'experience') return 'Experience'
  if (section.type === 'education') return 'Education'
  const heading = section.heading.toLowerCase()
  if (heading.includes('project')) return 'Projects'
  if (heading.includes('skill')) return 'Skills'
  return 'Custom section'
}

function getSectionCardMeta(section: ResumeSection) {
  const heading = section.heading.toLowerCase()
  const entries = section.items.length
  const listItems = section.subsections.reduce((total, subsection) => total + subsection.items.length, 0)
  const groups = section.subsections.length
  const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
    `${count} ${count === 1 ? singular : pluralForm}`

  if (section.type === 'summary') return section.enabled ? 'Summary statement' : 'Hidden from resume'
  if (section.type === 'experience') return `${plural(entries, 'role')} · ${section.enabled ? 'On resume' : 'Hidden'}`
  if (section.type === 'education') return `${plural(entries, 'school')} · ${section.enabled ? 'On resume' : 'Hidden'}`
  if (heading.includes('project')) return `${plural(entries, 'project')} · ${section.enabled ? 'On resume' : 'Hidden'}`
  if (heading.includes('skill')) return `${plural(listItems, 'skill')} · ${section.enabled ? 'On resume' : 'Hidden'}`
  if (entries && groups) return `${plural(entries, 'entry')} · ${plural(groups, 'group')}`
  if (entries) return `${plural(entries, 'entry')} · ${section.enabled ? 'On resume' : 'Hidden'}`
  if (groups) return `${plural(groups, 'group')} · ${plural(listItems, 'item')}`
  return section.enabled ? 'Ready to add content' : 'Hidden from resume'
}

function ContentSidebar({ active, setActive, dragId, setDragId }: {
  active: string; setActive: (id: string) => void; dragId: string | null; setDragId: (id: string | null) => void
}) {
  const resume = useResumeStore((state) => state.resume)
  const store = useResumeStore()
  const [newHeading, setNewHeading] = useState('')
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const profile = resume.profile
  const accordionListRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    setExpandedEntryId(null)
    if (!active || active === 'profile') return
    const list = accordionListRef.current
    const section = sectionRefs.current.get(active)
    if (!list || !section) return
    const listBounds = list.getBoundingClientRect()
    const sectionTop = section.getBoundingClientRect().top
    if (sectionTop < listBounds.top) {
      list.scrollBy({ top: sectionTop - listBounds.top, behavior: 'smooth' })
    } else if (sectionTop > listBounds.bottom) {
      list.scrollBy({ top: sectionTop - listBounds.top, behavior: 'smooth' })
    }
  }, [active])

  function moveDropped(targetId: string) {
    if (dragId && dragId !== targetId) store.moveSection(dragId, targetId)
    setDragId(null)
  }

  function toggleSection(section: ResumeSection) {
    const enabled = !section.enabled
    store.updateSection(section.id, { enabled })
    if (section.type === 'summary') store.updateProfile('summaryEnabled', enabled)
    if (!enabled && active === section.id) {
      setActive(resume.sections.find((candidate) => candidate.id !== section.id && candidate.enabled)?.id ?? 'profile')
    }
  }

  return (
    <aside className="content-sidebar">
      <div className="sidebar-heading">
        <div><span className="eyebrow">YOUR DOCUMENT</span><h2>Content</h2></div>
        <span className="saved-pill"><Check size={12} /> Saved locally</span>
      </div>
      {!active && <p className="editor-hint">Choose a section below or click it in your preview to start editing.</p>}
      <div className="accordion-list" ref={accordionListRef}>
        <section className={`accordion ${active === 'profile' ? 'open' : ''}`}>
          <Button variant="ghost" className="accordion-trigger" type="button" onClick={() => setActive(active === 'profile' ? '' : 'profile')}>
            <span className="accordion-icon"><Sparkles size={16} /></span><span className="accordion-name">Personal profile<small>Name, contact & summary</small></span>
            {active === 'profile' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </Button>
          {active === 'profile' && <div className="accordion-content">
            <div className="form-grid">
              <Field label="Full name" value={profile.name} onChange={(value) => store.updateProfile('name', value)} />
              <Field label="Professional title" value={profile.title} onChange={(value) => store.updateProfile('title', value)} />
            </div>
            <details className="editor-disclosure profile-contact-details">
              <summary><span><strong>Contact & profile details</strong><small>Email, links, location and photo</small></span><ChevronDown size={15} /></summary>
              <div className="form-grid">
                <Field label="Email" value={profile.email} onChange={(value) => store.updateProfile('email', value)} />
                <Field label="Phone" value={profile.phone} onChange={(value) => store.updateProfile('phone', value)} />
                <Field label="Location" value={profile.location} onChange={(value) => store.updateProfile('location', value)} />
                <Field label="LinkedIn" value={profile.linkedin} onChange={(value) => store.updateProfile('linkedin', value)} />
                <Field label="Portfolio" value={profile.portfolio} onChange={(value) => store.updateProfile('portfolio', value)} />
                <label className="summary-toggle">
                  <span><strong>Clickable hyperlinks</strong><small>Link email, phone, LinkedIn & portfolio</small></span>
                  <Checkbox checked={profile.hyperlinksEnabled} onCheckedChange={(checked) => store.updateProfile('hyperlinksEnabled', checked)} />
                </label>
                <label className="field field-wide"><span>Profile photo (optional)</span><input type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => store.updateProfile('photo', String(reader.result ?? ''))
                  reader.onerror = () => window.alert('The selected image could not be read.')
                  reader.readAsDataURL(file)
                }} /></label>
                {profile.photo && <Button variant="link" size="sm" className="text-action" type="button" onClick={() => store.updateProfile('photo', '')}><X size={13} /> Remove photo</Button>}
              </div>
            </details>
          </div>}
        </section>
        <div className="section-list-heading"><span>Resume sections</span><span className="drag-hint"><GripVertical size={13} /> Drag to reorder</span></div>
        {resume.sections.map((section, index) => (
          <section
            className={`accordion section-accordion section-card ${active === section.id ? 'open selected' : ''} ${section.enabled ? '' : 'disabled'}`}
            key={section.id}
            ref={(element) => {
              if (element) sectionRefs.current.set(section.id, element)
              else sectionRefs.current.delete(section.id)
            }}
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
              <Button variant="ghost" className="accordion-trigger section-trigger" type="button" aria-expanded={active === section.id} onClick={() => setActive(section.id)}>
                <span className="section-card-icon" aria-hidden="true">
                  {section.type === 'summary' ? <FileText size={17} /> : section.type === 'experience' ? <BriefcaseBusiness size={17} /> : section.type === 'education' ? <GraduationCap size={17} /> : getSectionCardKind(section) === 'Projects' ? <FolderKanban size={17} /> : <ListChecks size={17} />}
                </span>
                <span className="section-card-copy">
                  <span className="section-card-title">{section.heading || 'Untitled section'}</span>
                  <span className="section-card-meta">{getSectionCardMeta(section)}</span>
                </span>
                <span className="section-card-kind">{getSectionCardKind(section)}</span>
                {active === section.id ? <ChevronDown className="section-card-chevron" size={15} /> : <ChevronRight className="section-card-chevron" size={15} />}
              </Button>
              <MiniButton title={section.enabled ? 'Hide section' : 'Show section'} onClick={() => toggleSection(section)}>{section.enabled ? <Eye size={14} /> : <EyeOff size={14} />}</MiniButton>
            </div>
            {active === section.id && <div className="accordion-content section-content">
              <Field label="Section heading" value={section.heading} onChange={(value) => store.updateSection(section.id, { heading: value })} />
              {section.type === 'summary'
                ? <>
                  <Field label="Summary content" value={profile.summary} multiline onChange={(value) => store.updateProfile('summary', value)} />
                  <div className="count-row"><span>{profile.summary.length} characters</span><span>{profile.summary.trim() ? profile.summary.trim().split(/\s+/).length : 0} words</span></div>
                </>
                : <>
                  {section.items.map((item, itemIndex) => <EntryEditor
                    key={item.id}
                    section={section}
                    item={item}
                    index={itemIndex}
                    expanded={expandedEntryId === item.id}
                    onToggle={() => setExpandedEntryId(expandedEntryId === item.id ? null : item.id)}
                  />)}
                  <Button variant="outline" className="outline-action" type="button" onClick={() => store.addItem(section.id)}><Plus size={14} /> Add {section.type === 'education' ? 'education' : section.type === 'experience' ? 'position' : 'entry'}</Button>
                  <div className="subsections"><ListSectionEditor section={section} /></div>
                </>}
              {section.type === 'custom' && section.items.length === 0 && section.subsections.length === 0 && <p className="helper-copy">Start with an entry or create titled subsections and list items.</p>}
              {section.type === 'custom' && <Button variant="link" size="sm" className="remove-section" type="button" onClick={() => { store.deleteSection(section.id); setActive('profile') }}><Trash2 size={14} /> Delete section</Button>}
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
          <Input value={newHeading} onChange={(event) => setNewHeading(event.target.value)} placeholder="Create a custom section" aria-label="Custom section heading" />
          <Button aria-label="Add section" variant="default" size="icon" type="submit"><Plus size={16} /></Button>
        </form>
      </div>
    </aside>
  )
}

function ResumePreview({ zoom, containerRef, resume: previewResume, activeSection, onSelectSection, interactive = false }: {
  zoom: number
  containerRef?: React.RefObject<HTMLDivElement | null>
  resume?: Resume
  activeSection?: string
  onSelectSection?: (sectionId: string) => void
  interactive?: boolean
}) {
  const storedResume = useResumeStore((state) => state.resume)
  const resume = previewResume ?? storedResume
  const { profile, settings } = resume
  const sectionElements = useRef(new Map<string, HTMLElement>())
  useEffect(() => {
    if (!interactive || !activeSection) return
    const container = containerRef?.current
    const section = sectionElements.current.get(activeSection)
    if (!container || !section || container.clientHeight === 0) return
    const containerBounds = container.getBoundingClientRect()
    const sectionBounds = section.getBoundingClientRect()
    if (sectionBounds.top < containerBounds.top) {
      container.scrollBy({ top: sectionBounds.top - containerBounds.top, behavior: 'smooth' })
    } else if (sectionBounds.bottom > containerBounds.bottom) {
      container.scrollBy({ top: sectionBounds.bottom - containerBounds.bottom, behavior: 'smooth' })
    }
  }, [activeSection, containerRef, interactive])
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
    '--resume-accent': settings.accentColor,
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
          {resume.sections.filter((section) => section.enabled).map((section) => (
            <section
              className={`resume-section ${interactive ? 'resume-section-selectable' : ''} ${interactive && activeSection === section.id ? 'resume-section-selected' : ''}`}
              key={section.id}
              ref={interactive ? (element) => {
                if (element) sectionElements.current.set(section.id, element)
                else sectionElements.current.delete(section.id)
              } : undefined}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-pressed={interactive ? activeSection === section.id : undefined}
              aria-label={interactive ? `Select ${section.heading || 'untitled'} resume section` : undefined}
              onClick={interactive ? () => onSelectSection?.(section.id) : undefined}
              onKeyDown={interactive ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectSection?.(section.id)
                }
              } : undefined}
            >
              {section.heading && <h2>{section.heading}</h2>}
              {section.type === 'summary' && profile.summary.trim() && <p>{profile.summary}</p>}
              {section.type !== 'summary' && <>
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
              </>}
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
      <div className="number-control"><Input type="number" min={min} max={max} step={step} value={value} onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
      }} /><small>{unit}</small></div>
      <input className="range-input" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function DesignSidebar({ zoom, setZoom }: { zoom: number; setZoom: (zoom: number) => void }) {
  const { settings } = useResumeStore((state) => state.resume)
  const update = useResumeStore((state) => state.updateSettings)
  const [tab, setTab] = useState<'type' | 'layout'>('type')
  return (
    <aside className="design-sidebar">
      <div className="sidebar-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h2>Design</h2></div><Settings2 size={17} className="muted-icon" /></div>
      <div className="settings-tabs">
        <Button variant={tab === 'type' ? 'secondary' : 'ghost'} size="sm" className={tab === 'type' ? 'selected' : ''} type="button" onClick={() => setTab('type')}><Type size={14} /> Type</Button>
        <Button variant={tab === 'layout' ? 'secondary' : 'ghost'} size="sm" className={tab === 'layout' ? 'selected' : ''} type="button" onClick={() => setTab('layout')}><LayoutGrid size={14} /> Layout</Button>
      </div>
      {tab === 'type' ? <div className="settings-content">
        <div className="setting-group">
          <div className="setting-group-heading"><Type size={15} /><strong>Typography</strong></div>
          <div className="select-setting"><span>Font family</span><Select
            aria-label="Font family"
            value={settings.fontFamily}
            onValueChange={(value) => update('fontFamily', value)}
            options={['Arial', 'Calibri', 'Carlito', 'Inter', 'Roboto', 'Lato', 'Times New Roman', 'Georgia'].map((font) => ({ value: font, label: font }))}
          /></div>
          <div className="select-setting"><span>Font weight</span><Select
            aria-label="Font weight"
            value={settings.fontWeight}
            onValueChange={(value) => update('fontWeight', value)}
            options={[
              { value: '400', label: 'Regular' },
              { value: '500', label: 'Medium' },
              { value: '600', label: 'Semibold' },
              { value: '700', label: 'Bold' },
            ]}
          /></div>
          {TYPE_SETTINGS.map((setting) => <NumberSetting key={setting.key} label={setting.label} value={settings[setting.key]} min={setting.min} max={setting.max} step={0.5} unit="pt" onChange={(value) => update(setting.key, value)} />)}
          <NumberSetting label="Line height" value={settings.lineHeight} min={1} max={2} step={0.05} onChange={(value) => update('lineHeight', value)} unit="×" />
          <NumberSetting label="Letter spacing" value={settings.letterSpacing} min={-0.5} max={2} step={0.1} onChange={(value) => update('letterSpacing', value)} unit="px" />
        </div>
        <div className="setting-group">
          <div className="setting-group-heading"><AlignLeft size={15} /><strong>Alignment</strong></div>
          <div className="segmented alignment-options">
            <Button variant={settings.alignment === 'left' ? 'secondary' : 'outline'} size="sm" className={settings.alignment === 'left' ? 'active' : ''} type="button" aria-pressed={settings.alignment === 'left'} onClick={() => update('alignment', 'left')}><AlignLeft size={15} /> Left</Button>
            <Button variant={settings.alignment === 'justify' ? 'secondary' : 'outline'} size="sm" className={settings.alignment === 'justify' ? 'active' : ''} type="button" aria-pressed={settings.alignment === 'justify'} onClick={() => update('alignment', 'justify')}><AlignJustify size={15} /> Justify</Button>
            <Button variant={settings.alignment === 'center' ? 'secondary' : 'outline'} size="sm" className={settings.alignment === 'center' ? 'active' : ''} type="button" aria-pressed={settings.alignment === 'center'} onClick={() => update('alignment', 'center')}><AlignCenter size={15} /> Center</Button>
          </div>
        </div>
        <div className="setting-group">
          <div className="setting-group-heading"><Sun size={15} /><strong>Resume color</strong></div>
          <div className="resume-color-options" role="group" aria-label="Choose resume accent color">
            {RESUME_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className="resume-color-swatch"
                style={{ '--swatch-color': color.value } as React.CSSProperties}
                aria-label={`${color.name} accent`}
                aria-pressed={settings.accentColor === color.value}
                onClick={() => update('accentColor', color.value)}
              />
            ))}
          </div>
        </div>
      </div> : <div className="settings-content">
        <div className="setting-group">
          <div className="setting-group-heading"><LayoutGrid size={15} /><strong>Page & layout</strong></div>
          <div className="select-setting"><span>Paper size</span><Select
            aria-label="Paper size"
            value={settings.pageSize}
            onValueChange={(value) => update('pageSize', value)}
            options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }]}
          /></div>
          <div className="select-setting"><span>Columns</span><Select
            aria-label="Columns"
            value={settings.layout}
            onValueChange={(value) => update('layout', value)}
            options={[
              { value: 'single', label: 'Single column · ATS friendly' },
              { value: 'two', label: 'Two columns' },
            ]}
          /></div>
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
          <label className="toggle-setting"><span>Section dividers</span><Checkbox checked={settings.showDivider} onCheckedChange={(checked) => update('showDivider', checked)} /></label>
        </div>
        <div className="setting-group">
          <div className="setting-group-heading"><Eye size={15} /><strong>Preview zoom</strong></div>
          <NumberSetting label="Zoom" value={zoom} min={50} max={120} onChange={setZoom} unit="%" />
        </div>
      </div>}
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
          <Button variant="ghost" size="icon" className="icon-button" type="button" aria-label="Close analysis" onClick={onClose}><X size={17} /></Button>
        </header>
        <p className="ats-intro">Compare your current CV with a job description. This transparent, rule-based estimate runs in your browser; it is not an employer’s actual ATS score.</p>
        <form className="ats-form" onSubmit={runAnalysis}>
          <label className="field"><span>Job title <small>Optional</small></span><Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Business Analyst" /></label>
          <label className="field"><span>Job description</span><Textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={8} required placeholder="Paste the full job description here…" /></label>
          <div className="ats-form-footer">
            <span>Job description stays in memory only. Re-run after CV edits to refresh the score.</span>
            <Button className="export-button" type="submit" disabled={!canAnalyze}><Sparkles size={15} /> {analysis ? 'Update analysis' : 'Analyze CV'}</Button>
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

function MarkdownCvStudio({ source, onSourceChange, currentResume, onBack, onApply }: {
  source: string
  onSourceChange: (source: string) => void
  currentResume: Resume
  onBack: () => void
  onApply: (parsed: ReturnType<typeof parseResumeText>) => void
}) {
  const [mobileView, setMobileView] = useState<'source' | 'preview'>('source')
  const [zoom, setZoom] = useState(78)
  const [confirming, setConfirming] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const parsed = useMemo(
    () => source.trim() ? parseResumeText(source) : null,
    [source],
  )

  function fitPreview() {
    const pageWidthMm = currentResume.settings.pageSize === 'A4' ? 210 : 215.9
    const pageWidthPx = pageWidthMm * 96 / 25.4
    const availableWidth = (previewRef.current?.clientWidth ?? 0) - 48
    if (availableWidth > 0) setZoom(Math.max(50, Math.min(100, Math.floor((availableWidth / pageWidthPx) * 100))))
  }

  const previewResume = parsed
    ? {
      ...currentResume,
      profile: { ...parsed.profile, hyperlinksEnabled: currentResume.profile.hyperlinksEnabled },
      sections: parsed.sections,
    }
    : undefined
  const itemCount = parsed ? parsed.sections.reduce((total, section) => (
    total + section.items.length + section.subsections.reduce((subsectionTotal, subsection) => subsectionTotal + subsection.items.length, 0)
  ), 0) : 0
  const canContinue = Boolean(parsed && (parsed.profile.name || parsed.sections.length))

  return (
    <div className="markdown-studio">
      <header className="markdown-studio-header">
        <Button variant="ghost" className="topbar-button markdown-back-button" type="button" onClick={onBack}><ArrowLeft size={15} /> Back to Folio</Button>
        <div className="markdown-studio-title"><span className="eyebrow">FOLIO · MARKDOWN REVIEW</span><h1>Preview your CV</h1></div>
        <span className="markdown-studio-privacy"><Check size={13} /> Draft stays in this tab</span>
      </header>
      <div className="markdown-studio-mobile-tabs" role="tablist" aria-label="Markdown and preview">
        <Button variant={mobileView === 'source' ? 'secondary' : 'ghost'} size="sm" type="button" role="tab" aria-selected={mobileView === 'source'} className={mobileView === 'source' ? 'selected' : ''} onClick={() => setMobileView('source')}>Markdown</Button>
        <Button variant={mobileView === 'preview' ? 'secondary' : 'ghost'} size="sm" type="button" role="tab" aria-selected={mobileView === 'preview'} className={mobileView === 'preview' ? 'selected' : ''} onClick={() => setMobileView('preview')}>Live preview</Button>
      </div>
      <div className="markdown-studio-grid" data-mobile-view={mobileView}>
        <section className="markdown-source-panel" aria-label="Markdown CV editor">
          <div className="markdown-source-heading">
            <div><span className="eyebrow">SOURCE</span><h2>CV content</h2><p>Edit the Markdown; the preview updates as you type.</p></div>
            <Button variant="link" size="sm" className="text-action markdown-clear-button" type="button" disabled={!source} onClick={() => {
              onSourceChange('')
              setConfirming(false)
            }}><X size={13} /> Clear</Button>
          </div>
          <Textarea
            aria-label="CV Markdown source"
            className="markdown-source-editor"
            value={source}
            spellCheck={false}
            placeholder={'# Jane Doe\nLocation | email@example.com | +1 555 010 1234\n\n## PROFESSIONAL SUMMARY\nYour summary...\n\n## EXPERIENCE\n**Role — Company**\nJan 2022 – Present\n- Achievement or responsibility'}
            onChange={(event) => {
              onSourceChange(event.target.value)
              setConfirming(false)
            }}
          />
          <div className="markdown-review">
            {parsed
              ? <>
                <div className="resume-import-counts">
                  <div><strong>{parsed.profile.name || 'Name not found'}</strong><span>Profile</span></div>
                  <div><strong>{parsed.sections.length}</strong><span>Sections</span></div>
                  <div><strong>{itemCount}</strong><span>Items mapped</span></div>
                </div>
                <ul className="resume-import-sections">{parsed.sections.map((section) => {
                  const sectionItems = section.items.length + section.subsections.reduce((total, subsection) => total + subsection.items.length, 0)
                  const groupsWithItems = section.subsections.filter((subsection) => subsection.items.length > 0).length
                  const listItemCount = section.subsections.reduce((total, subsection) => total + subsection.items.length, 0)
                  const count = section.type === 'summary'
                    ? 'Summary mapped to profile'
                    : [
                      section.items.length ? `${section.items.length} entries` : '',
                      groupsWithItems ? `${groupsWithItems} groups` : '',
                      listItemCount ? `${listItemCount} list items` : '',
                    ].filter(Boolean).join(' · ') || 'No items mapped'
                  return <li className={sectionItems === 0 && section.type !== 'summary' ? 'resume-import-section-empty' : ''} key={section.id}>
                    <span>{section.heading}</span><small>{count}</small>
                  </li>
                })}</ul>
                {parsed.diagnostics.length > 0
                  ? <div className="resume-import-warnings">
                    <strong>Items to review ({parsed.diagnostics.length})</strong>
                    <ul>{parsed.diagnostics.map((diagnostic, index) => (
                      <li key={`${diagnostic.title}-${index}`}>
                        <strong>{diagnostic.title}</strong>
                        <span>{diagnostic.message}</span>
                        {diagnostic.section && <small>Section: {diagnostic.section}</small>}
                        {diagnostic.excerpt && <code>{diagnostic.excerpt}</code>}
                      </li>
                    ))}</ul>
                  </div>
                  : <p className="resume-import-clean">No parser issues detected. Compare the section counts and preview with your source before continuing.</p>}
              </>
              : <p className="markdown-review-empty">Paste Markdown to see detected sections and import checks.</p>}
          </div>
        </section>
        <section className="preview-workspace markdown-studio-preview" aria-label="Live CV preview">
          <div className="preview-toolbar">
            <div><span className="preview-label">LIVE PREVIEW</span><span className="preview-page"><FileText size={13} /> {currentResume.settings.pageSize} · Resume</span></div>
            <div className="toolbar-actions">
              <span className="markdown-preview-note">Uses your Folio design settings</span>
              <div className="zoom-tools">
                <Button variant="outline" size="icon" title="Zoom out" type="button" onClick={() => setZoom(Math.max(50, zoom - 5))}><Minus size={14} /></Button>
                <span>{zoom}%</span>
                <Button variant="outline" size="icon" title="Zoom in" type="button" onClick={() => setZoom(Math.min(120, zoom + 5))}><Plus size={14} /></Button>
                <span className="zoom-separator" />
                <Button variant="outline" size="icon" title="Fit page to preview width" type="button" onClick={fitPreview}><Maximize2 size={14} /></Button>
              </div>
            </div>
          </div>
          {previewResume
            ? <ResumePreview zoom={zoom} containerRef={previewRef} resume={previewResume} />
            : <div className="markdown-preview-empty"><FileText size={24} /><strong>Your preview will appear here</strong><span>Paste your CV Markdown to compare the parsed result.</span></div>}
        </section>
      </div>
      <footer className="markdown-studio-footer">
        {confirming
          ? <div className="markdown-confirm" role="alert">
            <span>This replaces the saved CV content in Folio. Your design settings stay unchanged.</span>
            <div><Button variant="outline" className="cancel-button" type="button" onClick={() => setConfirming(false)}>Keep reviewing</Button>
              <Button className="export-button" type="button" onClick={() => parsed && onApply(parsed)}>Replace and continue</Button></div>
          </div>
          : <>
            <span><Check size={13} /> Your saved Folio CV stays unchanged until you continue.</span>
            <Button className="export-button" type="button" disabled={!canContinue} onClick={() => setConfirming(true)}>Continue in Folio <ArrowRight size={15} /></Button>
          </>}
      </footer>
    </div>
  )
}

function App() {
  const resume = useResumeStore((state) => state.resume)
  const { replaceResume, resetResume } = useResumeStore()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (
    localStorage.getItem('folio-theme') === 'dark' ? 'dark' : 'light'
  ))
  const [activeSection, setActiveSection] = useState('')
  const [zoom, setZoom] = useState(82)
  const [editorMode, setEditorMode] = useState<'dashboard' | 'content' | 'templates' | 'design' | 'ats' | 'settings'>('content')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('folio-sidebar-collapsed') === 'true')
  const [editorPanelWidth, setEditorPanelWidth] = useState(() => {
    const savedWidth = localStorage.getItem('folio-editor-panel-width')
    if (savedWidth === null) return EDITOR_PANEL_DEFAULT_WIDTH
    const parsedWidth = Number(savedWidth)
    return Number.isFinite(parsedWidth)
      ? Math.min(EDITOR_PANEL_MAX_WIDTH, Math.max(EDITOR_PANEL_MIN_WIDTH, parsedWidth))
      : EDITOR_PANEL_DEFAULT_WIDTH
  })
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [dragId, setDragId] = useState<string | null>(null)
  const [importError, setImportError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [atsOpen, setAtsOpen] = useState(false)
  const [markdownWorkspaceOpen, setMarkdownWorkspaceOpen] = useState(false)
  const [markdownDraft, setMarkdownDraft] = useState(() => sessionStorage.getItem('folio-markdown-draft') ?? '')
  const fileInput = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const panelResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null)

  function fitPreview() {
    const pageWidthMm = resume.settings.pageSize === 'A4' ? 210 : 215.9
    const pageWidthPx = pageWidthMm * 96 / 25.4
    const availableWidth = (previewRef.current?.clientWidth ?? 0) - 48
    if (availableWidth > 0) setZoom(Math.max(50, Math.min(100, Math.floor((availableWidth / pageWidthPx) * 100))))
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (mobileView === 'preview' && window.matchMedia('(max-width: 720px)').matches) {
        previewRef.current?.scrollTo({ top: 0, left: 0 })
      }
      fitPreview()
    })
    return () => cancelAnimationFrame(frame)
  }, [mobileView])

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return
    const observer = new ResizeObserver(fitPreview)
    observer.observe(preview)
    return () => observer.disconnect()
  }, [resume.settings.pageSize])

  useEffect(() => {
    localStorage.setItem('folio-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('folio-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem('folio-editor-panel-width', String(editorPanelWidth))
  }, [editorPanelWidth])

  useEffect(() => () => {
    document.body.classList.remove('resizing-editor-panel')
  }, [])

  function startPanelResize(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    panelResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: editorPanelWidth,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add('resizing-editor-panel')
    setIsResizingPanel(true)
  }

  function movePanelResize(event: React.PointerEvent<HTMLDivElement>) {
    const resize = panelResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    setEditorPanelWidth(Math.min(
      EDITOR_PANEL_MAX_WIDTH,
      Math.max(EDITOR_PANEL_MIN_WIDTH, Math.round(resize.startWidth + resize.startX - event.clientX)),
    ))
  }

  function stopPanelResize() {
    if (!panelResizeRef.current) return
    panelResizeRef.current = null
    document.body.classList.remove('resizing-editor-panel')
    setIsResizingPanel(false)
  }

  function adjustPanelWidth(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 10
    const delta = event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0
    if (delta === 0) return
    event.preventDefault()
    setEditorPanelWidth((width) => Math.min(
      EDITOR_PANEL_MAX_WIDTH,
      Math.max(EDITOR_PANEL_MIN_WIDTH, width + delta),
    ))
  }

  async function importFile(file?: File) {
    if (!file) return
    try {
      const parsed = parseResumeImport(JSON.parse(await file.text()))
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 5).map((issue) =>
          `${issue.path.join('.') || 'root'} (${issue.message})`,
        )
        const additional = parsed.error.issues.length > issues.length
          ? ` And ${parsed.error.issues.length - issues.length} more.`
          : ''
        const hasRootFormatIssue = parsed.error.issues.some((issue) =>
          issue.path.length === 1 && ['profile', 'sections'].includes(String(issue.path[0])),
        )
        const explanation = hasRootFormatIssue
          ? "This file is not using Folio's required top-level structure. It needs a \"profile\" object and a \"sections\" array."
          : 'This is JSON, but some values do not match the resume template.'
        const fixPrompt = 'Give the AI the resume-template.json and this file. Ask it: "Convert my CV to match the template exactly. Keep the top-level profile object and sections array; do not rename or remove keys. Preserve all CV facts and return only valid JSON with no Markdown."'
        setImportError(`${explanation}\nProblems: ${issues.join('; ')}.${additional}\nAI fix prompt: ${fixPrompt}`)
        return
      }
      replaceResume(parsed.data)
      setImportError('')
    } catch {
      setImportError('Could not read this file. Choose a valid resume JSON export.')
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  function applyParsedResume(parsed: ReturnType<typeof parseResumeText>) {
    replaceResume({
      ...resume,
      profile: {
        ...parsed.profile,
        hyperlinksEnabled: resume.profile.hyperlinksEnabled,
      },
      sections: parsed.sections,
    })
    setActiveSection('profile')
    setMarkdownWorkspaceOpen(false)
  }

  function resetToSampleResume() {
    resetResume()
    setActiveSection('profile')
  }

  function updateMarkdownDraft(source: string) {
    setMarkdownDraft(source)
    if (source) sessionStorage.setItem('folio-markdown-draft', source)
    else sessionStorage.removeItem('folio-markdown-draft')
  }

  function selectPreviewSection(sectionId: string) {
    setActiveSection(sectionId)
    setEditorMode('content')
    setMobileView('edit')
  }

  if (markdownWorkspaceOpen) {
    return (
      <main className="app-shell" data-theme={theme}>
        <MarkdownCvStudio
          source={markdownDraft}
          onSourceChange={updateMarkdownDraft}
          currentResume={resume}
          onBack={() => setMarkdownWorkspaceOpen(false)}
          onApply={applyParsedResume}
        />
      </main>
    )
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="topbar no-print">
        <div className="brand topbar-brand"><div className="brand-mark">f.</div><div><strong>folio</strong><span>RESUME STUDIO</span></div></div>
        <div className="document-name"><span className="status-dot" /> {resume.profile.name || 'Untitled resume'} <span className="document-type">· Resume</span></div>
        <div className="topbar-actions">
          <Button variant="ghost" className="topbar-button ats-open-button" type="button" onClick={() => setAtsOpen(true)}><Sparkles size={15} /> <span>Analyze CV</span></Button>
          <Button variant="ghost" className="topbar-button" type="button" onClick={() => setMarkdownWorkspaceOpen(true)} aria-label="Paste CV as Markdown" title="Paste CV as Markdown"><ClipboardPaste size={15} /> <span>Paste CV</span></Button>
          <Button variant="ghost" className="topbar-button" type="button" onClick={() => fileInput.current?.click()}><Upload size={15} /> <span>Import</span></Button>
          <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
          <Button
            variant="ghost"
            className="topbar-button theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </Button>
          <Button className="export-button" type="button" onClick={() => printResume(resume.settings)}><ArrowDownToLine size={16} /> Export PDF</Button>
          <Button variant="ghost" size="icon" className="print-icon" type="button" title="Print resume" aria-label="Print resume" onClick={() => printResume(resume.settings)}><Printer size={16} /></Button>
        </div>
      </header>
      {importError && <div role="alert" className="import-error no-print">{importError}<Button variant="ghost" size="icon" type="button" onClick={() => setImportError('')} aria-label="Dismiss error"><X size={14} /></Button></div>}
      <div className="mobile-view-nav no-print">
        <div className="mobile-preview-toggle" role="group" aria-label="Choose editor or resume preview">
          <Button variant={mobileView === 'edit' ? 'secondary' : 'ghost'} size="sm" type="button" aria-pressed={mobileView === 'edit'} onClick={() => setMobileView('edit')}>Edit</Button>
          <Button variant={mobileView === 'preview' ? 'secondary' : 'ghost'} size="sm" type="button" aria-pressed={mobileView === 'preview'} onClick={() => setMobileView('preview')}>Preview</Button>
        </div>
      </div>
      <div className="studio-body no-print" data-sidebar-collapsed={sidebarCollapsed}>
        <aside className="studio-nav" aria-label="Main navigation">
          <div className="studio-nav-header">
            <div className="brand"><div className="brand-mark">f.</div><div><strong>folio</strong><span>RESUME STUDIO</span></div></div>
            <button
              className="studio-nav-collapse"
              type="button"
              aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>
          <div className="studio-nav-section">
            <span className="studio-nav-label">WORKSPACE</span>
            <button className={`studio-nav-item ${editorMode === 'dashboard' ? 'selected' : ''}`} type="button" aria-label="Dashboard" title="Dashboard" data-tooltip="Dashboard" onClick={() => { setEditorMode('dashboard'); setMobileView('edit') }}><LayoutGrid size={17} /><span>Dashboard</span></button>
            <button className={`studio-nav-item ${editorMode === 'content' || editorMode === 'ats' ? 'selected' : ''}`} type="button" aria-label="My Resume" title="My Resume" data-tooltip="My Resume" onClick={() => { setEditorMode('content'); setMobileView('edit') }}><FileText size={17} /><span>My Resume</span></button>
            <button className={`studio-nav-item ${editorMode === 'templates' ? 'selected' : ''}`} type="button" aria-label="Templates" title="Templates" data-tooltip="Templates" onClick={() => { setEditorMode('templates'); setMobileView('edit') }}><LayoutGrid size={17} /><span>Templates</span></button>
          </div>
          <div className="studio-nav-section">
            <span className="studio-nav-label">DOCUMENT</span>
            <button className={`studio-nav-item ${editorMode === 'design' ? 'selected' : ''}`} type="button" aria-label="Theme" title="Theme" data-tooltip="Theme" onClick={() => { setEditorMode('design'); setMobileView('edit') }}><Sun size={17} /><span>Theme</span></button>
            <button className="studio-nav-item" type="button" aria-label="Export" title="Export" data-tooltip="Export" onClick={() => printResume(resume.settings)}><ArrowDownToLine size={17} /><span>Export</span></button>
            <button className={`studio-nav-item ${editorMode === 'settings' ? 'selected' : ''}`} type="button" aria-label="Settings" title="Settings" data-tooltip="Settings" onClick={() => { setEditorMode('settings'); setMobileView('edit') }}><Settings2 size={17} /><span>Settings</span></button>
          </div>
        </aside>
        <div
          className="workspace"
          data-mode={editorMode}
          data-mobile-view={mobileView}
          data-resizing={isResizingPanel}
          style={{ '--editor-panel-width': `${editorPanelWidth}px` } as CSSProperties}
        >
          <section className="preview-workspace">
            <div className="preview-toolbar">
              <div><span className="preview-label">LIVE PREVIEW</span><span className="preview-page"><FileText size={13} /> {resume.settings.pageSize} · Resume</span></div>
              <div className="toolbar-actions">
                <div className="zoom-tools"><Button variant="outline" size="icon" title="Zoom out" type="button" onClick={() => setZoom(Math.max(50, zoom - 5))}><Minus size={14} /></Button><span>{zoom}%</span><Button variant="outline" size="icon" title="Zoom in" type="button" onClick={() => setZoom(Math.min(120, zoom + 5))}><Plus size={14} /></Button><span className="zoom-separator" /><Button variant="outline" size="icon" title="Fit page to preview width" type="button" onClick={fitPreview}><Maximize2 size={14} /></Button></div>
              </div>
            </div>
            <ResumePreview
              zoom={zoom}
              containerRef={previewRef}
              activeSection={activeSection}
              onSelectSection={selectPreviewSection}
              interactive
            />
            <div className="preview-footnote"><Check size={12} /> Changes save automatically <span>·</span> Export a PDF to share or print</div>
          </section>
          <aside className="editor-panel">
            <div
              className="editor-panel-resize-handle"
              role="separator"
              aria-label="Resize editor panel"
              aria-orientation="vertical"
              aria-valuemin={EDITOR_PANEL_MIN_WIDTH}
              aria-valuemax={EDITOR_PANEL_MAX_WIDTH}
              aria-valuenow={editorPanelWidth}
              tabIndex={0}
              onPointerDown={startPanelResize}
              onPointerMove={movePanelResize}
              onPointerUp={stopPanelResize}
              onPointerCancel={stopPanelResize}
              onLostPointerCapture={stopPanelResize}
              onKeyDown={adjustPanelWidth}
            />
            <div className="editor-panel-tabs" role="group" aria-label="Resume editing tools">
              <Button variant={editorMode === 'content' ? 'secondary' : 'ghost'} size="sm" type="button" aria-pressed={editorMode === 'content'} onClick={() => setEditorMode('content')}><FileText size={14} /><span>Edit section</span></Button>
              <Button variant={editorMode === 'design' ? 'secondary' : 'ghost'} size="sm" type="button" aria-pressed={editorMode === 'design'} onClick={() => setEditorMode('design')}><Settings2 size={14} /><span>Layout controls</span></Button>
              <Button variant={editorMode === 'ats' ? 'secondary' : 'ghost'} size="sm" type="button" aria-pressed={editorMode === 'ats'} onClick={() => setEditorMode('ats')}><Sparkles size={14} /><span>ATS score</span></Button>
            </div>
            {editorMode === 'dashboard' && <section className="dashboard-panel">
              <div className="sidebar-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Dashboard</h2></div><LayoutGrid size={18} className="muted-icon" /></div>
              <div className="dashboard-panel-content">
                <p className="dashboard-welcome">Welcome back{resume.profile.name ? `, ${resume.profile.name}` : ''}.</p>
                <p className="helper-copy">Keep your resume focused, readable, and ready to tailor for your next opportunity.</p>
                <div className="dashboard-metrics">
                  <div><strong>{resume.sections.filter((section) => section.enabled).length}</strong><span>Active sections</span></div>
                  <div><strong>{resume.sections.reduce((total, section) => total + section.items.length, 0)}</strong><span>Resume entries</span></div>
                  <div><strong>{resume.settings.pageSize}</strong><span>Page size</span></div>
                </div>
                <div className="dashboard-next-step">
                  <span className="eyebrow">NEXT STEP</span>
                  <h3>Review your resume content</h3>
                  <p>Check that your experience and achievements are specific to the role you want.</p>
                  <Button className="export-button" type="button" onClick={() => { setEditorMode('content'); setMobileView('edit') }}><FileText size={15} /> Continue editing</Button>
                </div>
                <Button variant="outline" className="settings-action" type="button" onClick={() => setAtsOpen(true)}><Sparkles size={15} /> Run an ATS match analysis</Button>
              </div>
            </section>}
            {editorMode === 'content' && <ContentSidebar active={activeSection} setActive={setActiveSection} dragId={dragId} setDragId={setDragId} />}
            {editorMode === 'design' && <DesignSidebar zoom={zoom} setZoom={setZoom} />}
            {editorMode === 'templates' && <section className="template-panel">
              <div className="sidebar-heading"><div><span className="eyebrow">START WITH A STYLE</span><h2>Templates</h2></div><LayoutGrid size={18} className="muted-icon" /></div>
              <div className="template-panel-content">
                <p className="helper-copy">Choose a starting layout. Your resume content stays unchanged, and you can fine-tune the design afterward.</p>
                {RESUME_TEMPLATES.map((template) => (
                  <article className="template-card" key={template.name}>
                    <div className={`template-thumbnail template-thumbnail-${template.name.toLowerCase()}`} aria-hidden="true"><span /><i /><i /><i /><b /></div>
                    <div className="template-card-copy"><strong>{template.name}</strong><p>{template.description}</p></div>
                    <Button variant="outline" size="sm" type="button" onClick={() => replaceResume({ ...resume, settings: { ...resume.settings, ...template.settings } })}>Use style</Button>
                  </article>
                ))}
                <p className="template-ats-note"><Check size={14} /> Classic and Modern keep a single-column reading order for ATS compatibility.</p>
              </div>
            </section>}
            {editorMode === 'ats' && <section className="ats-tools-panel">
              <div className="sidebar-heading"><div><span className="eyebrow">ATS & WRITING</span><h2>Resume check</h2></div><Sparkles size={18} className="muted-icon" /></div>
              <div className="ats-tools-content">
                <div className="ats-tools-card">
                  <span className="ats-tools-icon"><Check size={17} /></span>
                  <h3>Match your resume to a role</h3>
                  <p>Get a transparent keyword and formatting estimate, plus focused suggestions based on the job description.</p>
                  <Button className="export-button ats-tools-action" type="button" onClick={() => setAtsOpen(true)}><Sparkles size={15} /> Analyze against a job</Button>
                  <small>Analysis runs in your browser. It is an estimate, not an employer’s actual ATS score.</small>
                </div>
                <div className="ats-tools-details">
                  <strong>What the check covers</strong>
                  <ul><li>Role-specific keyword coverage</li><li>Technical skills and experience alignment</li><li>Formatting checks and writing suggestions</li></ul>
                </div>
              </div>
            </section>}
            {editorMode === 'settings' && <section className="settings-panel">
              <div className="sidebar-heading"><div><span className="eyebrow">PREFERENCES</span><h2>Settings</h2></div><Settings2 size={18} className="muted-icon" /></div>
              <div className="settings-panel-content">
                <div className="setting-group">
                  <div className="setting-group-heading"><FileJson2 size={15} /><strong>Backup & data</strong></div>
                  <Button variant="outline" className="settings-action" type="button" onClick={() => downloadJson(resume)}>Download JSON backup</Button>
                  <Button variant="outline" className="settings-action" type="button" onClick={() => downloadAtsText(resume)}>Export accessible text</Button>
                  <Button variant="outline" className="settings-action" type="button" onClick={() => fileInput.current?.click()}><Upload size={15} /> Import resume JSON</Button>
                </div>
                <div className="setting-group">
                  <div className="setting-group-heading"><RotateCcw size={15} /><strong>Start over</strong></div>
                  <p className="helper-copy">Restore the sample resume. Export a backup first if you want to keep your current version.</p>
                  <Button variant="outline" className="settings-action settings-reset" type="button" onClick={() => setResetOpen(true)}><RotateCcw size={15} /> Reset resume</Button>
                </div>
              </div>
            </section>}
          </aside>
        </div>
      </div>
      <footer className="app-footer no-print">
        <span className="footer-privacy"><span className="privacy-dot" /><strong>Your CV stays yours</strong><span>Saved only in this browser on this device.</span></span>
        <div><span>Folio Resume Studio</span></div>
      </footer>
      {resetOpen && <div className="modal-backdrop no-print" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetOpen(false) }}>
        <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><div className="modal-icon"><RotateCcw size={19} /></div><h2 id="reset-title">Start fresh?</h2><p>This replaces the current CV with the original sample data. You can export a JSON backup before continuing.</p><div className="modal-actions"><Button variant="outline" className="cancel-button" type="button" onClick={() => setResetOpen(false)}>Keep editing</Button><Button variant="destructive" className="confirm-button" type="button" onClick={() => { resetToSampleResume(); setResetOpen(false) }}>Reset CV</Button></div></div>
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
