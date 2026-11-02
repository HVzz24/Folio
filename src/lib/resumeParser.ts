import type { Resume, ResumeSection } from '../types/resume'

type ParsedResume = Pick<Resume, 'profile' | 'sections'> & { warnings: string[] }

interface MarkdownSection {
  heading: string
  lines: string[]
}

interface ParsedEntry {
  heading: string
  lines: string[]
}

const MARKDOWN_HEADING = /^(#{1,6})\s+(.+?)\s*$/
const MONTH_RANGE = /([A-Za-z]{3,9}\s+\d{4})\s*[–—-]\s*(Present|Current|[A-Za-z]{3,9}\s+\d{4})/i

function plainText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$2')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function makeSection(heading: string, type: ResumeSection['type']): ResumeSection {
  return { id: crypto.randomUUID(), heading, enabled: true, type, items: [], subsections: [] }
}

function parseMonthRange(value: string): { start: string; end: string } {
  const match = plainText(value).match(MONTH_RANGE)
  if (!match) return { start: '', end: '' }
  const normalize = (date: string) => /^present|current$/i.test(date) ? 'Present' : date
  return { start: normalize(match[1]), end: normalize(match[2]) }
}

function getEntries(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  for (const line of lines) {
    const heading = line.match(/^###\s+(.+)$/)
    if (heading) {
      entries.push({ heading: plainText(heading[1]), lines: [] })
    } else if (entries.length) {
      entries[entries.length - 1].lines.push(line)
    }
  }
  return entries
}

function getBullets(lines: string[]): string[] {
  return lines.flatMap((line) => {
    const match = line.trim().match(/^[-*+]\s+(.+)$/)
    return match ? [plainText(match[1])] : []
  })
}

function parseGroupedList(section: MarkdownSection): ResumeSection {
  const result = makeSection(section.heading, 'custom')
  let currentGroup: { heading: string; items: string[] } | undefined

  for (const line of section.lines) {
    const bullet = line.trim().match(/^[-*+]\s+(.+)$/)
    if (!bullet) continue
    const text = plainText(bullet[1])
    const labelMatch = text.match(/^(.+?):\s*(.*)$/)
    if (labelMatch && /^\*\*/.test(bullet[1])) {
      currentGroup = { heading: labelMatch[1].trim(), items: [] }
      result.subsections.push({ id: crypto.randomUUID(), ...currentGroup })
      if (labelMatch[2]) {
        currentGroup.items.push(...labelMatch[2].split(',').map((item) => item.trim()).filter(Boolean))
      }
    } else {
      if (!currentGroup) {
        currentGroup = { heading: '', items: [] }
        result.subsections.push({ id: crypto.randomUUID(), ...currentGroup })
      }
      currentGroup.items.push(text)
    }
  }

  return result
}

function parseStructuredEntries(section: MarkdownSection, type: 'education' | 'experience' | 'custom'): ResumeSection {
  const result = makeSection(section.heading, type)
  for (const entry of getEntries(section.lines)) {
    const details = entry.lines.map(plainText).filter(Boolean)
    const roleLine = details.find((line) => line.includes('|'))
      ?? details.find((line) => !line.startsWith('-') && !line.startsWith('*'))
      ?? ''
    const roleParts = roleLine.split('|').map((part) => plainText(part)).filter(Boolean)
    const dates = parseMonthRange(roleLine || details.join(' '))
    const bullets = getBullets(entry.lines)
    const headingParts = entry.heading.split(/\s+[—–]\s+/).map((part) => part.trim())
    const location = headingParts.length > 1 ? headingParts.slice(1).join(' — ') : ''
    const roleOrDegree = roleParts[0] ?? ''
    const grade = roleParts.find((part) => /GPA:/i.test(part))?.replace(/^.*?GPA:\s*/i, '').trim() ?? ''
    const category = roleParts.slice(1).filter((part) => !MONTH_RANGE.test(part)).join(' · ')

    let fields: Record<string, string>
    if (type === 'education') {
      fields = {
        institution: headingParts[0],
        location,
        degree: roleOrDegree.replace(/\s*\|\s*GPA:.+$/i, '').trim(),
        grade,
        start: dates.start,
        end: dates.end,
        description: '',
      }
    } else if (type === 'experience') {
      fields = {
        company: headingParts[0],
        position: roleOrDegree,
        location,
        start: dates.start,
        end: dates.end,
        description: '',
      }
    } else {
      fields = {
        name: headingParts[0],
        category: [roleOrDegree, category].filter(Boolean).join(' · '),
      }
    }

    const description = details.filter((line) => !line.startsWith('-') && !line.startsWith('*') && line !== roleLine)
    result.items.push({
      id: crypto.randomUUID(),
      fields,
      bullets,
      details: [],
    })
    if (description.length && result.items.length) {
      result.items[result.items.length - 1].fields.description = description.join('\n')
    }
  }
  return result
}

function classifySection(heading: string): 'summary' | 'education' | 'experience' | 'entries' | 'grouped' {
  const normalized = heading.toLowerCase()
  if (/\b(summary|profile|objective)\b/.test(normalized)) return 'summary'
  if (/\beducation\b/.test(normalized)) return 'education'
  if (/\bresearch\b/.test(normalized)) return 'entries'
  if (/\b(research|professional|work)\s+experience\b/.test(normalized) || /\bemployment history\b/.test(normalized)) return 'experience'
  if (/\b(projects?|research)\b/.test(normalized)) return 'entries'
  return 'grouped'
}

export function parseResumeText(input: string): ParsedResume {
  const lines = input.replace(/\r\n/g, '\n').split('\n')
  const sections: MarkdownSection[] = []
  let currentSection: MarkdownSection | undefined
  let name = ''
  let contactLine = ''
  let foundFirstHeading = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const heading = line.match(MARKDOWN_HEADING)
    if (heading && heading[1].length === 1 && !foundFirstHeading) {
      name = plainText(heading[2])
      foundFirstHeading = true
      continue
    }
    if (heading && heading[1].length === 2) {
      currentSection = { heading: plainText(heading[2]), lines: [] }
      sections.push(currentSection)
      continue
    }
    if (!currentSection && !contactLine) {
      contactLine = line
      continue
    }
    currentSection?.lines.push(line)
  }

  const email = contactLine.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
  const phone = contactLine.match(/(?:\+\d{1,3}[\s().-]*)?(?:\d[\s().-]*){8,}/)?.[0]?.trim() ?? ''
  const linkedin = contactLine.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|]+/i)?.[0] ?? ''
  const portfolio = contactLine.match(/https?:\/\/(?![^/\s|]*linkedin\.com|[^/\s|]*github\.com)[^\s|]+/i)?.[0] ?? ''
  const contactParts = contactLine.split('|').map(plainText)
  const location = contactParts.find((part) => (
    part && !part.includes('@') && !/\d{7,}/.test(part) && !/https?:\/\//i.test(part)
    && !/\b(linkedin|portfolio|github)\b/i.test(part)
  )) ?? ''
  const summarySection = sections.find((section) => classifySection(section.heading) === 'summary')
  const summary = summarySection
    ? summarySection.lines.map(plainText).filter(Boolean).join('\n')
    : ''
  const title = summary.match(/^(?:results-driven\s+)?(.+?)\s+(?:holding|with|seeking)\b/i)?.[1]?.trim() ?? ''
  const warnings: string[] = []

  if (!name) warnings.push('Name not found. Use a level-one heading (# Name) for the name.')
  if (!email) warnings.push('Email not found in the contact line.')
  if (!phone) warnings.push('Phone number not found in the contact line.')
  if (!title) warnings.push('Could not infer a professional title from the summary. Add it manually after import.')
  if (/\bGitHub\b/i.test(contactLine)) warnings.push('GitHub has no separate field in the editor, so its link was not imported.')
  if (/\bLinkedIn\b/i.test(contactLine) && !linkedin) warnings.push('LinkedIn is listed without a URL, so add its link manually after import.')
  if (/\bPortfolio\b/i.test(contactLine) && !portfolio) warnings.push('Portfolio is listed without a URL, so add its link manually after import.')

  const parsedSections: ResumeSection[] = []
  for (const section of sections) {
    const classification = classifySection(section.heading)
    if (classification === 'summary') {
      parsedSections.push(makeSection(section.heading, 'summary'))
    } else if (classification === 'education') {
      parsedSections.push(parseStructuredEntries(section, 'education'))
    } else if (classification === 'experience') {
      parsedSections.push(parseStructuredEntries(section, 'experience'))
    } else if (classification === 'entries') {
      parsedSections.push(parseStructuredEntries(section, 'custom'))
    } else {
      parsedSections.push(parseGroupedList(section))
    }
  }

  if (!parsedSections.length) warnings.push('No Markdown CV sections were detected. Use headings such as ## Experience.')

  return {
    profile: {
      name,
      title,
      phone,
      email,
      location,
      linkedin,
      portfolio,
      photo: '',
      summaryEnabled: true,
      hyperlinksEnabled: true,
      summary,
    },
    sections: parsedSections,
    warnings,
  }
}
