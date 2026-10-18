import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthResolver } from './health.resolver.js';

@Module({
  controllers: [HealthController],
  providers: [HealthResolver],
})
export class HealthModule {}
