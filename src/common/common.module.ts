import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppErrorFilter } from './app-error.filter.js';
import { CLOCK, systemClock } from './clock.js';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: systemClock },
    { provide: APP_FILTER, useClass: AppErrorFilter },
  ],
  exports: [CLOCK],
})
export class CommonModule {}
