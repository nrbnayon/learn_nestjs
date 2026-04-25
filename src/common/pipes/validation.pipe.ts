import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CustomValidationPipe implements PipeTransform<unknown, unknown> {
  async transform(
    value: unknown,
    { metatype }: ArgumentMetadata,
  ): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype as never, value as never, {
      enableImplicitConversion: true,
      excludeExtraneousValues: false,
    });

    const errors = await validate(object as object, {
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const messages = errors.flatMap((err) =>
        Object.values(err.constraints ?? {}).map((msg) => msg),
      );
      throw new BadRequestException({
        message: messages,
        error: 'Validation Error',
        statusCode: 400,
      });
    }

    return object;
  }

  private toValidate(metatype: new (...args: never[]) => unknown): boolean {
    const types: Array<new (...args: never[]) => unknown> = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !types.includes(metatype);
  }
}
