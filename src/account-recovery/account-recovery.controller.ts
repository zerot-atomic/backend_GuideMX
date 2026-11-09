import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AccountRecoveryService } from './account-recovery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class RequestResetDto {
  @IsEmail()
  email!: string;
}

class VerifyTokenDto {
  @IsString()
  @MinLength(1)
  token!: string;
}

class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

@Controller('account-recovery')
export class AccountRecoveryController {
  constructor(private readonly recovery: AccountRecoveryService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  async requestReset(
    @Body() dto: RequestResetDto,
    @Request() req: any,
    @Headers('x-forwarded-for') forwardedFor?: string,
  ) {
    const ip = this.getClientIp(req, forwardedFor);
    return this.recovery.requestReset(dto.email, ip, req.headers['user-agent']);
  }

  private getClientIp(req: any, forwardedFor?: string): string {
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }
    return req.ip || 'unknown';
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyToken(
    @Body() dto: VerifyTokenDto,
    @Request() req: any,
    @Headers('x-forwarded-for') forwardedFor?: string,
  ) {
    const ip = this.getClientIp(req, forwardedFor);
    return this.recovery.verifyToken(dto.token, ip, req.headers['user-agent']);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Request() req: any,
    @Headers('x-forwarded-for') forwardedFor?: string,
  ) {
    const ip = this.getClientIp(req, forwardedFor);
    return this.recovery.resetPassword(
      dto.token,
      dto.newPassword,
      ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('audit')
  async getAuditHistory(@Request() req: any, @Query('limit') limit?: number) {
    return this.recovery.getAuditHistory(req.user.userId, limit ? Number(limit) : 50);
  }
}