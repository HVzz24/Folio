import type { Resume, ResumeSection } from '../types/resume'

interface ParseDiagnostic {
  title: string
  message: string
  section?: string
  excerpt?: string
}

type ParsedResume = Pick<Resume, 'profile' | 'sections'> & {
  warnings: string[]
  diagnostics: ParseDiagnostic[]
}

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
const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi

function addWarning(
  warnings: string[],
  diagnostics: ParseDiagnostic[],
  title: string,
  message: string,
  section?: string,
  excerpt?: string,
) {
  warnings.push(message)
  diagnostics.push({ title, message, section, excerpt })
}

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
  const text = plainText(value)
  const match = text.match(MONTH_RANGE) ?? text.match(PLAIN_DATE_RANGE)
  if (!match) return { start: '', end: '' }
  const normalize = (date: string) => /^present|current$/i.test(date) ? 'Present' : date
  return { start: normalize(match[1]), end: normalize(match[2]) }
}

function getEntries(lines: string[]): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  let pendingLines: string[] = []
  for (const line of lines) {
    const heading = line.trim().match(/^(?:#{3,6}\s+(.+)|\*\*(.+?)\*\*(?:\s*[—–-]\s*(.+))?\s*:?)$/)
    if (heading) {
      if (!entries.length && pendingLines.some((pending) => pending.trim())) {
        entries.push({ heading: '', lines: pendingLines })
      }
      const value = heading[1] ?? [heading[2], heading[3]].filter(Boolean).join(' — ')
      entries.push({ heading: plainText(value), lines: [] })
    } else if (entries.length) {
      entries[entries.length - 1].lines.push(line)
    } else {
      pendingLines.push(line)
    }
  }
  if (!entries.length && pendingLines.some((line) => line.trim())) {
    entries.push({ heading: '', lines: pendingLines })
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

function isDateLine(line: string): boolean {
  return splitPlainDateRange(plainText(line))?.prefix === ''
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
  const diagnostics: ParseDiagnostic[] = []
  if (!name) addWarning(warnings, diagnostics, 'Name not found', 'Check the first lines of the pasted CV.')
  if (!email) addWarning(warnings, diagnostics, 'Email not found', 'Add or check the email after import.')
  if (!phone) addWarning(warnings, diagnostics, 'Phone number not found', 'Add or check the phone number after import.')
  if (!sections.length) {
    addWarning(
      warnings,
      diagnostics,
      'No common CV sections detected',
      'Check the pasted text and use recognizable section headings.',
    )
  }
  if (urls.some((value) => /github\.com/i.test(value))) {
    addWarning(
      warnings,
      diagnostics,
      'GitHub link cannot be placed in the profile',
      'The editor has no dedicated GitHub profile field, so this link will not appear in the imported resume. Add it manually after import.',
      undefined,
      urls.find((value) => /github\.com/i.test(value)),
    )
  }

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
    diagnostics,
  }
}

function parseGroupedList(section: MarkdownSection): ResumeSection {
  const result = makeSection(section.heading, 'custom')
  let currentGroup: { heading: string; items: string[] } | undefined

  for (const line of section.lines) {
    const value = line.trim()
    if (!value) continue
    const boldLabel = value.match(/^(?:[-*+]\s*)?\*\*(.+?)\*\*\s*:?\s*(.*)$/)
    if (boldLabel) {
      currentGroup = {
        heading: plainText(boldLabel[1]).replace(/:\s*$/, '').trim(),
        items: [],
      }
      result.subsections.push({ id: crypto.randomUUID(), ...currentGroup })
      const content = plainText(boldLabel[2])
      if (content) currentGroup.items.push(...content.split(',').map((item) => item.trim()).filter(Boolean))
      continue
    }

    const standaloneHeading = value.match(/^#{3,6}\s+(.+)$/)
    if (standaloneHeading) {
      currentGroup = { heading: plainText(standaloneHeading[1]), items: [] }
      result.subsections.push({ id: crypto.randomUUID(), ...currentGroup })
      continue
    }

    const bullet = value.match(/^[-*+]\s+(.+)$/)
    if (!bullet) {
      if (!currentGroup) {
        currentGroup = { heading: '', items: [] }
        result.subsections.push({ id: crypto.randomUUID(), ...currentGroup })
      }
      currentGroup.items.push(plainText(value))
      continue
    }

    if (!currentGroup) {
      currentGroup = { heading: '', items: [] }
      result.subsections.push({ id: crypto.randomUUID(), ...currentGroup })
    }
    currentGroup.items.push(plainText(bullet[1]))
  }

  return result
}

function parseStructuredEntries(
  section: MarkdownSection,
  type: 'education' | 'experience' | 'custom',
  warnings: string[],
  diagnostics: ParseDiagnostic[],
): ResumeSection {
  const result = makeSection(section.heading, type)
  const entries = getEntries(section.lines)
  const hasEntryHeadings = section.lines.some((line) => /^(?:\s*#{3,6}\s+|\s*\*\*.+\*\*(?:\s*[—–-]\s*.+)?\s*:?\s*$)/.test(line))
  if (entries.length && (!hasEntryHeadings || entries.some((entry) => !entry.heading))) {
    addWarning(
      warnings,
      diagnostics,
      `Could not split ${section.heading} into separate entries`,
      `The content was kept together as one entry. Add a bold title or Markdown subheading for each item, then review the result.`,
      section.heading,
      section.lines.find((line) => line.trim())?.trim(),
    )
  }

  for (const entry of entries) {
    const details = entry.lines.map(plainText).filter(Boolean)
    const roleLine = details.find((line) => !/^[-*+]\s+/.test(line) && !isDateLine(line))
      ?? ''
    const roleParts = roleLine.split('|').map((part) => plainText(part)).filter(Boolean)
    const dates = parseMonthRange(details.join(' '))
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
      if (headingParts.length >= 3) {
        fields = {
          position: headingParts[0],
          company: headingParts[1],
          location: headingParts.slice(2).join(' — '),
          start: dates.start,
          end: dates.end,
          description: '',
        }
      } else {
        fields = {
          company: headingParts[0] ?? '',
          position: roleOrDegree,
          location,
          start: dates.start,
          end: dates.end,
          description: '',
        }
      }
    } else {
      fields = {
        name: entry.heading || roleOrDegree,
        category: [roleOrDegree, category].filter(Boolean).join(' · '),
      }
    }

    const description = details.filter((line) => (
      !/^[-*+]\s+/.test(line) && !isDateLine(line) && line !== roleLine
    ))
    result.items.push({
      id: crypto.randomUUID(),
      fields,
      bullets,
      details: [],
    })
    if (description.length && result.items.length) {
      result.items[result.items.length - 1].fields.description = description.join('\n')
    }

    const item = result.items[result.items.length - 1]
    if (type === 'education' && (!item.fields.institution || !item.fields.degree)) {
      addWarning(
        warnings,
        diagnostics,
        'Education details may need review',
        'An education entry was detected, but its institution or degree could not be identified confidently.',
        section.heading,
        entry.heading || roleLine,
      )
    } else if (type === 'experience' && (!item.fields.company || !item.fields.position)) {
      addWarning(
        warnings,
        diagnostics,
        'Experience details may need review',
        'An experience entry was detected, but its organization or role could not be identified confidently.',
        section.heading,
        entry.heading || roleLine,
      )
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
  const lines = input.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n')
  const sections: MarkdownSection[] = []
  let currentSection: MarkdownSection | undefined
  let name = ''
  const contactLines: string[] = []
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
    if (!currentSection) {
      contactLines.push(line)
      continue
    }
    currentSection?.lines.push(line)
  }

  const contactLine = contactLines.join(' | ')
  const links = Array.from(contactLine.matchAll(MARKDOWN_LINK), (match) => ({
    label: match[1],
    url: match[2].replace(/[.,;]+$/, ''),
  }))
  const normalizedContact = plainText(contactLine)
  const email = normalizedContact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
  const phone = normalizedContact.match(/(?:\+\d{1,3}[\s().-]*)?(?:\d[\s().-]*){8,}/)?.[0]?.trim() ?? ''
  const linkedin = links.find(({ url, label }) => /linkedin\.com/i.test(url) || /linkedin/i.test(label))?.url
    ?? normalizedContact.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|]+/i)?.[0]?.replace(/[.,;]+$/, '')
    ?? ''
  const portfolio = links.find(({ url, label }) => (
    !/(?:linkedin|github)\.com/i.test(url) && !/linkedin|github/i.test(label)
  ))?.url
    ?? normalizedContact.match(/https?:\/\/(?![^/\s|]*linkedin\.com|[^/\s|]*github\.com)[^\s|]+/i)?.[0]?.replace(/[.,;]+$/, '')
    ?? ''
  const github = links.find(({ url, label }) => /github\.com/i.test(url) || /github/i.test(label))
  const githubUrl = github?.url
    ?? normalizedContact.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|]+/i)?.[0]?.replace(/[.,;]+$/, '')
  const contactParts = normalizedContact.split('|').map(plainText)
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
  const diagnostics: ParseDiagnostic[] = []

  if (!name) addWarning(warnings, diagnostics, 'Name not found', 'Use a level-one heading (# Name) for the name.')
  if (!email) addWarning(warnings, diagnostics, 'Email not found', 'Check that the email appears on the contact line.')
  if (!phone) addWarning(warnings, diagnostics, 'Phone number not found', 'Check that the phone number appears on the contact line.')
  if (!title) {
    addWarning(
      warnings,
      diagnostics,
      'Professional title not inferred',
      'Add the title manually after import, or put it on its own line below the name.',
    )
  }
  if (githubUrl || /\bGitHub\b/i.test(contactLine)) {
    addWarning(
      warnings,
      diagnostics,
      'GitHub link cannot be placed in the profile',
      'The editor has no dedicated GitHub profile field, so this link will not appear in the imported resume. Add it manually after import.',
      undefined,
      githubUrl,
    )
  }
  if (/\bLinkedIn\b/i.test(contactLine) && !linkedin) {
    addWarning(warnings, diagnostics, 'LinkedIn URL not found', 'Add the LinkedIn URL manually after import.')
  }
  if (/\bPortfolio\b/i.test(contactLine) && !portfolio) {
    addWarning(warnings, diagnostics, 'Portfolio URL not found', 'Add the portfolio URL manually after import.')
  }

  const parsedSections: ResumeSection[] = []
  for (const section of sections) {
    const classification = classifySection(section.heading)
    if (classification === 'summary') {
      parsedSections.push(makeSection(section.heading, 'summary'))
      if (!section.lines.some((line) => line.trim())) {
        addWarning(
          warnings,
          diagnostics,
          `No summary text mapped in ${section.heading}`,
          'The summary heading was detected, but the section contains no text.',
          section.heading,
        )
      }
    } else if (classification === 'education') {
      parsedSections.push(parseStructuredEntries(section, 'education', warnings, diagnostics))
    } else if (classification === 'experience') {
      parsedSections.push(parseStructuredEntries(section, 'experience', warnings, diagnostics))
    } else if (classification === 'entries') {
      parsedSections.push(parseStructuredEntries(section, 'custom', warnings, diagnostics))
    } else {
      const parsed = parseGroupedList(section)
      parsedSections.push(parsed)
      if (section.lines.some((line) => line.trim()) && !parsed.subsections.some((subsection) => subsection.items.length)) {
        addWarning(
          warnings,
          diagnostics,
          `No content mapped in ${section.heading}`,
          'The section heading was detected, but no editable content could be extracted.',
          section.heading,
          section.lines.find((line) => line.trim())?.trim(),
        )
      }
    }
  }

  if (!parsedSections.length) {
    addWarning(
      warnings,
      diagnostics,
      'No Markdown CV sections detected',
      'Use level-two headings (##) for sections such as Experience or Education.',
    )
  }

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
    diagnostics,
  }
}

export function parseResumeText(input: string): ParsedResume {
  return input.split(/\r?\n/).some((line) => MARKDOWN_HEADING.test(line.trim()))
    ? parseMarkdownResumeText(input)
    : parsePlainResumeText(input)
}
