import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  findByPlace(placeId: string) {
    return this.prisma.review.findMany({
      where: { placeId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, dto: CreateReviewDto) {
    return this.prisma.review.create({
      data: { userId, placeId: dto.placeId, rating: dto.rating, comment: dto.comment },
    });
  }
}
