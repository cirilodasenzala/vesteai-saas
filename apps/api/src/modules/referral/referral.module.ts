import { Global, Module } from '@nestjs/common';
import { ReferralService } from './referral.service';

@Global()
@Module({
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
