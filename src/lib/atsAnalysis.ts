import type { Resume } from '../types/resume'

export type AtsAnalysis = {
  overall: number
  passed: boolean
  scores: {
    keywords: number
    skills: number
    experience: number
    formatting: number
  }
  missingKeywords: string[]
  missingSkills: string[]
  missingActionVerbs: string[]
  suggestions: string[]
  formatChecks: string[]
  keywordCount: number
  skillCount: number
}

const STOP_WORDS = new Set(
  'a an and are as at be by for from has have in into is it its of on or our that the their this to was with will you your who what we they responsible responsibility role work working using use including strong excellent preferred required requirements job candidate qualifications qualification duties years ability team teams position looking needed'.split(' '),
)

const TECHNICAL_SKILLS = [
  'accessibility', 'agile', 'analytics', 'angular', 'aws', 'azure', 'bigquery', 'business analysis',
  'business intelligence', 'c#', 'c++', 'ci cd', 'cloud computing', 'css', 'data analysis',
  'data engineering', 'data modeling', 'data science', 'data visualization', 'databricks', 'docker',
  'excel', 'figma', 'firebase', 'git', 'github', 'gcp', 'html', 'java', 'javascript', 'jenkins',
  'jira', 'kotlin', 'kubernetes', 'machine learning', 'matlab', 'microsoft 365', 'mongodb',
  'mysql', 'node js', 'nosql', 'oracle', 'php', 'power bi', 'postgresql', 'powerpoint',
  'project management', 'python', 'pytorch', 'react', 'rest api', 'ruby', 'rust', 'salesforce',
  'scikit learn', 'scrum', 'snowflake', 'software development', 'software testing', 'spark', 'sql',
  'tableau', 'tensorflow', 'terraform', 'typescript', ' UX ', ' UI ', 'user research', 'vba',
  'visual studio', 'vue', 'wordpress', 'workday',
]

const SKILL_ALIASES: Record<string, string[]> = {
  'business intelligence': ['business intelligence', 'bi'],
  'c#': ['c#', 'c sharp', 'csharp'],
  'c++': ['c++', 'c plus plus'],
  'ci cd': ['ci cd', 'ci/cd', 'continuous integration', 'continuous delivery'],
  'data analysis': ['data analysis', 'data analytics', 'analyzing data', 'analyse data'],
  'git': ['git'],
  'github': ['github', 'git hub'],
  'javascript': ['javascript', 'java script'],
  'machine learning': ['machine learning', 'ml'],
  'mysql': ['mysql', 'my sql'],
  'node js': ['node js', 'nodejs'],
  'power bi': ['power bi', 'powerbi'],
  'react': ['react', 'react js', 'reactjs'],
  'rest api': ['rest api', 'rest apis', 'restful api', 'restful apis'],
  'scikit learn': ['scikit learn', 'scikitlearn', 'sklearn'],
  'sql': ['sql', 'mysql', 'my sql', 'postgresql', 'postgre sql', 'postgres', 'mariadb'],
  'typescript': ['typescript', 'type script'],
  'user research': ['user research', 'ux research'],
  'wordpress': ['wordpress', 'word press'],
}

