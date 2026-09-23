import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return {
      service: 'e-invoice-hub',
      version: '1.0.0',
      docs: '/docs',
    };
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'e-invoice-hub',
      timestamp: new Date().toISOString(),
    };
  }
}
