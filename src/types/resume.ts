import { z } from 'zod'

const profileSchema = z.object({
  name: z.string(),
  title: z.string(),
  phone: z.string(),
  email: z.string(),
  location: z.string(),
  linkedin: z.string(),
  portfolio: z.string(),
  photo: z.string(),
  summaryEnabled: z.boolean().default(true),
  hyperlinksEnabled: z.boolean().default(true),
  summary: z.string(),
})

const itemSchema = z.object({
  id: z.string(),
  fields: z.record(z.string(), z.string()),
  bullets: z.array(z.string()),
})

const subsectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  items: z.array(z.string()),
})

const sectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  enabled: z.boolean(),
  type: z.enum(['education', 'experience', 'projects', 'list', 'custom']),
  items: z.array(itemSchema),
  subsections: z.array(subsectionSchema),
})

export const resumeSchema = z.object({
  profile: profileSchema,
  sections: z.array(sectionSchema),
  settings: z.object({
    pageSize: z.enum(['A4', 'Letter']),
    layout: z.enum(['single', 'two']),
    fontFamily: z.string(),
    nameFontSize: z.number(),
    titleFontSize: z.number(),
    headingFontSize: z.number(),
    subheadingFontSize: z.number(),
    bodyFontSize: z.number(),
    contactFontSize: z.number(),
    lineHeight: z.number(),
    letterSpacing: z.number(),
    marginTop: z.number(),
    marginBottom: z.number(),
    marginSide: z.number(),
    sectionSpacing: z.number(),
    bulletSpacing: z.number(),
    paragraphSpacing: z.number(),
    dividerThickness: z.number(),
    alignment: z.enum(['left', 'center', 'justify']),
    fontWeight: z.enum(['400', '500', '600', '700']),
    showDivider: z.boolean(),
  }),
})

export type Resume = z.infer<typeof resumeSchema>
export type ResumeSection = Resume['sections'][number]
export type ResumeItem = ResumeSection['items'][number]
export type ResumeSubsection = ResumeSection['subsections'][number]