const ACTION_VERBS: { label: string; forms: string[] }[] = [
  { label: 'analyze', forms: ['analyze', 'analyzes', 'analyzing', 'analyzed'] },
  { label: 'automate', forms: ['automate', 'automates', 'automating', 'automated'] },
  { label: 'build', forms: ['build', 'builds', 'building', 'built'] },
  { label: 'coach', forms: ['coach', 'coaches', 'coaching', 'coached'] },
  { label: 'collaborate', forms: ['collaborate', 'collaborates', 'collaborating', 'collaborated'] },
  { label: 'communicate', forms: ['communicate', 'communicates', 'communicating', 'communicated'] },
  { label: 'coordinate', forms: ['coordinate', 'coordinates', 'coordinating', 'coordinated'] },
  { label: 'create', forms: ['create', 'creates', 'creating', 'created'] },
  { label: 'deliver', forms: ['deliver', 'delivers', 'delivering', 'delivered'] },
  { label: 'design', forms: ['design', 'designs', 'designing', 'designed'] },
  { label: 'develop', forms: ['develop', 'develops', 'developing', 'developed'] },
  { label: 'drive', forms: ['drive', 'drives', 'driving', 'drove'] },
  { label: 'establish', forms: ['establish', 'establishes', 'establishing', 'established'] },
  { label: 'evaluate', forms: ['evaluate', 'evaluates', 'evaluating', 'evaluated'] },
  { label: 'implement', forms: ['implement', 'implements', 'implementing', 'implemented'] },
  { label: 'improve', forms: ['improve', 'improves', 'improving', 'improved'] },
  { label: 'increase', forms: ['increase', 'increases', 'increasing', 'increased'] },
  { label: 'lead', forms: ['lead', 'leads', 'leading', 'led'] },
  { label: 'launch', forms: ['launch', 'launches', 'launching', 'launched'] },
  { label: 'manage', forms: ['manage', 'manages', 'managing', 'managed'] },
  { label: 'measure', forms: ['measure', 'measures', 'measuring', 'measured'] },
  { label: 'optimize', forms: ['optimize', 'optimizes', 'optimizing', 'optimized'] },
  { label: 'organize', forms: ['organize', 'organizes', 'organizing', 'organized'] },
  { label: 'present', forms: ['present', 'presents', 'presenting', 'presented'] },
  { label: 'reduce', forms: ['reduce', 'reduces', 'reducing', 'reduced'] },
  { label: 'resolve', forms: ['resolve', 'resolves', 'resolving', 'resolved'] },
  { label: 'streamline', forms: ['streamline', 'streamlines', 'streamlining', 'streamlined'] },
  { label: 'support', forms: ['support', 'supports', 'supporting', 'supported'] },
  { label: 'train', forms: ['train', 'trains', 'training', 'trained'] },
  { label: 'transform', forms: ['transform', 'transforms', 'transforming', 'transformed'] },
]

function normalize(value: string): string {
  return value.toLowerCase()
    .replace(/react\.js/g, 'react js')
    .replace(/\.net/g, ' dot net ')
    .replace(/\//g, ' ')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function termVariants(term: string): string[] {
  const normalized = normalize(term)
  const skill = TECHNICAL_SKILLS.find((candidate) => {
    const aliases = SKILL_ALIASES[candidate] ?? [candidate]
    return aliases.some((alias) => normalize(alias) === normalized)
  }) ?? normalized
  return [...new Set((SKILL_ALIASES[skill] ?? [skill]).map(normalize).filter(Boolean))]
}

function containsTerm(text: string, term: string): boolean {
  const haystack = ` ${normalize(text)} `
  return termVariants(term).some((variant) => haystack.includes(` ${variant} `))
}

function getDetectedSkills(text: string): string[] {
  return TECHNICAL_SKILLS.filter((skill) => containsTerm(text, skill))
}

function getResumeText(resume: Resume): { all: string; experience: string } {
  const profile = resume.profile
  const parts = [
    profile.name, profile.title, profile.email, profile.phone, profile.location,
    profile.linkedin, profile.portfolio, profile.summaryEnabled ? profile.summary : '',
  ]
  const experienceParts: string[] = []

  for (const section of resume.sections.filter((item) => item.enabled)) {
    parts.push(section.heading)
    for (const subsection of section.subsections) {
      parts.push(subsection.heading, ...subsection.items)
    }
    for (const item of section.items) {
      const entryText = [...Object.values(item.fields), ...item.bullets].join(' ')
      parts.push(entryText)
      if (section.type === 'experience' || section.type === 'projects') experienceParts.push(entryText)
    }
  }

  return { all: parts.join(' '), experience: experienceParts.join(' ') }
}

function getJobKeywords(jobDescription: string, jobTitle: string): string[] {
  const normalizedDescription = normalize(`${jobTitle} ${jobDescription}`)
  const tokens = normalizedDescription.split(' ').filter(Boolean)
  const skillMatches = getDetectedSkills(normalizedDescription)
  const skillWords = new Set(skillMatches.flatMap((skill) => normalize(skill).split(' ')))
  const actionWords = new Set(ACTION_VERBS.flatMap(({ forms }) => forms))
  const wordCounts = new Map<string, number>()
  for (const token of tokens) {
    if (token.length < 3 || STOP_WORDS.has(token) || skillWords.has(token) || actionWords.has(token)) continue
    wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1)
  }
  const jobWords = [...wordCounts.keys()].sort((left, right) => (
    (wordCounts.get(right) ?? 0) - (wordCounts.get(left) ?? 0) || right.length - left.length
  ))
  const titlePhrase = normalize(jobTitle)
  return [...new Set([
    ...skillMatches,
    ...(titlePhrase.includes(' ') ? [titlePhrase] : []),
    ...jobWords,
  ])].slice(0, 20)
}

