import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  context?: Record<string, any>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: this.configService.get<boolean>('mail.secure'),
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.password'),
      },
    });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const from = this.configService.get<string>('mail.from');
    let html = options.html;

    if (options.template && options.context) {
      html = this.renderTemplate(options.template, options.context);
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html,
        text: options.text,
      });
      this.logger.log(`Email sent: ${info.messageId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${options.to}: ${message}`);
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Mail server connection verified');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Mail server verification failed: ${message}`);
      return false;
    }
  }

  private renderTemplate(template: string, context: Record<string, any>): string {
    const templates: Record<string, (ctx: any) => string> = {
      welcome: (ctx) => `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h1 style="color:#4F46E5;">Welcome to NestJS Chat! 🎉</h1>
          <p>Hi <strong>${ctx.displayName}</strong>,</p>
          <p>Your account was created successfully. Start chatting!</p>
          <br/><p>The NestJS Chat Team</p>
        </div>`,
      'verify-email': (ctx) => `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h1 style="color:#4F46E5;">Verify your email</h1>
          <p>Hi <strong>${ctx.displayName}</strong>,</p>
          <a href="${ctx.verificationUrl}" style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0;">
            Verify Email
          </a>
          <p style="color:#666;font-size:12px;">Link expires in 24 hours.</p>
        </div>`,
      'password-reset': (ctx) => `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h1 style="color:#4F46E5;">Reset your password</h1>
          <p>Hi <strong>${ctx.displayName}</strong>,</p>
          <a href="${ctx.resetUrl}" style="background:#DC2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0;">
            Reset Password
          </a>
          <p style="color:#666;font-size:12px;">Expires in ${ctx.expiresIn}.</p>
        </div>`,
    };
    const fn = templates[template];
    if (!fn) return `<p>${template}</p>`;
    return fn(context);
  }
}
