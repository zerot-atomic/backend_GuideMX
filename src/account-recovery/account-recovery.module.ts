import { Module } from '@nestjs/common';
import { AccountRecoveryController } from './account-recovery.controller';
import { AccountRecoveryService } from './account-recovery.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [AccountRecoveryController],
  providers: [AccountRecoveryService],
  exports: [AccountRecoveryService],
})
export class AccountRecoveryModule {}