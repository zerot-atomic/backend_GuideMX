import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

const TOKEN_LENGTH = 4;
const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TOKEN_TTL_MINUTES = 15;
const MAX_ATTEMPTS_PER_HOUR = 3;
const MAX_ATTEMPTS_PER_IP_PER_HOUR = 5;
const MAX_ATTEMPTS_PER_EMAIL_PER_HOUR = 10;
const BLOCK_DURATION_MINUTES = 15;

export type RecoveryAction =
  | 'REQUESTED'
  | 'VERIFIED'
  | 'USED'
  | 'EXPIRED'
  | 'INVALID';

@Injectable()
export class AccountRecoveryService {
  private readonly logger = new Logger(AccountRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Solicita recuperación de contraseña.
   * - Genera token seguro, guarda hash en BD, registra auditoría REQUESTED.
   * - Devuelve token EN CLARO solo una vez (para email).
   * - Rate limit: máx 3 peticiones/hora por usuario.
   */
  async requestReset(email: string, ip?: string, userAgent?: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    // Rate limit por email (para emails existentes y no existentes) - respuesta directa
    const recentEmailRequests = await this.prisma.passwordResetAudit.count({
      where: {
        details: { path: ['email'], equals: normalizedEmail },
        action: 'REQUESTED',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentEmailRequests >= MAX_ATTEMPTS_PER_EMAIL_PER_HOUR) {
      this.logger.warn(
        `reset-request: rate limit email excedido email=${normalizedEmail} ip=${ip ?? '?'}`,
      );
      await this.audit(user?.id ?? null, 'REQUESTED', ip, userAgent, {
        email: normalizedEmail,
        reason: 'email_rate_limited',
        attempts: recentEmailRequests,
      });
      return {
        message:
          'Demasiadas solicitudes para este correo. Espera 10-15 minutos antes de intentarlo de nuevo.',
        blocked: true,
        retryAfterMinutes: BLOCK_DURATION_MINUTES,
      };
    }

    // Rate limit por IP (para emails inexistentes y existentes)
    const recentIpRequests = await this.prisma.passwordResetAudit.count({
      where: {
        ipAddress: ip,
        action: 'REQUESTED',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentIpRequests >= MAX_ATTEMPTS_PER_IP_PER_HOUR) {
      this.logger.warn(
        `reset-request: rate limit IP excedido ip=${ip ?? '?'}`,
      );
      await this.audit(null, 'REQUESTED', ip, userAgent, {
        email: normalizedEmail,
        reason: 'ip_rate_limited',
        attempts: recentIpRequests,
      });
      throw new BadRequestException(
        'Demasiadas solicitudes desde esta IP. Intenta de nuevo en una hora.',
      );
    }

    // Siempre respondemos OK para no revelar si el email existe (seguridad)
    if (!user) {
      this.logger.warn(`reset-request: email no existe ip=${ip ?? '?'}`);
      await this.audit(null, 'REQUESTED', ip, userAgent, {
        email: normalizedEmail,
        reason: 'user_not_found',
      });
      return { message: 'Si el correo existe, recibirás instrucciones.' };
    }

    // Cuentas solo Google (sin passwordHash) no pueden usar reset por email
    if (!user.passwordHash) {
      this.logger.warn(
        `reset-request: cuenta solo Google ip=${ip ?? '?'} userId=${user.id}`,
      );
      await this.audit(user.id, 'REQUESTED', ip, userAgent, {
        email: normalizedEmail,
        reason: 'google_only_account',
      });
      return { message: 'Si el correo existe, recibirás instrucciones.' };
    }

    // Rate limit por usuario
    const recentUserRequests = await this.prisma.passwordResetAudit.count({
      where: {
        userId: user.id,
        action: 'REQUESTED',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentUserRequests >= MAX_ATTEMPTS_PER_HOUR) {
      this.logger.warn(
        `reset-request: rate limit user excedido userId=${user.id} ip=${ip ?? '?'}`,
      );
      await this.audit(user.id, 'REQUESTED', ip, userAgent, {
        reason: 'rate_limited',
        attempts: recentUserRequests,
      });
      throw new BadRequestException(
        'Demasiadas solicitudes. Intenta de nuevo en una hora.',
      );
    }

    // Generar token alfanumérico de 6 caracteres
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    // Invalidar tokens previos no usados del mismo usuario
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() }, // expira inmediatamente
    });

    // Guardar nuevo token
    const token = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Auditoría REQUESTED
    await this.audit(user.id, 'REQUESTED', ip, userAgent, {
      tokenId: token.id,
      expiresAt: expiresAt.toISOString(),
    });

    this.logger.log(`reset-request: token creado userId=${user.id} tokenId=${token.id}`);

    // Enviar email con token
    try {
      await this.emailService.sendResetEmail(user.email, user.name, rawToken);
      this.logger.log(`reset-request: email enviado userId=${user.id} email=${user.email}`);
    } catch (e) {
      this.logger.error(`reset-request: error enviando email userId=${user.id}`, (e as Error).stack);
      // No fallar la request si falla el email (el token ya está guardado)
    }

    return { message: 'Si el correo existe, recibirás instrucciones.' };
  }

  /**
   * Verifica si un token es válido (sin consumirlo).
   * Registra auditoría VERIFIED o INVALID/EXPIRED.
   */
  async verifyToken(rawToken: string, ip?: string, userAgent?: string) {
    const tokenHash = this.hashToken(rawToken);

    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!token) {
      await this.audit(null, 'INVALID', ip, userAgent, {
        reason: 'token_not_found',
      });
      throw new BadRequestException('Token inválido o expirado.');
    }

    const now = new Date();

    if (token.usedAt) {
      await this.audit(token.userId, 'INVALID', ip, userAgent, {
        tokenId: token.id,
        reason: 'already_used',
        usedAt: token.usedAt.toISOString(),
      });
      throw new BadRequestException('Token ya fue utilizado.');
    }

    if (token.expiresAt < now) {
      await this.audit(token.userId, 'EXPIRED', ip, userAgent, {
        tokenId: token.id,
        expiresAt: token.expiresAt.toISOString(),
      });
      throw new BadRequestException('Token expirado. Solicita uno nuevo.');
    }

    // Token válido
    await this.audit(token.userId, 'VERIFIED', ip, userAgent, {
      tokenId: token.id,
    });

    return {
      valid: true,
      userId: token.userId,
      email: token.user.email,
    };
  }

  /**
   * Cambia la contraseña usando un token válido.
   * Marca token como usado, registra auditoría USED.
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
    ip?: string,
    userAgent?: string,
  ) {
    const tokenHash = this.hashToken(rawToken);

    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!token) {
      await this.audit(null, 'INVALID', ip, userAgent, {
        reason: 'token_not_found',
      });
      throw new BadRequestException('Token inválido o expirado.');
    }

    const now = new Date();

    if (token.usedAt) {
      await this.audit(token.userId, 'INVALID', ip, userAgent, {
        tokenId: token.id,
        reason: 'already_used',
      });
      throw new BadRequestException('Token ya fue utilizado.');
    }

    if (token.expiresAt < now) {
      await this.audit(token.userId, 'EXPIRED', ip, userAgent, {
        tokenId: token.id,
      });
      throw new BadRequestException('Token expirado. Solicita uno nuevo.');
    }

    // Hash nueva contraseña
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Transacción: actualizar user + marcar token usado + auditoría USED
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      });

      await tx.passwordResetAudit.create({
        data: {
          userId: token.userId,
          tokenId: token.id,
          action: 'USED',
          ipAddress: ip,
          userAgent: userAgent,
          details: { passwordChanged: true },
        },
      });
    });

    this.logger.log(`reset-password: completado userId=${token.userId} tokenId=${token.id}`);

    return { message: 'Contraseña actualizada correctamente.' };
  }

  /**
   * Obtiene historial de auditoría para un usuario (admin o el propio usuario).
   */
  async getAuditHistory(userId: string, limit = 50) {
    return this.prisma.passwordResetAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        details: true,
        createdAt: true,
        token: { select: { id: true, expiresAt: true, usedAt: true } },
      },
    });
  }

  /**
   * Limpia tokens expirados (job periódico).
   */
  async cleanupExpiredTokens() {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    this.logger.log(`cleanup: ${result.count} tokens expirados eliminados`);
    return result.count;
  }

  private generateToken(): string {
    let token = '';
    for (let i = 0; i < TOKEN_LENGTH; i++) {
      token += TOKEN_CHARS.charAt(crypto.randomInt(TOKEN_CHARS.length));
    }
    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async audit(
    userId: string | null,
    action: RecoveryAction,
    ip?: string,
    userAgent?: string,
    details?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.passwordResetAudit.create({
        data: {
          userId: userId ?? 'unknown',
          action,
          ipAddress: ip,
          userAgent: userAgent,
          details: details as any,
        },
      });
    } catch (e) {
      // No fallar la request principal si falla auditoría
      this.logger.error('audit failed', (e as Error).stack);
    }
  }
}