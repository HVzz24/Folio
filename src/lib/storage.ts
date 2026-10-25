import { resumeSchema, type Resume } from '../types/resume'

const STORAGE_KEY = 'folio-resume-v4'
const LEGACY_STORAGE_KEYS = ['folio-resume-v3', 'folio-resume-v2', 'folio-resume-v1']

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
    const parsed = resumeSchema.parse(JSON.parse(stored))
    if (!migrateDesign) return parsed
    const previousHeadings: Record<string, string[]> = {
      education: ['Education', 'Pendidikan'],
      experience: ['Professional Experience', 'Experiences'],
      projects: ['Projects & Research', 'Projects'],
      additional: ['Additional Information', 'Skills and Certifications'],
    }
    const migrated: Resume = {
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
    }
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
