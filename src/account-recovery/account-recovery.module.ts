import { Module } from '@nestjs/common';
import { AccountRecoveryController } from './account-recovery.controller';
import { AccountRecoveryService } from './account-recovery.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccountRecoveryController],
  providers: [AccountRecoveryService],
  exports: [AccountRecoveryService],
})
export class AccountRecoveryModule {}