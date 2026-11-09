import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  constructor(private readonly mailer: MailerService) {}

  async sendResetEmail(to: string, name: string, token: string): Promise<void> {
    await this.mailer.sendMail({
      to,
      subject: 'Código de recuperación de contraseña - MXGuide',
      template: 'reset-password',
      context: {
        name,
        token,
        expiresMinutes: 15,
      },
    });
  }
}