import { create } from 'zustand'
import { defaultResume } from '../data/defaultResume'
import { loadResume, normalizeResume, saveResume } from '../lib/storage'
import type { Resume, ResumeItem, ResumeSection, ResumeSubsection } from '../types/resume'

interface ResumeStore {
  resume: Resume
  updateProfile: (field: keyof Resume['profile'], value: string | boolean) => void
  updateSettings: (field: keyof Resume['settings'], value: string | number | boolean) => void
  updateSection: (id: string, update: Partial<ResumeSection>) => void
  updateItem: (sectionId: string, itemId: string, update: Partial<ResumeItem>) => void
  addItem: (sectionId: string) => void
  deleteItem: (sectionId: string, itemId: string) => void
  moveItem: (sectionId: string, itemId: string, direction: -1 | 1) => void
  addBullet: (sectionId: string, itemId: string) => void
  updateBullet: (sectionId: string, itemId: string, bulletIndex: number, value: string) => void
  deleteBullet: (sectionId: string, itemId: string, bulletIndex: number) => void
  moveBullet: (sectionId: string, itemId: string, bulletIndex: number, direction: -1 | 1) => void
  updateSubsection: (sectionId: string, subsectionId: string, update: Partial<ResumeSubsection>) => void
  addSubsection: (sectionId: string) => void
  deleteSubsection: (sectionId: string, subsectionId: string) => void
  moveSubsection: (sectionId: string, subsectionId: string, direction: -1 | 1) => void
  addListItem: (sectionId: string, subsectionId: string) => void
  updateListItem: (sectionId: string, subsectionId: string, itemIndex: number, value: string) => void
  deleteListItem: (sectionId: string, subsectionId: string, itemIndex: number) => void
  moveListItem: (sectionId: string, subsectionId: string, itemIndex: number, direction: -1 | 1) => void
  addSection: (heading: string) => void
  deleteSection: (sectionId: string) => void
  moveSection: (sectionId: string, targetId: string) => void
  replaceResume: (resume: Resume) => void
  resetResume: () => void
}

function editSection(resume: Resume, id: string, fn: (section: ResumeSection) => ResumeSection): Resume {
  return { ...resume, sections: resume.sections.map((section) => (section.id === id ? fn(section) : section)) }
}

function editItem(section: ResumeSection, itemId: string, fn: (item: ResumeItem) => ResumeItem): ResumeSection {
  return { ...section, items: section.items.map((item) => (item.id === itemId ? fn(item) : item)) }
}

function persist(resume: Resume): Resume {
  saveResume(resume)
  return resume
}

const initialResume = loadResume(defaultResume)

