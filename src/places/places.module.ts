import { Module } from '@nestjs/common';
import { OpenMeteoModule } from '../open-meteo/open-meteo.module.js';
import { PlacesService } from './places.service.js';

@Module({
  imports: [OpenMeteoModule],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
