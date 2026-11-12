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

const PLAIN_DATE_RANGE = /((?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\d{4}))\s*(?:[–—-]|\bto\b)\s*(Present|Current|(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\d{4}))\s*$/i

function normalizedHeading(value: string): string {
  return plainText(value.replace(/^#{1,6}\s*/, '').replace(/:$/, ''))
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function plainSectionType(heading: string): 'summary' | 'education' | 'experience' | 'entries' | 'grouped' | undefined {
  const normalized = normalizedHeading(heading)
  if (/^(summary|professional summary|profile|professional profile|objective|career objective)$/.test(normalized)) return 'summary'
  if (/^(education|academic background)$/.test(normalized)) return 'education'
  if (/^(experience|experiences|professional experience|professional experiences|work experience|work experiences|employment|employment history|work history|career history|internship|internships|volunteer experience|volunteer experiences)$/.test(normalized)) return 'experience'
  if (/^(projects?|selected projects|research|publications)$/.test(normalized)) return 'entries'
  if (/^(skills?|technical skills|core competencies|certificates?|certifications?|certifications and licenses|licenses|languages?|organizations?|professional affiliations|volunteering|awards|achievements|coursework|interests|references|additional information|skills and certifications)$/.test(normalized)) return 'grouped'
  return undefined
}

function looksLikeSectionHeading(line: string): boolean {
  return line.length <= 64 && /^[A-Z][A-Z0-9 &/+'().-]*$/.test(line) && /[A-Z]/.test(line)
}

function splitPlainDateRange(line: string): { prefix: string; start: string; end: string } | undefined {
  const match = line.match(PLAIN_DATE_RANGE)
  if (!match || match.index === undefined) return undefined
  const normalize = (value: string) => /^(present|current)$/i.test(value) ? 'Present' : value.trim()
  return {
    prefix: line.slice(0, match.index).trim().replace(/[|,;–—-]+\s*$/, '').trim(),
    start: normalize(match[1]),
    end: normalize(match[2]),
  }
}

function looksLikeDegree(value: string): boolean {
  return /^(?:b\.?\s?sc\.?|b\.?\s?a\.?|bachelor|b\.?\s?eng\.?|m\.?\s?sc\.?|m\.?\s?a\.?|master|mba|ph\.?\s?d\.?|doctorate|associate|diploma|certificate|software residency)\b/i.test(value.trim())
}

function splitHeaderParts(value: string): string[] {
  return value.split(/\s+(?:[-–—|])\s+/).map((part) => part.trim()).filter(Boolean)
}

function splitOrganizationLocation(value: string): { organization: string; location: string } {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 3) return { organization: parts.slice(0, -2).join(', '), location: parts.slice(-2).join(', ') }
  if (parts.length === 2) return { organization: parts[0], location: parts[1] }
  return { organization: value.trim(), location: '' }
}

function parsePlainEntry(block: string[], type: 'education' | 'experience' | 'custom'): ResumeSection['items'][number] {
  const header = block.find((line) => line.trim())?.trim() ?? ''
  const dated = splitPlainDateRange(header)
  const headerParts = splitHeaderParts(dated?.prefix ?? header)
  const remaining = block.slice(block.indexOf(header) + 1).map((line) => line.trim()).filter(Boolean)
  const bullets = getBullets(remaining)
  const prose = remaining.filter((line) => !/^[-*+]\s+/.test(line)).map(plainText)
  let fields: Record<string, string>

  if (type === 'education') {
    const degreeFirst = headerParts.length >= 3 || (headerParts.length > 1 && looksLikeDegree(headerParts[0]))
    const institution = degreeFirst ? headerParts[1] ?? '' : headerParts[0] ?? ''
    const location = degreeFirst ? headerParts.slice(2).join(' - ') : headerParts.slice(1).join(' - ')
    const degree = degreeFirst ? headerParts[0] : prose.find(looksLikeDegree) ?? ''
    const grade = prose.find((line) => /\b(?:GPA|grade)\b/i.test(line)) ?? ''
    fields = {
      institution,
      location,
      degree,
      grade: grade.replace(/^.*?\b(?:GPA|grade)\s*:?\s*/i, '').trim(),
      start: dated?.start ?? '',
      end: dated?.end ?? '',
      description: prose.filter((line) => line !== degree && line !== grade).join('\n'),
    }
  } else if (type === 'experience') {
    const [first = '', second = '', ...rest] = headerParts
    const companyFirst = /\b(inc\.?|corp\.?|company|llc|ltd\.?|university|hospital|school|agency|foundation|group|studio)\b/i.test(first)
    let position = ''
    let company = ''
    let location = ''
    if (headerParts.length >= 3) {
      [position, company, location] = [first, second, rest.join(' - ')]
    } else if (headerParts.length === 2 && companyFirst) {
      company = first
      location = second
    } else if (headerParts.length >= 2) {
      position = first
      const parsed = splitOrganizationLocation([second, ...rest].join(', '))
      company = parsed.organization
      location = parsed.location
    } else {
      company = first
    }
    if (!position) {
      const roleIndex = prose.findIndex((line) => !/\b(?:GPA|grade)\b/i.test(line))
      if (roleIndex >= 0 && !/^[-*+]\s+/.test(remaining[roleIndex] ?? '')) position = prose[roleIndex]
    }
    fields = {
      company,
      position,
      location,
      start: dated?.start ?? '',
      end: dated?.end ?? '',
      description: prose.filter((line) => line !== position).join('\n'),
    }
  } else {
    fields = {
      name: headerParts[0] ?? header,
      category: prose[0] ?? '',
      description: prose.slice(1).join('\n'),
    }
  }

  return { id: crypto.randomUUID(), fields, bullets, details: [] }
}

function splitPlainEntryBlocks(lines: string[]): string[][] {
  const blocks: string[][] = []
  let current: string[] = []
  const flush = () => {
    if (current.some((line) => line.trim())) blocks.push(current)
    current = []
  }

  for (const line of lines) {
    if (!line.trim()) {
      flush()
      continue
    }
    if (splitPlainDateRange(line) && current.length) flush()
    current.push(line)
  }
  flush()
  return blocks
}

function parsePlainGroupedSection(section: MarkdownSection): ResumeSection {
  const result = makeSection(section.heading, 'custom')
  let currentGroup: { id: string; heading: string; items: string[] } | undefined
  const groupHeadings = new Set(['core competencies', 'technical skills', 'certifications and training', 'certifications', 'languages', 'tools'])

  for (const line of section.lines) {
    const value = line.trim()
    if (!value) continue
    const normalized = normalizedHeading(value)
    if (!/^[-*+]\s+/.test(value) && (groupHeadings.has(normalized) || looksLikeSectionHeading(value))) {
      currentGroup = { id: crypto.randomUUID(), heading: plainText(value), items: [] }
      result.subsections.push(currentGroup)
      continue
    }
    if (!currentGroup) {
      currentGroup = { id: crypto.randomUUID(), heading: '', items: [] }
      result.subsections.push(currentGroup)
    }
    currentGroup.items.push(plainText(value.replace(/^[-*+]\s+/, '')))
  }
  return result
}

function parsePlainResumeText(input: string): ParsedResume {
  const lines = input.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n')
  const firstHeading = lines.findIndex((line) => Boolean(plainSectionType(line.trim())))
  const headerLines = (firstHeading < 0 ? lines : lines.slice(0, firstHeading))
    .map((line) => plainText(line).replace(/^[-*+]\s+/, '').trim())
    .filter(Boolean)
  const contactValues = headerLines.flatMap((line) => line.split(/[|\t]/).map((part) => part.trim()).filter(Boolean))
  const email = contactValues.map((value) => value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]).find(Boolean) ?? ''
  const phone = contactValues.map((value) => {
    const match = value.match(/\+?(?:\(\s*)?\d[\d\s().-]{6,}\d\)?/)?.[0]?.trim()
    return match && (match.match(/\d/g)?.length ?? 0) >= 8 ? match : ''
  }).find(Boolean) ?? ''
  const urls = contactValues.flatMap((value) => value.replace(email, '').match(/(?:https?:\/\/|www\.)[^\s,|]+|(?:linkedin|github)\.com\/[^\s,|]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,|]*)?/gi) ?? [])
  const linkedin = urls.find((value) => /linkedin\.com/i.test(value)) ?? ''
  const portfolio = urls.find((value) => !/(?:linkedin|github)\.com/i.test(value)) ?? ''
  const identityLines = contactValues.filter((value) => (
    !value.includes('@') && !/(?:https?:\/\/|www\.|linkedin\.com|github\.com)/i.test(value)
    && !/(?:\+?\d[\d\s().-]{7,})/.test(value)
  ))
  const name = identityLines[0] ?? ''
  const location = identityLines.find((value) => value !== name && /,/.test(value)) ?? (
    identityLines.length > 2 ? identityLines[identityLines.length - 1] : ''
  )
  const title = identityLines.find((value) => value !== name && value !== location) ?? ''

  const sections: MarkdownSection[] = []
  let currentSection: MarkdownSection | undefined
  for (const rawLine of lines.slice(Math.max(firstHeading, 0))) {
    const line = rawLine.trim()
    if (!line) {
      currentSection?.lines.push('')
      continue
    }
    const heading = plainText(line.replace(/^#{1,6}\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1')).replace(/:$/, '').trim()
    const type = plainSectionType(heading)
    const normalized = normalizedHeading(heading)
    const nestedHeading = currentSection && /skills|certification/i.test(currentSection.heading)
      && /^(core competencies|technical skills|certifications and training|certifications|languages|tools)$/.test(normalized)
    if (type && !nestedHeading) {
      currentSection = { heading, lines: [] }
      sections.push(currentSection)
      continue
    }
    currentSection?.lines.push(line)
  }

  const summarySection = sections.find((section) => plainSectionType(section.heading) === 'summary')
  const summary = summarySection?.lines.map(plainText).filter(Boolean).join('\n') ?? ''
  const parsedSections = sections.map((section) => {
    const type = plainSectionType(section.heading)
    if (type === 'summary') return makeSection(section.heading, 'summary')
    if (type === 'education' || type === 'experience' || type === 'entries') {
      const itemType = type === 'entries' ? 'custom' : type
      const result = makeSection(section.heading, itemType)
      result.items = splitPlainEntryBlocks(section.lines).map((block) => parsePlainEntry(block, itemType))
      return result
    }
    return parsePlainGroupedSection(section)
  })

  const warnings: string[] = []
  if (!name) warnings.push('Name not found. Check the first lines of the pasted CV.')
  if (!email) warnings.push('Email not found. Add or check it after import.')
  if (!phone) warnings.push('Phone number not found. Add or check it after import.')
  if (!sections.length) warnings.push('No common CV section headings were detected. Check the pasted text and section names.')
  if (urls.some((value) => /github\.com/i.test(value))) warnings.push('GitHub has no separate profile field, so its link was not imported.')

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
  const plainType = plainSectionType(heading)
  if (plainType) return plainType
  const normalized = heading.toLowerCase()
  if (/\b(summary|profile|objective)\b/.test(normalized)) return 'summary'
  if (/\beducation\b/.test(normalized)) return 'education'
  if (/\bresearch\b/.test(normalized)) return 'entries'
  if (/\b(research|professional|work)\s+experience\b/.test(normalized) || /\bemployment history\b/.test(normalized)) return 'experience'
  if (/\b(projects?|research)\b/.test(normalized)) return 'entries'
  return 'grouped'
}

function parseMarkdownResumeText(input: string): ParsedResume {
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

export function parseResumeText(input: string): ParsedResume {
  return input.split(/\r?\n/).some((line) => MARKDOWN_HEADING.test(line.trim()))
    ? parseMarkdownResumeText(input)
    : parsePlainResumeText(input)
}
