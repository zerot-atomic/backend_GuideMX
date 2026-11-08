import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 15;
const MAX_ATTEMPTS_PER_HOUR = 3;

export type RecoveryAction =
  | 'REQUESTED'
  | 'VERIFIED'
  | 'USED'
  | 'EXPIRED'
  | 'INVALID';

@Injectable()
export class AccountRecoveryService {
  private readonly logger = new Logger(AccountRecoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Solicita recuperación de contraseña.
   * - Genera token seguro, guarda hash en BD, registra auditoría REQUESTED.
   * - Devuelve token EN CLARO solo una vez (para email).
   * - Rate limit: máx 3 peticiones/hora por usuario.
   */
  async requestReset(email: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    // Siempre respondemos OK para no revelar si el email existe (seguridad)
    if (!user) {
      this.logger.warn(`reset-request: email no existe ip=${ip ?? '?'}`);
      await this.audit(null, 'REQUESTED', ip, userAgent, {
        email,
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
        email,
        reason: 'google_only_account',
      });
      return { message: 'Si el correo existe, recibirás instrucciones.' };
    }

    // Rate limit: contar peticiones en la última hora
    const recentRequests = await this.prisma.passwordResetAudit.count({
      where: {
        userId: user.id,
        action: 'REQUESTED',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentRequests >= MAX_ATTEMPTS_PER_HOUR) {
      this.logger.warn(
        `reset-request: rate limit excedido userId=${user.id} ip=${ip ?? '?'}`,
      );
      await this.audit(user.id, 'REQUESTED', ip, userAgent, {
        reason: 'rate_limited',
        attempts: recentRequests,
      });
      throw new BadRequestException(
        'Demasiadas solicitudes. Intenta de nuevo en una hora.',
      );
    }

    // Generar token seguro
    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
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

    // TODO: Enviar email real con rawToken
    // await this.emailService.sendResetEmail(user.email, user.name, rawToken);

    return {
      message: 'Si el correo existe, recibirás instrucciones.',
      // SOLO PARA DESARROLLO/TESTING - eliminar en producción
      devToken: rawToken,
      devExpiresAt: expiresAt.toISOString(),
    };
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