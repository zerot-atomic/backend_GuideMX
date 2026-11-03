import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  async register(userId: string, placeId: string) {
    const place = await this.prisma.place.findUnique({
      where: { id: placeId },
      select: { id: true, stateId: true, state: { select: { name: true } } },
    });
    if (!place) throw new NotFoundException('El lugar no existe');

    const already = await this.prisma.visit.findUnique({
      where: { userId_placeId: { userId, placeId } },
    });
    if (already) {
      return { placeId, state: place.state.name, isNewPlace: false, isNewState: false };
    }

    // ¿Ya tenía otra visita en este mismo estado? Si no, es estado nuevo (insignia).
    const inState = await this.prisma.visit.count({
      where: { userId, place: { stateId: place.stateId } },
    });

    await this.prisma.visit.create({ data: { userId, placeId } });

    return {
      placeId,
      state: place.state.name,
      isNewPlace: true,
      isNewState: inState === 0,
    };
  }

  async mine(userId: string) {
    const visits = await this.prisma.visit.findMany({
      where: { userId },
      orderBy: { visitedAt: 'desc' },
      select: {
        placeId: true,
        visitedAt: true,
        place: { select: { name: true, state: { select: { id: true, name: true } } } },
      },
    });

    const visitedStates = [...new Set(visits.map((v) => v.place.state.name))];

    return {
      visitedPlaces: visits.length,
      visitedStates,
      visits: visits.map((v) => ({
        placeId: v.placeId,
        placeName: v.place.name,
        state: v.place.state.name,
        visitedAt: v.visitedAt,
      })),
    };
  }
}