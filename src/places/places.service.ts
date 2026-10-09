import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';

@Injectable()
export class PlacesService {
  constructor(private prisma: PrismaService) {}

  // GET /places/nearby
  // Usamos $queryRaw porque Prisma no soporta funciones geoespaciales
  // de PostGIS (ST_Distance, ST_DWithin) de forma nativa en su query builder.
  async findNearby({ lat, lng, radius = 25, limit = 20 }: NearbyQueryDto) {
    return this.prisma.$queryRaw`
      SELECT
        id, name, "shortDescription", "relevanceScore",
        ST_Distance(
          ST_MakePoint(longitude, latitude)::geography,
          ST_MakePoint(${lng}, ${lat})::geography
        ) / 1000 AS "distanceKm"
      FROM "Place"
      WHERE "isPublished" = true
        AND ST_DWithin(
          ST_MakePoint(longitude, latitude)::geography,
          ST_MakePoint(${lng}, ${lat})::geography,
          ${radius} * 1000
        )
      ORDER BY "distanceKm" ASC
      LIMIT ${limit};
    `;
  }

  // GET /places/featured
  findFeatured(limit = 20) {
    return this.prisma.place.findMany({
      where: { isPublished: true },
      orderBy: { relevanceScore: 'desc' },
      take: limit,
      include: { images: true, categories: { include: { category: true } } },
    });
  }

  // GET /places
  findAll(params: { category?: string; stateId?: string; page?: number; limit?: number }) {
    const { category, stateId, page = 1, limit = 20 } = params;
    return this.prisma.place.findMany({
      where: {
        isPublished: true,
        ...(stateId ? { stateId } : {}),
        ...(category
          ? { categories: { some: { categoryId: category } } }
          : {}),
      },
      skip: (page - 1) * limit,
      take: limit,
      include: { images: true, categories: { include: { category: true } } },
    });
  }

  async findOne(id: string) {
    const place = await this.prisma.place.findUnique({
      where: { id },
      include: {
        images: { orderBy: { order: 'asc' } },
        categories: { include: { category: true } },
        state: true,
      },
    });
    if (!place) throw new NotFoundException('Lugar no encontrado');
    return place;
  }

  create(dto: CreatePlaceDto) {
    const { categoryIds, ...data } = dto;
    return this.prisma.place.create({
      data: {
        ...data,
        categories: categoryIds
          ? {
              create: categoryIds.map((categoryId) => ({ categoryId })),
            }
          : undefined,
      },
    });
  }

  async update(id: string, dto: UpdatePlaceDto) {
    await this.findOne(id);
    const { categoryIds, ...data } = dto;
    return this.prisma.place.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Despublicar en vez de borrar, para no perder reseñas/favoritos asociados
    return this.prisma.place.update({
      where: { id },
      data: { isPublished: false },
    });
  }
}
