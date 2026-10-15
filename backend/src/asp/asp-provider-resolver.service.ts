import { Injectable } from '@nestjs/common';
import { GenericAspAdapter } from './generic-asp.adapter';
import { AspProviderAdapter } from './asp.types';

@Injectable()
export class AspProviderResolverService {
  constructor(private readonly genericAspAdapter: GenericAspAdapter) {}

  resolve(_provider: string): AspProviderAdapter {
    return this.genericAspAdapter;
  }
}
