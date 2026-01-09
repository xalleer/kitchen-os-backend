import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { Resend } from 'resend';

@Global()
@Module({
  providers: [
    MailService,
    {
      provide: 'RESEND_CLIENT',
      useFactory: (config: ConfigService) => {
        return new Resend(config.get('RESEND_API_KEY'));
      },
      inject: [ConfigService],
    },
  ],
  exports: [MailService],
})
export class MailModule {}