export const useResumeStore = create<ResumeStore>((set) => ({
  resume: initialResume,
  updateProfile: (field, value) =>
    set((state) => ({ resume: persist({ ...state.resume, profile: { ...state.resume.profile, [field]: value } }) })),
  updateSettings: (field, value) =>
    set((state) => ({ resume: persist({ ...state.resume, settings: { ...state.resume.settings, [field]: value } }) })),
  updateSection: (id, update) =>
    set((state) => ({ resume: persist(editSection(state.resume, id, (section) => ({ ...section, ...update }))) })),
  updateItem: (sectionId, itemId, update) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => editItem(section, itemId, (item) => ({ ...item, ...update })))),
    })),
  addItem: (sectionId) =>
    set((state) => ({
      resume: persist(
        editSection(state.resume, sectionId, (section) => ({
          ...section,
          items: [
            ...section.items,
            {
              id: crypto.randomUUID(),
              fields:
                section.type === 'education'
                  ? { institution: '', location: '', degree: '', grade: '', start: '', end: '', description: '' }
                  : section.type === 'experience'
                    ? { company: '', position: '', location: '', start: '', end: '', description: '' }
                    : { name: '', category: '', description: '' },
              bullets: [],
              details: [],
            },
          ],
        })),
      ),
    })),
  deleteItem: (sectionId, itemId) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => ({ ...section, items: section.items.filter((item) => item.id !== itemId) }))),
    })),
  moveItem: (sectionId, itemId, direction) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => {
        const items = [...section.items]
        const index = items.findIndex((item) => item.id === itemId)
        const next = index + direction
        if (index >= 0 && next >= 0 && next < items.length) [items[index], items[next]] = [items[next], items[index]]
        return { ...section, items }
      })),
    })),
  addBullet: (sectionId, itemId) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => editItem(section, itemId, (item) => ({ ...item, bullets: [...item.bullets, ''] })))),
    })),
  updateBullet: (sectionId, itemId, bulletIndex, value) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => editItem(section, itemId, (item) => ({
        ...item,
        bullets: item.bullets.map((bullet, index) => index === bulletIndex ? value : bullet),
      })))),
    })),
  deleteBullet: (sectionId, itemId, bulletIndex) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => editItem(section, itemId, (item) => ({
        ...item,
        bullets: item.bullets.filter((_, index) => index !== bulletIndex),
      })))),
    })),
  moveBullet: (sectionId, itemId, bulletIndex, direction) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => editItem(section, itemId, (item) => {
        const bullets = [...item.bullets]
        const target = bulletIndex + direction
        if (target >= 0 && target < bullets.length) [bullets[bulletIndex], bullets[target]] = [bullets[target], bullets[bulletIndex]]
        return { ...item, bullets }
      }))),
    })),
  updateSubsection: (sectionId, subsectionId, update) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => subsection.id === subsectionId ? { ...subsection, ...update } : subsection),
      }))),
    })),
  addSubsection: (sectionId) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => ({
        ...section,
        subsections: [...section.subsections, { id: crypto.randomUUID(), heading: 'New subsection', items: [] }],
      }))),
    })),
  deleteSubsection: (sectionId, subsectionId) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => ({
        ...section,
        subsections: section.subsections.filter((subsection) => subsection.id !== subsectionId),
      }))),
    })),
  moveSubsection: (sectionId, subsectionId, direction) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => {
        const subsections = [...section.subsections]
        const index = subsections.findIndex((subsection) => subsection.id === subsectionId)
        const target = index + direction
        if (target >= 0 && target < subsections.length) [subsections[index], subsections[target]] = [subsections[target], subsections[index]]
        return { ...section, subsections }
      })),
    })),
  addListItem: (sectionId, subsectionId) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => subsection.id === subsectionId ? { ...subsection, items: [...subsection.items, ''] } : subsection),
      }))),
    })),
  updateListItem: (sectionId, subsectionId, itemIndex, value) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => subsection.id === subsectionId
          ? { ...subsection, items: subsection.items.map((item, index) => index === itemIndex ? value : item) }
          : subsection),
      }))),
    })),
  deleteListItem: (sectionId, subsectionId, itemIndex) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => subsection.id === subsectionId
          ? { ...subsection, items: subsection.items.filter((_, index) => index !== itemIndex) }
          : subsection),
      }))),
    })),
  moveListItem: (sectionId, subsectionId, itemIndex, direction) =>
    set((state) => ({
      resume: persist(editSection(state.resume, sectionId, (section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => {
          if (subsection.id !== subsectionId) return subsection
          const items = [...subsection.items]
          const target = itemIndex + direction
          if (target >= 0 && target < items.length) [items[itemIndex], items[target]] = [items[target], items[itemIndex]]
          return { ...subsection, items }
        }),
      }))),
    })),
  addSection: (heading) =>
    set((state) => ({
      resume: persist({
        ...state.resume,
        sections: [...state.resume.sections, {
          id: crypto.randomUUID(), heading, enabled: true, type: 'custom', items: [], subsections: [],
        }],
      }),
    })),
  deleteSection: (sectionId) =>
    set((state) => {
      const section = state.resume.sections.find((item) => item.id === sectionId)
      if (section && ['summary', 'education', 'experience'].includes(section.type)) return state
      return { resume: persist({ ...state.resume, sections: state.resume.sections.filter((item) => item.id !== sectionId) }) }
    }),
  moveSection: (sectionId, targetId) =>
    set((state) => {
      const sections = [...state.resume.sections]
      const sourceIndex = sections.findIndex((section) => section.id === sectionId)
      const targetIndex = sections.findIndex((section) => section.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return state
      const [section] = sections.splice(sourceIndex, 1)
      sections.splice(targetIndex, 0, section)
      return { resume: persist({ ...state.resume, sections }) }
    }),
  replaceResume: (resume) => set({ resume: persist(normalizeResume(resume)) }),
  resetResume: () => set({ resume: persist(structuredClone(defaultResume)) }),
}))
