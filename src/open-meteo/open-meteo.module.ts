import { Module } from '@nestjs/common';
import { OpenMeteoClient } from './open-meteo.client.js';
import { FETCH } from './types.js';

@Module({
  providers: [
    OpenMeteoClient,
    { provide: FETCH, useValue: globalThis.fetch.bind(globalThis) },
  ],
  exports: [OpenMeteoClient],
})
export class OpenMeteoModule {}
