import { DocumentType } from '../../document-generator/enums/document-type.enum';

export interface WelcomeMessageContext {
  name?: string;
  hasBasicInfo?: boolean;
  documentType?: DocumentType;
  hasJobDescription?: boolean;
}

export function getCareerProfileWelcome(): string {
  return `Hi Dreamer! Welcome to your career profile.

I'll help you discover and articulate your career goals, work style, and professional background through a natural conversation.

**Here's how it works:**
- I'll ask one question at a time — just answer in your own words
- You can upload your CV anytime to speed things up
- When we have enough, click **Generate Profile Summary** below

What job title or type of position are you targeting?`;
}

export function getCvUploadConfirmation(): string {
  return `Great — I've uploaded and analyzed your CV. I'll use what I found to personalize our conversation and avoid asking for details you already shared.

**Here's what happens next:**
- I'll reference your experience naturally as we chat
- You can still add or correct anything at any time
- When you're ready, click **Generate Profile Summary** below

Is there anything else you'd like me to know about your career journey?`;
}

export function getResumeBuilderWelcome(ctx: WelcomeMessageContext): string {
  const name = ctx.name?.trim();

  if (ctx.hasBasicInfo && name) {
    return `Hi ${name}! Welcome to the CV Builder.

I'll help you create an ATS-friendly, achievement-driven resume through a natural conversation. I already have some of your basic information, so we can jump straight into building your experience.

**Here's how it works:**
- I'll ask one question at a time — just answer in your own words
- Say "skip" anytime to move to the next section
- When we have enough, click **Generate Resume** below

Let's start with your most recent role — which company did you work at?`;
  }

  return `Welcome to the CV Builder!

I'll help you create an ATS-friendly, achievement-driven resume through a natural conversation.

**Here's how it works:**
- I'll ask one question at a time — just answer in your own words
- Say "skip" anytime to move to the next section
- When we have enough, click **Generate Resume** below

What is your full name as you want it shown on your CV?`;
}

export function getDocumentGeneratorWelcome(
  ctx: WelcomeMessageContext,
): string {
  const name = ctx.name?.trim() || 'there';

  if (ctx.documentType === DocumentType.CoverLetter) {
    if (ctx.hasJobDescription) {
      return `Hi ${name}! Welcome to the Cover Letter Builder.

I see you've provided a job description. I'll analyze it and use your past resumes and profile to tailor a compelling cover letter for you.

**Here's how it works:**
- I'll ask one question at a time to fill any gaps
- Tell me if there are specific achievements you want highlighted
- When we have enough, I'll draft your cover letter

What role and company is this cover letter for?`;
    }

    return `Hi ${name}! Welcome to the Cover Letter Builder.

I'll draft a strong, tailored cover letter using what I already know about you.

**Here's how it works:**
- I'll ask one question at a time — just answer in your own words
- Share the job description if you have it — it makes the letter sharper
- When we have enough, I'll draft your cover letter

What role and company are you targeting?`;
  }

  return `Hi ${name}! Welcome to the Personal Statement Builder.

I'll help you craft a powerful, authentic personal statement through a thoughtful conversation.

**Here's how it works:**
- I'll ask one question at a time — just answer in your own words
- Share the experiences and goals that matter most to you
- When we have enough, I'll draft your personal statement

What is the purpose of this personal statement — for example, a graduate school application, scholarship, or program admission?`;
}
