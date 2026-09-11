import { Response, Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const generateSchema = z.object({
  role: z.string().min(1).max(200),
  company: z.string().optional().default(''),
  jobDescription: z.string().optional().default(''),
  tone: z.enum(['professional', 'friendly', 'persuasive', 'confident']).optional().default('professional'),
});

// POST /api/ai/generate-pitch
router.post('/generate-pitch', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { role, company, jobDescription, tone } = parsed.data;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      try {
        const prompt = `You are an expert tech recruiter outreach consultant.
Write a personalized cold email pitch for a software professional applying for a "${role}" position at "${company || 'your target company'}".
Tone: ${tone}.
${jobDescription ? `Job Description details:\n${jobDescription}\n` : ''}

Strict requirements:
1. Include dynamic variable tags: {{name}}, {{company}}, {{job_title}}, {{sender_name}}.
2. Return ONLY valid JSON in the following format:
{
  "subject": "Email subject line",
  "body": "Email body content"
}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
            signal: AbortSignal.timeout(8000),
          }
        );

        const aiResponse = (await response.json()) as any;
        const candidates = aiResponse?.candidates;
        if (candidates && candidates[0]?.content?.parts[0]?.text) {
          const text = candidates[0].content.parts[0].text;
          const result = JSON.parse(text);
          res.json({ subject: result.subject, body: result.body, source: 'ai' });
          return;
        }
      } catch (aiErr) {
        console.warn('[AI Pitch] Gemini API fallback triggered:', aiErr instanceof Error ? aiErr.message : aiErr);
      }
    }

    // High-converting Fallback Pitch Generator if AI key not provided or on error
    const companyStr = company ? company : '{{company}}';
    const roleStr = role ? role : '{{job_title}}';

    const fallbackSubjects: Record<string, string> = {
      professional: `Application for ${roleStr} Role – {{name}}`,
      friendly: `Hi {{name}}, excited about the ${roleStr} position at ${companyStr}!`,
      persuasive: `Senior Engineer available for ${roleStr} at ${companyStr}`,
      confident: `${roleStr} Pitch: Driving tech growth at ${companyStr}`,
    };

    const fallbackBodies: Record<string, string> = {
      professional: `Hi {{name}},

I hope you are having a productive week.

I am writing to formally express my interest in the ${roleStr} opportunity at ${companyStr}. With my background in building scalable web applications and distributed systems, I am confident I can add immediate value to your engineering team.

${jobDescription ? `Key Alignment:\n${jobDescription.slice(0, 200)}...\n\n` : ''}I have attached my resume and would welcome the opportunity to discuss how my technical skills align with your upcoming goals at ${companyStr}.

Thank you for your time and consideration.

Best regards,
{{sender_name}}`,
      friendly: `Hi {{name}},

I came across the ${roleStr} opening at ${companyStr} and wanted to reach out directly!

I've been building modern full-stack web applications and love working on high-impact products. I'd love to learn more about what your team is building at ${companyStr} and share how my experience fits into the team.

Attached is my resume for reference.

Looking forward to connecting!

Best,
{{sender_name}}`,
      persuasive: `Hi {{name}},

Are you looking for an experienced engineer to accelerate your team's deliverables for the ${roleStr} position at ${companyStr}?

I bring a track record of building reliable APIs, clean UIs, and high-availability backend services. I am eager to help ${companyStr} scale its tech roadmap.

I'd appreciate 10 minutes for a brief chat. My resume is attached for your review.

Best regards,
{{sender_name}}`,
      confident: `Hi {{name}},

I noticed your open hiring for the ${roleStr} role at ${companyStr}. 

My core expertise spans architecture, frontend optimization, and microservice deployments. I can jump right in and help your team ship feature releases faster and cleaner.

Please find my resume attached. I am ready to discuss next steps at your convenience.

Best regards,
{{sender_name}}`,
    };

    res.json({
      subject: fallbackSubjects[tone] || fallbackSubjects.professional,
      body: fallbackBodies[tone] || fallbackBodies.professional,
      source: 'smart-template',
    });
  } catch (err) {
    console.error('[AI Pitch] Error:', err);
    res.status(500).json({ error: 'Failed to generate pitch' });
  }
});

export default router;
