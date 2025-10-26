import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return false;
    }

    const { error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Email send error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email service error:', error);
    return false;
  }
}

export function generateVerificationEmail(username: string, verificationLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>メールアドレスを確認してください</h2>
          <p>こんにちは、${username}さん</p>
          <p>ブックマークコレクションマネージャーにご登録いただき、ありがとうございます。</p>
          <p>以下のボタンをクリックして、メールアドレスを確認してください：</p>
          <a href="${verificationLink}" class="button">メールアドレスを確認</a>
          <p>または、以下のリンクをコピーしてブラウザに貼り付けてください：</p>
          <p><a href="${verificationLink}">${verificationLink}</a></p>
          <p>このリンクは24時間有効です。</p>
          <div class="footer">
            <p>このメールに心当たりがない場合は、無視していただいて構いません。</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function generatePasswordResetEmail(username: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>パスワードのリセット</h2>
          <p>こんにちは、${username}さん</p>
          <p>パスワードのリセットがリクエストされました。</p>
          <p>以下のボタンをクリックして、新しいパスワードを設定してください：</p>
          <a href="${resetLink}" class="button">パスワードをリセット</a>
          <p>または、以下のリンクをコピーしてブラウザに貼り付けてください：</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <div class="warning">
            <p><strong>注意：</strong>このリンクは1時間有効です。</p>
          </div>
          <div class="footer">
            <p>パスワードのリセットをリクエストしていない場合は、このメールを無視してください。アカウントは安全です。</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
