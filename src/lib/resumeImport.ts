import { defaultResume } from '../data/defaultResume'
import { resumeSchema } from '../types/resume'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim() ? value : fallback
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
  return fallback
}

function normalizeText(value: unknown, fallback = ''): unknown {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return value === undefined || value === null ? fallback : value
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  return [value]
}

function normalizeTextArray(value: unknown): unknown {
  return toArray(value).map((entry) => (
    typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
      ? String(entry)
      : entry
  ))
}

function normalizeDetails(value: unknown, itemId: string): unknown {
  return toArray(value).map((entry, index) => {
    const id = `${itemId}-detail-${index + 1}`
    if (typeof entry === 'string') {
      const separator = entry.includes('://') ? -1 : entry.indexOf(':')
      return {
        id,
        label: separator > 0 ? entry.slice(0, separator).trim() : '',
        content: separator > 0 ? entry.slice(separator + 1).trim() : entry.trim(),
      }
    }
    if (!isObject(entry)) return entry
    return {
      ...entry,
      id: toText(entry.id, id),
      label: normalizeText(entry.label ?? entry.name ?? entry.category),
      content: normalizeText(entry.content ?? entry.text ?? entry.value ?? entry.description),
    }
  })
}

function normalizeItem(value: unknown, sectionId: string, index: number, sectionType: string): unknown {
  if (typeof value === 'string') {
    const fields = sectionType === 'education'
      ? { institution: value }
      : sectionType === 'experience'
        ? { company: value }
        : { name: value }
    return {
      id: `${sectionId}-item-${index + 1}`,
      fields,
      bullets: [],
      details: [],
    }
  }
  if (!isObject(value)) return value
  const id = toText(value.id, `${sectionId}-item-${index + 1}`)
  const reservedFields = new Set(['id', 'fields', 'bullets', 'bulletPoints', 'details', 'subsections'])
  const flatFields = Object.fromEntries(
    Object.entries(value).filter(([key]) => !reservedFields.has(key)),
  )
  const fields = value.fields === undefined ? flatFields : value.fields

  return {
    ...value,
    id,
    fields: isObject(fields)
      ? Object.fromEntries(Object.entries(fields).map(([key, fieldValue]) => [key, normalizeText(fieldValue)]))
      : fields,
    bullets: normalizeTextArray(value.bullets ?? value.bulletPoints),
    details: normalizeDetails(value.details ?? value.technologies, id),
  }
}

function normalizeSubsection(value: unknown, sectionId: string, index: number): unknown {
  if (!isObject(value)) return value
  return {
    ...value,
    id: toText(value.id, `${sectionId}-subsection-${index + 1}`),
    heading: toText(value.heading ?? value.name, 'Additional Information'),
    items: normalizeTextArray(value.items),
  }
}

function normalizeSectionType(value: unknown): string {
  const rawType = toText(value).toLowerCase().replace(/[_-]+/g, ' ')
  if (['education', 'experience', 'summary', 'projects', 'list', 'custom'].includes(rawType)) return rawType
  if (/education|academic/.test(rawType)) return 'education'
  if (/experience|employment|work history|career/.test(rawType)) return 'experience'
  if (/summary|objective|profile/.test(rawType)) return 'summary'
  if (/skills|certification|research/.test(rawType)) return 'custom'
  return 'custom'
}

function normalizeSection(value: unknown, index: number): unknown {
  if (!isObject(value)) return value
  const id = toText(value.id, `section-${index + 1}`)
  const type = normalizeSectionType(value.type ?? value.heading ?? value.name)

  return {
    ...value,
    id,
    heading: toText(value.heading ?? value.name, 'Additional Information'),
    enabled: toBoolean(value.enabled, true),
    type,
    items: toArray(value.items).map((item, itemIndex) => normalizeItem(item, id, itemIndex, type)),
    subsections: toArray(value.subsections).map((subsection, subsectionIndex) =>
      normalizeSubsection(subsection, id, subsectionIndex)),
  }
}

function normalizeSections(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSection)
  if (!isObject(value)) return value

  return Object.entries(value).map(([key, rawSection], index) => {
    const section = isObject(rawSection) ? rawSection : {}
    const isItem = isObject(rawSection) &&
      ['fields', 'institution', 'company', 'degree', 'position'].some((field) => field in rawSection)
    const entries = section.items ?? section.entries ?? section.records ??
      (Array.isArray(rawSection)
        ? rawSection
        : isItem
          ? [rawSection]
          : rawSection)

    return normalizeSection({
      ...section,
      id: section.id ?? key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      heading: section.heading ?? (isItem ? key : section.name) ?? key,
      type: section.type ?? key,
      items: entries,
    }, index)
  })
}

function normalizeProfile(value: unknown): unknown {
  if (!isObject(value)) return value
  const profile = {
    ...value,
    name: normalizeText(value.name ?? value.fullName),
    title: normalizeText(value.title ?? value.role),
    phone: normalizeText(value.phone ?? value.telephone),
    email: normalizeText(value.email),
    location: normalizeText(value.location),
    linkedin: normalizeText(value.linkedin),
    portfolio: normalizeText(value.portfolio),
    photo: normalizeText(value.photo),
    summary: normalizeText(value.summary ?? value.professionalSummary),
    summaryEnabled: toBoolean(value.summaryEnabled, true),
    hyperlinksEnabled: toBoolean(value.hyperlinksEnabled, true),
  }
  return profile
}

function normalizeSettings(value: unknown): unknown {
  if (value === undefined || value === null) return { ...defaultResume.settings }
  if (!isObject(value)) return value
  const settings: Record<string, unknown> = { ...defaultResume.settings, ...value }
  const numericKeys = [
    'nameFontSize', 'titleFontSize', 'headingFontSize', 'subheadingFontSize',
    'bodyFontSize', 'contactFontSize', 'lineHeight', 'letterSpacing', 'marginTop',
    'marginBottom', 'marginSide', 'sectionSpacing', 'bulletSpacing',
    'paragraphSpacing', 'dividerThickness',
  ]
  for (const key of numericKeys) {
    const setting = settings[key]
    if (typeof setting === 'string' && setting.trim() !== '' && Number.isFinite(Number(setting))) {
      settings[key] = Number(setting)
    }
  }
  if (typeof settings.fontWeight === 'number') settings.fontWeight = String(settings.fontWeight)
  if ('showDivider' in settings) settings.showDivider = toBoolean(settings.showDivider, true)
  return settings
}

export function normalizeResumeImport(value: unknown): unknown {
  if (!isObject(value)) return value
  return {
    ...value,
    profile: normalizeProfile(value.profile),
    sections: normalizeSections(value.sections),
    settings: normalizeSettings(value.settings),
  }
}

export function parseResumeImport(value: unknown) {
  return resumeSchema.safeParse(normalizeResumeImport(value))
}
