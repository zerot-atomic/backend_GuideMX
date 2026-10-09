import { Module } from '@nestjs/common';
import { PlaceImagesController } from './place-images.controller';
import { PlaceImagesService } from './place-images.service';

@Module({
  controllers: [PlaceImagesController],
  providers: [PlaceImagesService],
})
export class PlaceImagesModule {}
