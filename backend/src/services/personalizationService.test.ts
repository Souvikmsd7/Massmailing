import { personalizeEmail } from './personalizationService';

describe('Personalization Service', () => {
  const sender = {
    senderName: 'John Doe',
    senderEmail: 'john@example.com',
    phone: '+91 9876543210',
    linkedin: 'https://linkedin.com/in/johndoe',
    portfolio: 'https://johndoe.dev',
  };

  it('replaces all known variables', () => {
    const subject = 'Application for {{job_title}} at {{company}}';
    const body = 'Hi {{name}}, from {{sender_name}}';

    const recipient = {
      name: 'Rahul',
      email: 'rahul@company.com',
      company: 'ABC Tech',
      jobTitle: 'Frontend Developer',
    };

    const result = personalizeEmail(subject, body, recipient, sender);
    expect(result.subject).toBe('Application for Frontend Developer at ABC Tech');
    expect(result.html).toContain('Hi Rahul');
    expect(result.html).toContain('from John Doe');
  });

  it('replaces missing variables with empty string', () => {
    const body = 'Hi {{name}}, your phone is {{phone}}';
    const recipient = { name: 'Rahul', email: 'rahul@example.com' };

    const result = personalizeEmail('Subject', body, recipient, sender);
    expect(result.html).toContain('your phone is');
    expect(result.html).not.toContain('{{phone}}');
  });

  it('sanitizes script tags from body', () => {
    const body = '<p>Hello</p><script>alert("xss")</script>';
    const result = personalizeEmail('Sub', body, { email: 'a@b.com' }, sender);
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('<p>Hello</p>');
  });

  it('sanitizes onclick handlers', () => {
    const body = '<a onclick="steal()">click</a>';
    const result = personalizeEmail('Sub', body, { email: 'a@b.com' }, sender);
    expect(result.html).not.toContain('onclick');
  });
});
