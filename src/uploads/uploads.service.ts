import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadsService {
  constructor(private prisma: PrismaService) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  private uploadBuffer(file: Express.Multer.File): Promise<string> {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'mxguide/places' },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result.secure_url);
        },
      );
      stream.end(file.buffer);
    });
  }

  // Sube la imagen y regresa solo la URL (el equipo decide dónde usarla)
  async uploadImage(file: Express.Multer.File) {
    const url = await this.uploadBuffer(file);
    return { url };
  }

  // Sube la imagen Y la asocia de una vez a un lugar (crea el PlaceImage)
  async uploadPlaceImage(placeId: string, file: Express.Multer.File) {
    const url = await this.uploadBuffer(file);
    const count = await this.prisma.placeImage.count({ where: { placeId } });
    return this.prisma.placeImage.create({
      data: { placeId, url, order: count },
    });
  }
}

