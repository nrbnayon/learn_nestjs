/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SocketIoAdapter } from './socket/socket.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get<ConfigService>(ConfigService);
  const reflector = app.get<Reflector>(Reflector);
  const port = configService.get<number>('app.port', 3000);
  const host = configService.get<string>('app.host', '127.0.0.1');
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('cors.origins') ?? [
    'http://localhost:3000',
  ];
  const uploadDir = configService.get<string>('storage.uploadDir', 'uploads');

  app.setGlobalPrefix(apiPrefix);
  app.useStaticAssets(resolve(process.cwd(), uploadDir), {
    prefix: '/uploads',
  });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Standard Express middleware setup
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(reflector),
  );
  app.useWebSocketAdapter(new SocketIoAdapter(app, configService));

  await app.listen(port, host);
}
void bootstrap();
