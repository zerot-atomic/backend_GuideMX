import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.state.findMany({ orderBy: { name: 'asc' } });
  }
}
