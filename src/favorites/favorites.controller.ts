import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findMine(@Request() req) {
    return this.favoritesService.findMine(req.user.userId);
  }

  @Post()
  add(@Request() req, @Body() dto: AddFavoriteDto) {
    return this.favoritesService.add(req.user.userId, dto.placeId);
  }

  @Delete(':placeId')
  remove(@Request() req, @Param('placeId') placeId: string) {
    return this.favoritesService.remove(req.user.userId, placeId);
  }
}
