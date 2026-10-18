import { Module } from '@nestjs/common';
import { OpenMeteoModule } from '../open-meteo/open-meteo.module.js';
import { WeatherRepository } from './weather.repository.js';
import { WeatherService } from './weather.service.js';

@Module({
  imports: [OpenMeteoModule],
  providers: [WeatherRepository, WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
