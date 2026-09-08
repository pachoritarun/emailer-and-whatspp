import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { logger } from '../services/logger.js';
import { AuditService } from '../services/audit.js';

export const emailerRouter = Router();

// Test & Verify SMTP Configuration
emailerRouter.post('/verify-smtp', async (req: Request, res: Response) => {
  try {
    const { smtpConfig } = req.body;

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({
        success: false,
        error: 'Missing required SMTP parameters (host, user, pass).'
      });
    }

    const port = Number(smtpConfig.port) || 465;
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port,
      secure: port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    logger.info('SMTP_VERIFY_SUCCESS', `SMTP connection verified for ${smtpConfig.user}@${smtpConfig.host}:${port}`);
    return res.json({
      success: true,
      message: `Successfully authenticated with ${smtpConfig.host}:${port}`
    });
  } catch (error: any) {
    logger.error('SMTP_VERIFY_FAILED', `SMTP verification failed: ${error.message}`);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to authenticate with SMTP server'
    });
  }
});

// Bulk Email Dispatch Handler
emailerRouter.post('/send', async (req: Request, res: Response) => {
  await handleSendEmails(req, res);
});

// Alias for direct root post
emailerRouter.post('/', async (req: Request, res: Response) => {
  await handleSendEmails(req, res);
});

async function handleSendEmails(req: Request, res: Response) {
  try {
    const { data, smtpConfig, emailTemplate, useHtml } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No recipient data provided'
      });
    }

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({
        success: false,
        error: 'Incomplete SMTP configuration'
      });
    }

    const port = Number(smtpConfig.port) || 465;
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port,
      secure: port === 465,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      connectionTimeout: 15000,
    });

    // Test connection first
    await transporter.verify();

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const student of data) {
      // Auto-detect email column (case-insensitive)
      const emailKey = Object.keys(student).find(k => k.toLowerCase().includes('email'));
      const studentEmail = emailKey ? String(student[emailKey] || '').trim() : null;

      if (!studentEmail) {
        results.push({ email: 'Unknown', success: false, error: 'No email column or address found' });
        continue;
      }

      let subject = emailTemplate.subject || '';
      let body = emailTemplate.body || '';

      Object.keys(student).forEach((key) => {
        const value = String(student[key] || '');
        const regex = new RegExp(`{{${key}}}`, 'gi');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);

        const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '');
        const normRegex = new RegExp(`{{${cleanKey}}}`, 'gi');
        subject = subject.replace(normRegex, value);
        body = body.replace(normRegex, value);
      });

      const mailOptions: any = {
        from: smtpConfig.from || `JECRC University <${smtpConfig.user}>`,
        to: studentEmail,
        subject,
      };

      if (useHtml) {
        mailOptions.html = body;
      } else {
        mailOptions.text = body;
      }

      try {
        await transporter.sendMail(mailOptions);
        results.push({ email: studentEmail, success: true });
      } catch (error: any) {
        logger.error('EMAIL_DISPATCH_FAILURE', `Failed to send email to ${studentEmail}: ${error.message}`);
        results.push({
          email: studentEmail,
          success: false,
          error: error.message || 'Failed to dispatch email'
        });
      }

      // 400ms interval to prevent SMTP provider rate-limiting
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('EMAIL_BATCH_DISPATCHED', `Dispatched batch of ${data.length} emails. Success: ${successCount}`);

    // Record in Audit Trail for Developer visibility
    await AuditService.log({
      userId: req.body.userId || 'USR-SENDER-001',
      userRole: req.body.userRole || 'SENDER',
      action: 'EMAIL_BATCH_DISPATCHED',
      entity: 'BULK_EMAILER',
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'BulkEmailerClient/1.0',
      success: true,
      metadata: {
        total_recipients: data.length,
        successful: successCount,
        failed: data.length - successCount,
        subject: emailTemplate.subject || 'Institutional Announcement',
        smtp_sender: smtpConfig.from || smtpConfig.user
      }
    });

    return res.json({ success: true, results });
  } catch (error: any) {
    logger.error('EMAIL_API_ERROR', `Internal error in email dispatch: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while processing emails'
    });
  }
}
