import { classifySmtpError, SmtpErrorType } from './smtpService';

describe('SMTP Service Error Classification', () => {
  it('classifies invalid credentials as PERMANENT errors', () => {
    expect(classifySmtpError('Invalid credentials provided')).toBe(SmtpErrorType.PERMANENT);
    expect(classifySmtpError('535 5.7.8 Error: authentication failed')).toBe(SmtpErrorType.PERMANENT);
    expect(classifySmtpError('550 No such user here')).toBe(SmtpErrorType.PERMANENT);
  });

  it('classifies network timeouts as TEMPORARY errors', () => {
    expect(classifySmtpError('ETIMEDOUT connect')).toBe(SmtpErrorType.TEMPORARY);
    expect(classifySmtpError('Connection refused')).toBe(SmtpErrorType.TEMPORARY);
    expect(classifySmtpError('421 Rate limit exceeded')).toBe(SmtpErrorType.TEMPORARY);
  });
});
