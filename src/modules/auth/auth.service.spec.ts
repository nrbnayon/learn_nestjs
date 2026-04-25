import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtHelperService } from '../../shared/jwt.service';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../shared/mail.service';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    tenant: {
      findFirst: jest.fn(),
    },
  };

  const jwtMock = {
    generateSecureToken: jest.fn().mockReturnValue('secure-token'),
    generateOtpCode: jest.fn().mockReturnValue('123456'),
    generateTokenPair: jest.fn().mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }),
  };

  const redisMock = {
    setJson: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn(),
  };

  const configMock = {
    get: jest.fn().mockReturnValue('http://localhost:3001'),
  };

  const mailMock = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtHelperService, useValue: jwtMock },
        { provide: RedisService, useValue: redisMock },
        { provide: ConfigService, useValue: configMock },
        { provide: MailService, useValue: mailMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends OTP for email channel', async () => {
    await service.sendOtp({ identifier: 'user@example.com', channel: 'email' });

    expect(redisMock.setJson).toHaveBeenCalled();
    expect(mailMock.sendMail).toHaveBeenCalled();
  });

  it('blocks OTP resend after more than 3 attempts', async () => {
    redisMock.incr.mockResolvedValueOnce(4);

    await expect(
      service.sendOtp({
        identifier: 'user@example.com',
        channel: 'email',
        purpose: 'login',
      }),
    ).rejects.toThrow('OTP resend limit exceeded');

    expect(redisMock.set).toHaveBeenCalled();
  });
});
