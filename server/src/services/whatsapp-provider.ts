import crypto from 'crypto';
import { config } from '../config/index.js';
import { logger } from './logger.js';

export interface ProviderSendResult {
  success: boolean;
  provider_message_id?: string;
  http_status: number;
  duration_ms: number;
  error_code?: string;
  error_type?: string;
  error_message?: string;
  retryable: boolean;
}

export class WhatsAppProviderService {
  /**
   * Send WhatsApp Template Message with Strict Privacy and Forensic Logging
   */
  static async sendTemplateMessage(params: {
    campaignId: string;
    recipientId: string;
    correlationId: string;
    recipientPhone?: string;
    templateName: string;
    language: string;
    variables?: string[];
    parameters?: Array<{ type: 'text'; text: string; parameter_name?: string }>;
    headerMedia?: { type: 'image' | 'document' | 'video'; link: string; filename?: string };
    headerText?: string;
    workerId: string;
  }): Promise<ProviderSendResult> {
    const startTime = Date.now();
    const requestId = `REQ-${crypto.randomBytes(8).toString('hex')}`;

    // Normalize parameter format: support both positional text array and named parameters
    let messageParameters: Array<{ type: 'text'; text: string; parameter_name?: string }> = [];
    if (params.parameters && params.parameters.length > 0) {
      messageParameters = params.parameters;
    } else if (params.variables && params.variables.length > 0) {
      messageParameters = params.variables.map(v => ({ type: 'text', text: String(v) }));
    }

    logger.debug('WHATSAPP_DISPATCH_START', 'Submitting template payload to Meta Graph API', {
      request_id: requestId,
      correlation_id: params.correlationId,
      campaign_id: params.campaignId,
      recipient_id: params.recipientId,
      worker_id: params.workerId,
      details: {
        template: params.templateName,
        language: params.language,
        parameter_count: messageParameters.length,
        has_header_media: !!params.headerMedia
      }
    });

    const isMock = config.whatsapp.accessToken.startsWith('mock_') || config.whatsapp.accessToken.includes('Sample');

    // Normalize phone number per Meta standard: include both '+' and country calling code (e.g. +919309313044)
    let cleanDigits = (params.recipientPhone || '919876543210').replace(/\D/g, '');
    if (cleanDigits.length === 10) {
      cleanDigits = '91' + cleanDigits;
    }
    const toPhone = `+${cleanDigits}`;

    if (!isMock) {
      try {
        const components: any[] = [];

        // 1. Add Header Component if media or text header is defined
        if (params.headerMedia && params.headerMedia.link) {
          const mediaObj: any = { link: params.headerMedia.link };
          if (params.headerMedia.type === 'document' && params.headerMedia.filename) {
            mediaObj.filename = params.headerMedia.filename;
          }
          components.push({
            type: 'header',
            parameters: [
              {
                type: params.headerMedia.type,
                [params.headerMedia.type]: mediaObj
              }
            ]
          });
        } else if (params.headerText) {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'text',
                text: params.headerText
              }
            ]
          });
        }

        // 2. Add Body Component with variables
        if (messageParameters.length > 0) {
          components.push({
            type: 'body',
            parameters: messageParameters
          });
        }

        const requestPayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhone,
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: params.language || 'en' },
            ...(components.length > 0 ? { components } : {})
          }
        };

        const response = await fetch(`${config.whatsapp.baseUrl}/${config.whatsapp.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.whatsapp.accessToken}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': params.correlationId
          },
          body: JSON.stringify(requestPayload)
        });

        const duration = Date.now() - startTime;
        const data: any = await response.json();

        if (response.ok && data.messages?.[0]?.id) {
          const providerMsgId = data.messages[0].id;
          logger.info('WHATSAPP_DISPATCH_SUCCESS', 'Meta accepted message for dispatch', {
            request_id: requestId,
            correlation_id: params.correlationId,
            campaign_id: params.campaignId,
            recipient_id: params.recipientId,
            worker_id: params.workerId,
            duration_ms: duration,
            result: 'SUCCESS',
            details: {
              provider_message_id: providerMsgId,
              message_status: data.messages[0].message_status || 'accepted',
              http_status: response.status
            }
          });

          return {
            success: true,
            provider_message_id: providerMsgId,
            http_status: response.status,
            duration_ms: duration,
            retryable: false
          };
        }

        const err = data.error || {};
        const errCode = Number(err.code) || response.status;
        // Retry on throughput rate limit (130429), temporary service unavailable (131016, 133004), or server 5xx
        const retryable = [130429, 131016, 131056, 133004, 429, 500, 502, 503, 504].includes(errCode);
        const detailedError = err.error_data?.details || err.message || 'WhatsApp Cloud API rejection';

        logger.error('WHATSAPP_DISPATCH_FAILED', `Meta API returned error: ${detailedError}`, null, {
          request_id: requestId,
          correlation_id: params.correlationId,
          campaign_id: params.campaignId,
          recipient_id: params.recipientId,
          worker_id: params.workerId,
          duration_ms: duration,
          error_code: String(errCode),
          details: {
            error_type: err.type,
            details: err.error_data?.details,
            fbtrace_id: err.fbtrace_id,
            retryable
          }
        });

        return {
          success: false,
          http_status: response.status,
          duration_ms: duration,
          error_code: String(errCode),
          error_type: err.type || 'PROVIDER_ERROR',
          error_message: detailedError,
          retryable
        };
      } catch (networkErr: any) {
        const duration = Date.now() - startTime;
        logger.error('WHATSAPP_NETWORK_ERROR', 'Network connection failed contacting WhatsApp API', networkErr, {
          request_id: requestId,
          correlation_id: params.correlationId,
          campaign_id: params.campaignId,
          recipient_id: params.recipientId,
          duration_ms: duration,
          error_code: 'NETWORK_ERROR'
        });

        return {
          success: false,
          http_status: 503,
          duration_ms: duration,
          error_code: 'NETWORK_ERROR',
          error_type: 'NETWORK_ERROR',
          error_message: networkErr.message,
          retryable: true
        };
      }
    }

    // High-fidelity sandbox response simulation
    await new Promise(r => setTimeout(r, 40)); // 40ms realistic network latency
    const duration = Date.now() - startTime;
    const providerMsgId = `wamid.${crypto.randomBytes(16).toString('base64url')}`;

    logger.info('WHATSAPP_DISPATCH_SUCCESS', 'Meta sandbox accepted message for dispatch', {
      request_id: requestId,
      correlation_id: params.correlationId,
      campaign_id: params.campaignId,
      recipient_id: params.recipientId,
      worker_id: params.workerId,
      duration_ms: duration,
      result: 'SUCCESS',
      details: { provider_message_id: providerMsgId, http_status: 200 }
    });

    return {
      success: true,
      provider_message_id: providerMsgId,
      http_status: 200,
      duration_ms: duration,
      retryable: false
    };
  }
}
