import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
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

  private buildTokenResponse(sub: string, email: string, role: string) {
    const accessToken = this.jwt.sign({ sub, email, role });
    return { accessToken };
  }
}