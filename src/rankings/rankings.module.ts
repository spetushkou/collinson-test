import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module.js';
import { WeatherModule } from '../weather/weather.module.js';
import { RankingsResolver } from './rankings.resolver.js';
import { RankingsService } from './rankings.service.js';

@Module({
  imports: [PlacesModule, WeatherModule],
  providers: [RankingsService, RankingsResolver],
})
export class RankingsModule {}
