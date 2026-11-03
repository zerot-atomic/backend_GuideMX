import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient = new OAuth2Client();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('El correo ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash },
    });
    return this.buildTokenResponse(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Los usuarios que solo entran con Google tienen passwordHash = null
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    return this.buildTokenResponse(user.id, user.email, user.role);
  }

  /**
   * Login con Google para la app móvil: recibe el idToken que entrega el paquete
   * google_sign_in, lo verifica contra Google (firma, caducidad y audiencia) y
   * emite el JWT de la app. Cada intento queda en el log.
   */
  async googleMobileLogin(idToken: string, ip?: string) {
    const audience = (process.env.GOOGLE_CLIENT_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (audience.length === 0) {
      this.logger.error('google-login: GOOGLE_CLIENT_ID no está configurado');
      throw new ServiceUnavailableException('Login con Google no configurado');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch (e) {
      this.logger.warn(`google-login FALLIDO ip=${ip ?? '?'} motivo=${(e as Error).message}`);
      throw new UnauthorizedException('Token de Google inválido');
    }

    if (!payload?.sub || !payload.email) {
      this.logger.warn(`google-login FALLIDO ip=${ip ?? '?'} motivo=sin sub/email`);
      throw new UnauthorizedException('Google no devolvió correo');
    }

    try {
      const res = await this.googleLogin({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        emailVerified: payload.email_verified === true,
      });
      this.logger.log(`google-login OK ip=${ip ?? '?'} email=${payload.email}`);
      return res;
    } catch (e) {
      this.logger.warn(`google-login RECHAZADO ip=${ip ?? '?'} email=${payload.email} motivo=${(e as Error).message}`);
      throw e;
    }
  }

  async googleLogin(g: {
    googleId: string;
    email: string;
    name: string;
    emailVerified: boolean;
  }) {
    if (!g.emailVerified) {
      throw new UnauthorizedException('El correo de Google no está verificado');
    }
    const email = g.email.toLowerCase();

    let user = await this.prisma.user.findUnique({
      where: { googleId: g.googleId },
    });

    if (!user) {
      // Busca sin distinguir mayúsculas: register guarda el correo tal cual lo escribió el usuario
      const byEmail = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });

      user = byEmail
        ? await this.prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId: g.googleId },
          })
        : await this.prisma.user.create({
            data: {
              email,
              name: g.name,
              googleId: g.googleId,
              passwordHash: null,
            },
          });
    }

    return this.buildTokenResponse(user.id, user.email, user.role);
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  /**
   * Edita nombre y/o contraseña del usuario logueado.
   * - Cambiar contraseña exige currentPassword, salvo en cuentas creadas solo con
   *   Google (passwordHash = null), que pueden fijar su primera contraseña.
   */
  async updateMe(userId: string, dto: UpdateMeDto) {
    if (dto.name === undefined && dto.newPassword === undefined) {
      throw new BadRequestException('Envía name y/o newPassword');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const data: { name?: string; passwordHash?: string } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();

    if (dto.newPassword !== undefined) {
      if (user.passwordHash) {
        if (!dto.currentPassword) {
          throw new BadRequestException('Falta la contraseña actual');
        }
        const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!ok) throw new UnauthorizedException('La contraseña actual es incorrecta');
      }
      data.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }

  private buildTokenResponse(sub: string, email: string, role: string) {
    const accessToken = this.jwt.sign({ sub, email, role });
    return { accessToken };
  }
}