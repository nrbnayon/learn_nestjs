import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SocketIoAdapter } from './socket/socket.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('cors.origins') ?? ['http://localhost:3000'];

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
  app.useWebSocketAdapter(new SocketIoAdapter(app, configService));

  await app.listen(port, '0.0.0.0');
}
bootstrap();
