import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  findMine(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { place: { include: { images: true } } },
    });
  }

  async add(userId: string, placeId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_placeId: { userId, placeId } },
    });
    if (existing) throw new ConflictException('Ya está en favoritos');
    return this.prisma.favorite.create({ data: { userId, placeId } });
  }

  remove(userId: string, placeId: string) {
    return this.prisma.favorite.delete({
      where: { userId_placeId: { userId, placeId } },
    });
  }
}
