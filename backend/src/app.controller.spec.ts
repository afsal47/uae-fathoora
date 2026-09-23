import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getRoot', () => {
    it('returns service metadata', () => {
      expect(appController.getRoot()).toEqual({
        service: 'e-invoice-hub',
        version: '1.0.0',
        docs: '/docs',
      });
    });
  });

  describe('getHealth', () => {
    it('returns ok status', () => {
      expect(appController.getHealth().status).toBe('ok');
      expect(appController.getHealth().service).toBe('e-invoice-hub');
    });
  });
});
