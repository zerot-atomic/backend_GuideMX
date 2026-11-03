import { IsUUID } from 'class-validator';

export class RegisterVisitDto {
  @IsUUID()
  placeId!: string;
}
