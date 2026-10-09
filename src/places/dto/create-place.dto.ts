import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
  Max,
} from 'class-validator';

export class CreatePlaceDto {
  @IsString()
  name!: string;

  @IsString()
  shortDescription!: string;

  @IsString()
  longDescription!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  address!: string;

  @IsUUID()
  stateId!: string;

  @IsString()
  municipality!: string;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsOptional()
  @IsNumber()
  entryCost?: number;

  @IsOptional()
  @IsNumber()
  relevanceScore?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];
}
