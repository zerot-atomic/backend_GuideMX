import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlacesModule } from './places/places.module';
import { CategoriesModule } from './categories/categories.module';
import { StatesModule } from './states/states.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { PlaceImagesModule } from './place-images/place-images.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Si falta alguna variable obligatoria, el servidor NO arranca en vez
      // de fallar a medias más adelante (ej. un JWT_SECRET vacío firmando
      // tokens inseguros sin que nadie se dé cuenta).
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        PORT: Joi.number().default(3000),
        CLOUDINARY_CLOUD_NAME: Joi.string().allow('').optional(),
        CLOUDINARY_API_KEY: Joi.string().allow('').optional(),
        CLOUDINARY_API_SECRET: Joi.string().allow('').optional(),
      }),
    }),
    // Límite de peticiones por IP: 100 requests cada 60 segundos por default.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    PlacesModule,
    CategoriesModule,
    StatesModule,
    FavoritesModule,
    ReviewsModule,
    UploadsModule,
    PlacesModule,
    PlaceImagesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