function scoreCoverage(terms: string[], text: string, skills: string[] = []): number {
  if (terms.length === 0) return 0
  const totalWeight = terms.reduce((sum, term) => sum + (skills.includes(term) ? 2 : 1), 0)
  const matchedWeight = terms.reduce((sum, term) => (
    sum + (containsTerm(text, term) ? (skills.includes(term) ? 2 : 1) : 0)
  ), 0)
  return Math.round((matchedWeight / totalWeight) * 100)
}

function getFormattingChecks(resume: Resume): { score: number; checks: string[] } {
  const enabledSections = resume.sections.filter((section) => section.enabled)
  const hasBullets = enabledSections.some((section) => section.items.some((item) => item.bullets.some((bullet) => bullet.trim())))
  const checks = [
    resume.profile.name.trim() ? 'Name is present.' : 'Add your name to the profile.',
    resume.profile.email.trim() || resume.profile.phone.trim() ? 'At least one contact method is present.' : 'Add an email address or phone number.',
    resume.settings.layout === 'single' ? 'Single-column layout is selected.' : 'Switch to a single-column layout for simpler ATS parsing.',
    enabledSections.length > 0 ? 'Resume sections are enabled and structured.' : 'Enable at least one resume section.',
    hasBullets ? 'Experience or project bullet points are present.' : 'Add concise bullet points to describe your work.',
  ]
  const points = [
    Boolean(resume.profile.name.trim()),
    Boolean(resume.profile.email.trim() || resume.profile.phone.trim()),
    resume.settings.layout === 'single',
    enabledSections.length > 0,
    hasBullets,
  ].filter(Boolean).length
  return { score: points * 4, checks }
}

export function analyzeResume(resume: Resume, jobTitle: string, jobDescription: string): AtsAnalysis {
  const resumeText = getResumeText(resume)
  const jobKeywords = getJobKeywords(jobDescription, jobTitle)
  const skillsInJob = getDetectedSkills(`${jobTitle} ${jobDescription}`)
  const skillsForScoring = skillsInJob.length > 0 ? skillsInJob : jobKeywords
  const keywordScore = Math.round(scoreCoverage(jobKeywords, resumeText.all, skillsInJob) * 0.3)
  const skillScore = Math.round(scoreCoverage(skillsForScoring, resumeText.all, skillsInJob) * 0.3)
  const experienceScore = Math.round(scoreCoverage(jobKeywords, resumeText.experience, skillsInJob) * 0.2)
  const formatting = getFormattingChecks(resume)
  const scoreKeywords = (terms: string[]) => terms.filter((term) => !containsTerm(resumeText.all, term))
  const missingKeywords = scoreKeywords(jobKeywords)
  const missingSkills = scoreKeywords(skillsInJob)
  const normalizedJobText = normalize(`${jobTitle} ${jobDescription}`)
  const missingActionVerbs = ACTION_VERBS
    .filter(({ forms }) => (
      forms.some((form) => containsTerm(normalizedJobText, form))
      && !forms.some((form) => containsTerm(resumeText.all, form))
    ))
    .map(({ label }) => label)
    .slice(0, 8)
  const suggestions: string[] = []

  if (missingKeywords.length > 0) {
    suggestions.push(`If accurate, add relevant wording such as “${missingKeywords.slice(0, 2).join('” and “')}” to the most relevant CV sections.`)
  }
  if (!resume.profile.summary.trim()) {
    suggestions.push('Add a short, role-specific summary that connects your actual background to the position.')
  } else {
    suggestions.push('Tailor the existing summary to the role using only skills and experience you can substantiate.')
  }
  if (resume.settings.layout !== 'single') {
    suggestions.push('Use the single-column layout to make the document structure easier for ATS parsers to follow.')
  } else if (!resumeText.experience.match(/\b\d+(?:\.\d+)?%?\b/)) {
    suggestions.push('Where truthful, add measurable outcomes to experience bullets to make impact clearer.')
  } else {
    suggestions.push('Keep experience bullets focused on actions and outcomes, and quantify results where you can.')
  }

  const overall = Math.min(100, keywordScore + skillScore + experienceScore + formatting.score)
  return {
    overall,
    passed: overall >= 80,
    scores: { keywords: keywordScore, skills: skillScore, experience: experienceScore, formatting: formatting.score },
    missingKeywords: missingKeywords.slice(0, 5),
    missingSkills: missingSkills.slice(0, 10),
    missingActionVerbs,
    suggestions: suggestions.slice(0, 3),
    formatChecks: formatting.checks,
    keywordCount: jobKeywords.length,
    skillCount: skillsInJob.length,
  }
}
