import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { AppModule } from './app.module';

/** Converts JSON into DTO classes without rejecting IBMS field values. */
@Injectable()
class AcceptPayloadPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const metatype = metadata.metatype;
    if (!metatype || !this.shouldTransform(metatype)) {
      return value;
    }
    return plainToInstance(metatype as new (...args: unknown[]) => object, value, {
      enableImplicitConversion: true,
    });
  }

  private shouldTransform(metatype: Function): boolean {
    const primitives: Function[] = [String, Boolean, Number, Array, Object];
    return !primitives.includes(metatype);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? true,
  });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new AcceptPayloadPipe());

  const config = new DocumentBuilder()
    .setTitle('E-Invoice Hub API')
    .setDescription('Shared multi-tenant e-invoicing platform API')
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Integration API key',
      },
      'api-key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-admin-key',
        in: 'header',
        description: 'Admin API key',
      },
      'admin-key',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3020);
}
bootstrap();
