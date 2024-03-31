import { Module } from '@nestjs/common';
import { MessageGateway } from '../message/message.gateway';

@Module({
  providers: [MessageGateway],
})
export class AppModule {
}
