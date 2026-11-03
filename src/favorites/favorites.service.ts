import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
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

    const place = await this.prisma.place.findUnique({ where: { id: placeId } });
    if (!place) throw new NotFoundException('El lugar no existe');

    return this.prisma.favorite.create({ data: { userId, placeId } });
  }

  async remove(userId: string, placeId: string) {
    const { count } = await this.prisma.favorite.deleteMany({
      where: { userId, placeId },
    });
    if (count === 0) throw new NotFoundException('Ese lugar no está en tus favoritos');
    return { deleted: true };
  }
}