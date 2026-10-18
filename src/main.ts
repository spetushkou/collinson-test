import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { APP_CONFIG, AppConfig } from './config/config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(app.get<AppConfig>(APP_CONFIG).port);
}
await bootstrap();
