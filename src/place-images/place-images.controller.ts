import {
  Controller, Get, Header, Param, ParseUUIDPipe, Post, StreamableFile, UseGuards,
} from '@nestjs/common';
import { PlaceImagesService } from './place-images.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('place-images')
export class PlaceImagesController {
  constructor(private readonly service: PlaceImagesService) {}

  // Busca y guarda en la BD la miniatura de todos los lugares existentes (solo admin).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('sync')
  sync() {
    return this.service.syncAll();
  }

  // Todas las miniaturas en Base32: la app las guarda en su base de datos local (modo sin internet).
  @Get()
  list() {
    return this.service.listAll();
  }

  // Una miniatura codificada: { mime, data }.
  @Get(':id/encoded')
  encoded(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getEncoded(id);
  }

  // Una miniatura como imagen normal, por si se quiere usar Image.network.
  @Get(':id')
  @Header('Cache-Control', 'public, max-age=86400')
  async image(@Param('id', ParseUUIDPipe) id: string) {
    const { buffer, mime } = await this.service.getImage(id);
    return new StreamableFile(buffer, { type: mime });
  }
}
