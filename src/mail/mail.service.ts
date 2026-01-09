import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  constructor(
    @Inject('RESEND_CLIENT') private readonly resend: Resend,
    private readonly configService: ConfigService,
  ) {}

  async sendResetPasswordEmail(email: string, code: string) {
    const from = this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Reset Password</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f4f4f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; color: #51545E; }
        table { border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; }
        .container { display: block; margin: 0 auto !important; max-width: 600px; padding: 10px; width: 600px; }
        .content { box-sizing: border-box; display: block; margin: 0 auto; max-width: 600px; padding: 10px; }
        .main { background: #ffffff; border-radius: 8px; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .wrapper { box-sizing: border-box; padding: 40px; }
        h1 { font-family: 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; font-weight: 700; font-size: 24px; margin: 0; margin-bottom: 30px; color: #333333; text-align: center; }
        p { font-family: 'Helvetica Neue', Helvetica, Arial, 'Lucida Grande', sans-serif; font-size: 16px; font-weight: normal; margin: 0; margin-bottom: 20px; line-height: 1.6; color: #555555; }
        .code-container { background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #10b981; margin: 0; }
        .footer { clear: both; margin-top: 10px; text-align: center; width: 100%; }
        .footer td, .footer p, .footer span, .footer a { color: #999999; font-size: 12px; text-align: center; }
    </style>
</head>
<body>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body">
        <tr>
            <td>&nbsp;</td>
            <td class="container">
                <div class="content">
                    <table role="presentation" class="main">
                        <tr>
                            <td class="wrapper">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="text-align: center; margin-bottom: 20px;">
                                                <span style="font-size: 40px;">🍳</span>
                                            </div>

                                            <h1>Reset Your Password</h1>
                                            
                                            <p>Hello,</p>
                                            <p>We received a request to reset the password for your Kitchen OS account. Use the code below to complete the process:</p>
                                            
                                            <div class="code-container">
                                                <p class="code">${code}</p>
                                            </div>

                                            <p style="font-size: 14px; color: #888; text-align: center;">This code is valid for <strong>15 minutes</strong>.</p>
                                            
                                            <p>If you didn't ask to reset your password, you can safely ignore this email.</p>
                                            <p>Happy Cooking,<br>The Kitchen OS Team</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    
                    <div class="footer">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                            <tr>
                                <td class="content-block">
                                    <span class="apple-link">Kitchen OS, Poltava, Ukraine</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
            </td>
            <td>&nbsp;</td>
        </tr>
    </table>
</body>
</html>
    `;

    try {
      const data = await this.resend.emails.send({
        from: from,
        to: email,
        subject: '🔐 Ваш код відновлення пароля',
        html: htmlContent,
      });

      if (data.error) {
        console.error('[MailService] Resend API Error:', data.error);
        return;
      }

      console.log(`[MailService] Email sent to ${email}, ID: ${data.data?.id}`);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.error('[MailService] Transport Error (Email not sent):', error.message);

    }
  }
}