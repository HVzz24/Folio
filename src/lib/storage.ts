import { resumeSchema, type Resume } from '../types/resume'
import { formatResumeDate } from './dates'

const STORAGE_KEY = 'folio-resume-v4'
const LEGACY_STORAGE_KEYS = ['folio-resume-v3', 'folio-resume-v2', 'folio-resume-v1']

export function normalizeResume(resume: Resume): Resume {
  const standardSections = [
    { id: 'professional-summary', heading: 'Professional Summary', type: 'summary' as const },
    { id: 'education', heading: 'Education', type: 'education' as const },
    { id: 'experience', heading: 'Professional Experience', type: 'experience' as const },
  ]
  const missingSections = standardSections
    .filter(({ type }) => !resume.sections.some((section) => section.type === type))
    .map(({ id, heading, type }) => ({
      id,
      heading,
      type,
      enabled: type === 'summary' ? resume.profile.summaryEnabled : true,
      items: [],
      subsections: [],
    }))
  const normalizedSections = resume.sections.map((section) => {
    const standard = standardSections.find(({ type }) => section.type === type)
    return standard ? { ...section, id: standard.id } : section
  })
  const sections = [...missingSections, ...normalizedSections]
  const summary = sections.find((section) => section.type === 'summary')

  return {
    ...resume,
    profile: { ...resume.profile, summaryEnabled: summary?.enabled ?? resume.profile.summaryEnabled },
    sections,
  }
}

export function loadResume(fallback: Resume): Resume {
  let stored = localStorage.getItem(STORAGE_KEY)
  let migrateDesign = false
  if (!stored) {
    for (const key of LEGACY_STORAGE_KEYS) {
      stored = localStorage.getItem(key)
      if (stored) {
        migrateDesign = true
        break
      }
    }
  }
  if (!stored) return fallback
  try {
    const parsed = normalizeResume(resumeSchema.parse(JSON.parse(stored)))
    if (!migrateDesign) {
      saveResume(parsed)
      return parsed
    }
    const previousHeadings: Record<string, string[]> = {
      education: ['Education', 'Pendidikan'],
      experience: ['Professional Experience', 'Experiences'],
      projects: ['Projects & Research', 'Projects'],
      additional: ['Additional Information', 'Skills and Certifications'],
    }
    const migrated: Resume = normalizeResume({
      ...parsed,
      profile: {
        ...parsed.profile,
        title: parsed.profile.title === 'Information Systems Professional' ? '' : parsed.profile.title,
      },
      sections: parsed.sections.map((section) => ({
        ...section,
        heading: previousHeadings[section.id]?.includes(section.heading)
          ? fallback.sections.find((defaultSection) => defaultSection.id === section.id)?.heading ?? section.heading
          : section.heading,
      })),
      settings: { ...parsed.settings, ...fallback.settings },
    })
    saveResume(migrated)
    return migrated
  } catch (error) {
    console.error('Saved resume data could not be loaded; defaults are being used.', error)
    return fallback
  }
}

export function saveResume(resume: Resume): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resume))
}

export function downloadJson(resume: Resume): void {
  const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'resume.json'
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadAtsText(resume: Resume): void {
  const { profile } = resume
  const lines = [profile.name, profile.title].filter((value) => value.trim())
  const contacts = [profile.phone, profile.email, profile.portfolio, profile.linkedin, profile.location]
    .map((value) => value.trim())
    .filter(Boolean)
  lines.push(...contacts, '')

  for (const section of resume.sections.filter((entry) => entry.enabled)) {
    const heading = section.type === 'summary'
      ? 'SUMMARY'
      : section.type === 'experience'
        ? 'EXPERIENCE'
        : section.type === 'education'
          ? 'EDUCATION'
          : section.heading.trim().toUpperCase()
    if (!heading) continue
    lines.push(heading)

    if (section.type === 'summary') {
      if (profile.summary.trim()) lines.push(profile.summary.trim())
      lines.push('')
      continue
    }

    for (const subsection of section.subsections) {
      if (subsection.heading.trim()) lines.push(subsection.heading.trim().toUpperCase())
      lines.push(...subsection.items.map((item) => item.trim()).filter(Boolean).map((item) => `- ${item}`))
      if (subsection.heading.trim() || subsection.items.some((item) => item.trim())) lines.push('')
    }

    for (const item of section.items) {
      const { fields } = item
      const date = [fields.start, fields.end].filter(Boolean).map(formatResumeDate).join(' - ')
      const title = section.type === 'education'
        ? fields.degree || fields.institution
        : section.type === 'experience'
          ? fields.position || fields.company
          : fields.name || fields.position || fields.degree || fields.company || fields.category
      const organization = section.type === 'education'
        ? fields.degree ? fields.institution : ''
        : section.type === 'experience'
          ? fields.position ? fields.company : ''
          : fields.company
      const entryLine = [title, organization, fields.location, date].filter((value) => value?.trim()).join(' - ')
      if (entryLine) lines.push(entryLine)

      const secondary = section.type === 'education'
        ? fields.grade
        : section.type === 'experience'
          ? ''
          : fields.category && fields.category !== title ? fields.category : ''
      if (secondary?.trim()) lines.push(secondary.trim())

      const handledFields = new Set([
        'degree', 'institution', 'position', 'company', 'name', 'category', 'location', 'start', 'end', 'grade',
        'description', 'technologies', 'technologiesLabel',
      ])
      for (const [key, value] of Object.entries(fields)) {
        if (value.trim() && !handledFields.has(key)) lines.push(`${key}: ${value.trim()}`)
      }
      for (const detail of item.details) {
        if (detail.content.trim()) lines.push(`${detail.label.trim() ? `${detail.label.trim()}: ` : ''}${detail.content.trim()}`)
      }
      if (fields.description?.trim()) lines.push(fields.description.trim())
      lines.push(...item.bullets.map((bullet) => bullet.trim()).filter(Boolean).map((bullet) => `- ${bullet}`))
      if (entryLine || item.bullets.some((bullet) => bullet.trim()) || item.details.some((detail) => detail.content.trim())) lines.push('')
    }
  }

  const blob = new Blob([lines.join('\n').trimEnd() + '\n'], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${profile.name.trim() || 'resume'}-ATS.txt`
  link.click()
  URL.revokeObjectURL(url)
}
