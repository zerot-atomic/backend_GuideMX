import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { VisitsService } from './visits.service';
import { RegisterVisitDto } from './dto/register-visit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  /** Registra que el usuario visitó un lugar. Es idempotente. */
  @Post()
  register(@Request() req, @Body() dto: RegisterVisitDto) {
    return this.visitsService.register(req.user.userId, dto.placeId);
  }

  /** Progreso del usuario: lugares y estados visitados (para las insignias). */
  @Get('me')
  mine(@Request() req) {
    return this.visitsService.mine(req.user.userId);
  }
}