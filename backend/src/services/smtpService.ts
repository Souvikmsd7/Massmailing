import { PrismaClient, ProviderStatus, SmtpAccount } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const DISABLE_DURATION_MS = 15 * 60 * 1000; // 15 minutes temporary disablement

export enum SmtpErrorType {
  TEMPORARY = 'TEMPORARY',
  PERMANENT = 'PERMANENT',
}

export function classifySmtpError(errorMessage: string): SmtpErrorType {
  const msg = errorMessage.toLowerCase();
  // Permanent errors: Auth invalid, recipient unknown/rejected, 5xx codes
  if (
    msg.includes('invalid credentials') ||
    msg.includes('authentication failed') ||
    msg.includes('eauth') ||
    msg.includes('550') ||
    msg.includes('535') ||
    msg.includes('user unknown')
  ) {
    return SmtpErrorType.PERMANENT;
  }
  // Temporary: network timeout, rate limit 421 / 451, socket disconnect
  return SmtpErrorType.TEMPORARY;
}

export async function selectHealthySmtpAccount(userId: string): Promise<SmtpAccount | null> {
  const accounts = await prisma.smtpAccount.findMany({
    where: { userId, isActive: true },
  });

  if (accounts.length === 0) return null;

  const now = new Date();
  const validAccounts: SmtpAccount[] = [];

  for (const account of accounts) {
    // Check if temporary disablement period has expired
    if (account.status === ProviderStatus.DISABLED) {
      if (account.disabledUntil && account.disabledUntil <= now) {
        // Auto-recover provider to ACTIVE
        const recovered = await prisma.smtpAccount.update({
          where: { id: account.id },
          data: {
            status: ProviderStatus.ACTIVE,
            failureCount: 0,
            disabledUntil: null,
          },
        });
        logger.info(`[SMTP Shield] Auto-recovered SMTP account "${recovered.name}" to ACTIVE`, {
          providerId: recovered.id,
        });
        if (recovered.sentToday < recovered.dailyLimit) {
          validAccounts.push(recovered);
        }
      }
      continue;
    }

    if (account.sentToday < account.dailyLimit) {
      validAccounts.push(account);
    }
  }

  if (validAccounts.length === 0) return null;

  // Round-robin selection based on random index among valid healthy accounts
  const randomIndex = Math.floor(Math.random() * validAccounts.length);
  return validAccounts[randomIndex];
}

export async function handleSmtpFailure(accountId: string, errorMessage: string): Promise<void> {
  const errorType = classifySmtpError(errorMessage);
  const account = await prisma.smtpAccount.findUnique({ where: { id: accountId } });
  if (!account) return;

  const newFailureCount = account.failureCount + 1;
  const now = new Date();

  if (errorType === SmtpErrorType.PERMANENT || newFailureCount >= 3) {
    const disabledUntil = new Date(now.getTime() + DISABLE_DURATION_MS);
    await prisma.smtpAccount.update({
      where: { id: accountId },
      data: {
        status: ProviderStatus.DISABLED,
        failureCount: newFailureCount,
        lastFailureAt: now,
        disabledUntil,
      },
    });
    logger.warn(`[SMTP Shield] Temporarily disabling SMTP account "${account.name}"`, {
      providerId: accountId,
      errorType,
      failureCount: newFailureCount,
      disabledUntil: disabledUntil.toISOString(),
    });
  } else {
    await prisma.smtpAccount.update({
      where: { id: accountId },
      data: {
        status: ProviderStatus.DEGRADED,
        failureCount: newFailureCount,
        lastFailureAt: now,
      },
    });
    logger.warn(`[SMTP Shield] Degraded SMTP account "${account.name}"`, {
      providerId: accountId,
      failureCount: newFailureCount,
    });
  }
}

export async function handleSmtpSuccess(accountId: string): Promise<void> {
  await prisma.smtpAccount.update({
    where: { id: accountId },
    data: {
      sentToday: { increment: 1 },
      failureCount: 0,
      status: ProviderStatus.ACTIVE,
    },
  });
}
