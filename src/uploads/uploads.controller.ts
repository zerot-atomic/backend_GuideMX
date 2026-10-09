import {
  Controller,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // Sube una imagen suelta y regresa la URL de Cloudinary
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.uploadImage(file);
  }

  // Sube una imagen y la agrega directo a la galería de un lugar (PlaceImage)
  @Post('places/:placeId/image')
  @UseInterceptors(FileInterceptor('file'))
  uploadPlaceImage(
    @Param('placeId') placeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadsService.uploadPlaceImage(placeId, file);
  }
}
