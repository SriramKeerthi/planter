import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';

import { AppModule } from './app/app.module';

async function bootstrap() {
  console.log('Expected creds', { username: process.env['WS_USERNAME'], password: process.env['WS_PASSWORD'] })
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `🚀 Application is running on: ws://localhost:${port}`
  );
}

bootstrap();
