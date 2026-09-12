import { z } from 'zod';

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const ExperienceSchema = z.object({
  company: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  technologies: z.array(z.string()).optional().default([]),
});

const EducationSchema = z.object({
  institution: z.string().optional().nullable(),
  degree: z.string().optional().nullable(),
  field: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const ProjectSchema = z.object({
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  technologies: z.array(z.string()).optional().default([]),
  url: z.string().optional().nullable(),
});

// ─── Root schema ──────────────────────────────────────────────────────────────

/**
 * Strict Zod schema for Gemini resume parsing output.
 *
 * All fields are optional because resumes vary.
 * The AI must NOT invent information not present in the source text.
 */
export const ParsedResumeSchema = z.object({
  headline: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  skills: z.array(z.string()).optional().default([]),
  experience: z.array(ExperienceSchema).optional().default([]),
  education: z.array(EducationSchema).optional().default([]),
  projects: z.array(ProjectSchema).optional().default([]),
  certifications: z.array(z.string()).optional().default([]),
  yearsOfExperience: z.number().optional().nullable(),
  location: z.string().optional().nullable(),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
export type ResumeExperience = z.infer<typeof ExperienceSchema>;
export type ResumeEducation = z.infer<typeof EducationSchema>;
export type ResumeProject = z.infer<typeof ProjectSchema>;
