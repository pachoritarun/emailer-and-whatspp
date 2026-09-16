import crypto from 'crypto';
import { config } from '../config/index.js';
import { executeQuery, getMemoryStore, commitStoreMutation } from '../db/pool.js';
import { logger } from './logger.js';
import { AuditService } from './audit.js';

export interface MetaTemplatePayload {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  header_type?: 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  header_text?: string;
  header_sample?: string;
  body_text: string;
  sample_variables?: string[];
  footer_text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    url_example?: string;
    phone_number?: string;
  }>;
}

export class WhatsAppTemplateService {
  private static cachedWabaId: string | null = null;

  /**
   * Resolves the WhatsApp Business Account ID (WABA ID).
   * First checks environment variable WHATSAPP_BUSINESS_ACCOUNT_ID / WHATSAPP_WABA_ID.
   * If not found, dynamically queries Meta Graph API using the phone number ID.
   */
  static async resolveWabaId(): Promise<string | null> {
    if (this.cachedWabaId) {
      return this.cachedWabaId;
    }

    const envWabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || process.env.WHATSAPP_WABA_ID;
    if (envWabaId && envWabaId.trim()) {
      this.cachedWabaId = envWabaId.trim();
      return this.cachedWabaId;
    }

    const token = config.whatsapp.accessToken;
    const phoneId = config.whatsapp.phoneNumberId;

    if (!token || !phoneId) {
      logger.warn('WABA_RESOLVE_MISSING_CREDS', 'WhatsApp token or phone number ID missing; using local simulation mode');
      return null;
    }

    try {
      const response = await fetch(
        `${config.whatsapp.baseUrl}/${phoneId}?fields=whatsapp_business_account`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        if (data?.whatsapp_business_account?.id) {
          this.cachedWabaId = data.whatsapp_business_account.id;
          logger.info('WABA_RESOLVE_SUCCESS', `Dynamically resolved WABA ID from Meta: ${this.cachedWabaId}`);
          return this.cachedWabaId;
        }
      }
    } catch (err: any) {
      logger.warn('WABA_RESOLVE_API_ERR', 'Could not auto-resolve WABA ID from Meta Graph API: ' + err.message);
    }

    return null;
  }

  /**
   * Creates a template in Meta Cloud API and saves it directly into MySQL message_templates.
   */
  static async createAndSubmit(payload: MetaTemplatePayload, userRole = 'STAFF', userId = 'USR-001'): Promise<{
    success: boolean;
    template?: any;
    metaResponse?: any;
    error?: string;
  }> {
    const cleanName = payload.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanName) {
      return { success: false, error: 'Template name is required (lowercase letters and underscores only)' };
    }

    if (!payload.body_text || !payload.body_text.trim()) {
      return { success: false, error: 'Template body text is required' };
    }

    const tplId = `TPL-${cleanName.toUpperCase()}`;
    const category = payload.category || 'UTILITY';
    const language = payload.language || 'en';
    const headerType = payload.header_type || 'NONE';
    const footerText = payload.footer_text || '';
    const sampleVars = Array.isArray(payload.sample_variables) ? payload.sample_variables : [];

    // 1. Build Meta Graph API components structure
    const components: any[] = [];

    // Header component
    if (headerType !== 'NONE') {
      if (headerType === 'TEXT') {
        const headerObj: any = {
          type: 'HEADER',
          format: 'TEXT',
          text: payload.header_text || ''
        };
        if (payload.header_sample) {
          headerObj.example = { header_text: [payload.header_sample] };
        }
        components.push(headerObj);
      } else {
        // Media header (IMAGE, DOCUMENT, VIDEO)
        const headerObj: any = {
          type: 'HEADER',
          format: headerType
        };
        if (payload.header_sample) {
          headerObj.example = { header_handle: [payload.header_sample] };
        }
        components.push(headerObj);
      }
    }

    // Body component
    const bodyObj: any = {
      type: 'BODY',
      text: payload.body_text
    };

    // Detect if body has dynamic variables {{1}}, {{2}}, etc.
    const varMatches = payload.body_text.match(/\{\{(\d+)\}\}/g);
    if (varMatches && varMatches.length > 0) {
      // Ensure samples exist for every variable
      const sampleArray = sampleVars.length > 0
        ? sampleVars
        : varMatches.map((_, idx) => `SampleVal${idx + 1}`);
      bodyObj.example = { body_text: [sampleArray] };
    }
    components.push(bodyObj);

    // Footer component
    if (footerText && footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText.trim()
      });
    }

    // Buttons component
    if (payload.buttons && Array.isArray(payload.buttons) && payload.buttons.length > 0) {
      const formattedButtons: any[] = [];
      payload.buttons.forEach((btn) => {
        if (btn.type === 'QUICK_REPLY') {
          formattedButtons.push({
            type: 'QUICK_REPLY',
            text: btn.text
          });
        } else if (btn.type === 'URL') {
          const urlObj: any = {
            type: 'URL',
            text: btn.text,
            url: btn.url
          };
          if (btn.url?.includes('{{1}}') && btn.url_example) {
            urlObj.example = [btn.url_example];
          }
          formattedButtons.push(urlObj);
        } else if (btn.type === 'PHONE_NUMBER') {
          formattedButtons.push({
            type: 'PHONE_NUMBER',
            text: btn.text,
            phone_number: btn.phone_number
          });
        }
      });

      if (formattedButtons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: formattedButtons
        });
      }
    }

    let metaStatus = 'APPROVED'; // Default for simulation / immediate approval
    let metaTemplateId = `meta_${cleanName}_${Date.now()}`;
    let metaResponse: any = null;

    // 2. Call Meta Graph API if credentials are present
    const wabaId = await this.resolveWabaId();
    const token = config.whatsapp.accessToken;

    if (wabaId && token) {
      try {
        const metaApiUrl = `${config.whatsapp.baseUrl}/${wabaId}/message_templates`;
        const metaPayload = {
          name: cleanName,
          category,
          language,
          components
        };

        logger.info('META_TEMPLATE_SUBMIT_START', `Submitting template '${cleanName}' to Meta Cloud API...`, {
          details: { apiUrl: metaApiUrl, name: cleanName, category }
        });

        const response = await fetch(metaApiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metaPayload)
        });

        const data: any = await response.json();

        if (!response.ok) {
          const metaError = data?.error;
          const errorMsg = metaError
            ? `${metaError.message || ''} ${metaError.error_user_msg || ''}`.trim()
            : 'Failed to create template on Meta Cloud API';

          logger.warn('META_TEMPLATE_SUBMIT_FAIL', `Meta returned error: ${errorMsg}`, { details: metaError });
          return {
            success: false,
            error: `Meta Template Submission Error: ${errorMsg}`
          };
        }

        metaResponse = data;
        metaTemplateId = data.id || metaTemplateId;
        metaStatus = data.status || 'APPROVED';

        logger.info('META_TEMPLATE_SUBMIT_SUCCESS', `Meta accepted template '${cleanName}' with status: ${metaStatus}`, {
          details: { id: metaTemplateId, status: metaStatus }
        });
      } catch (err: any) {
        logger.error('META_API_FETCH_ERR', 'Error connecting to Meta API: ' + err.message);
        return {
          success: false,
          error: `Error connecting to Meta API: ${err.message}`
        };
      }
    } else {
      logger.info('META_TEMPLATE_LOCAL_MODE', `WABA credentials not configured; registered template '${cleanName}' in local MySQL.`);
    }

    // 3. Save / Upsert into MySQL database
    try {
      await executeQuery(`
        INSERT INTO message_templates (
          id, name, meta_template_id, category, language, header_type, body_text, footer_text, sample_variables, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          meta_template_id = VALUES(meta_template_id),
          category = VALUES(category),
          language = VALUES(language),
          header_type = VALUES(header_type),
          body_text = VALUES(body_text),
          footer_text = VALUES(footer_text),
          sample_variables = VALUES(sample_variables),
          status = VALUES(status)
      `, [
        tplId,
        cleanName,
        metaTemplateId,
        category,
        language,
        headerType,
        payload.body_text,
        footerText,
        JSON.stringify(sampleVars),
        metaStatus,
        userId
      ]);

      // Update in-memory store
      const store = getMemoryStore();
      const existingIdx = store.message_templates.findIndex(t => t.name === cleanName);
      const tplRecord = {
        id: tplId,
        name: cleanName,
        meta_template_id: metaTemplateId,
        category: category as any,
        language,
        header_type: headerType as any,
        header_text: payload.header_text || '',
        body_text: payload.body_text,
        footer_text: footerText,
        sample_variables: sampleVars,
        buttons: payload.buttons || [],
        status: metaStatus as any,
        created_at: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        store.message_templates[existingIdx] = tplRecord;
      } else {
        store.message_templates.unshift(tplRecord);
      }
      commitStoreMutation();

      // Log in Audit Trail
      await AuditService.log({
        userId,
        userRole,
        action: 'WHATSAPP_TEMPLATE_CREATED',
        entity: 'MESSAGE_TEMPLATE',
        entityId: cleanName,
        ipAddress: '127.0.0.1',
        success: true,
        metadata: {
          template_name: cleanName,
          category,
          header_type: headerType,
          status: metaStatus,
          meta_template_id: metaTemplateId
        }
      });

      return {
        success: true,
        template: {
          id: tplId,
          name: cleanName,
          category,
          language,
          header_type: headerType,
          body: payload.body_text,
          footer_text: footerText,
          sampleVariables: sampleVars,
          buttons: payload.buttons || [],
          status: metaStatus
        },
        metaResponse
      };
    } catch (dbErr: any) {
      logger.error('TEMPLATE_DB_SAVE_ERROR', 'Failed saving template to MySQL: ' + dbErr.message);
      return { success: false, error: 'Failed saving template to database: ' + dbErr.message };
    }
  }

  /**
   * Syncs all templates directly from Meta Cloud API into MySQL.
   */
  static async syncFromMeta(): Promise<{
    success: boolean;
    syncedCount: number;
    error?: string;
  }> {
    const wabaId = await this.resolveWabaId();
    const token = config.whatsapp.accessToken;

    if (!wabaId || !token) {
      return { success: false, syncedCount: 0, error: 'WABA ID or WhatsApp Access Token is not configured' };
    }

    try {
      const response = await fetch(
        `${config.whatsapp.baseUrl}/${wabaId}/message_templates?limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const errData: any = await response.json();
        return { success: false, syncedCount: 0, error: errData?.error?.message || 'Meta API error' };
      }

      const responseData: any = await response.json();
      const metaTemplates: any[] = responseData?.data || [];
      const store = getMemoryStore();
      let count = 0;

      for (const t of metaTemplates) {
        const name = t.name;
        const category = t.category || 'UTILITY';
        const language = t.language || 'en';
        const status = t.status || 'APPROVED';
        const tplId = `TPL-${name.toUpperCase()}`;

        // Extract components
        let bodyText = '';
        let headerType = 'NONE';
        let footerText = '';

        if (Array.isArray(t.components)) {
          for (const comp of t.components) {
            if (comp.type === 'BODY') bodyText = comp.text || '';
            if (comp.type === 'HEADER') headerType = comp.format || 'TEXT';
            if (comp.type === 'FOOTER') footerText = comp.text || '';
          }
        }

        // Upsert to MySQL
        try {
          await executeQuery(`
            INSERT INTO message_templates (
              id, name, meta_template_id, category, language, header_type, body_text, footer_text, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'META_SYNC')
            ON DUPLICATE KEY UPDATE
              category = VALUES(category),
              language = VALUES(language),
              header_type = VALUES(header_type),
              body_text = VALUES(body_text),
              footer_text = VALUES(footer_text),
              status = VALUES(status)
          `, [tplId, name, t.id, category, language, headerType, bodyText, footerText, status]);

          // Update memory store
          const existing = store.message_templates.find(m => m.name === name);
          if (existing) {
            existing.status = status;
            existing.body_text = bodyText || existing.body_text;
          } else {
            store.message_templates.push({
              id: tplId,
              name,
              category,
              language,
              header_type: headerType,
              body_text: bodyText,
              footer_text: footerText,
              status
            });
          }
          count++;
        } catch (e) {}
      }

      commitStoreMutation();
      logger.info('META_TEMPLATES_SYNCED', `Successfully synced ${count} templates from Meta Cloud API`);
      return { success: true, syncedCount: count };
    } catch (err: any) {
      logger.error('META_SYNC_FAILED', 'Failed syncing templates from Meta: ' + err.message);
      return { success: false, syncedCount: 0, error: err.message };
    }
  }

  /**
   * Deletes a template from Meta and archives/removes from MySQL.
   */
  static async deleteTemplate(name: string): Promise<{ success: boolean; error?: string }> {
    const cleanName = name.trim().toLowerCase();
    const wabaId = await this.resolveWabaId();
    const token = config.whatsapp.accessToken;

    if (wabaId && token) {
      try {
        await fetch(
          `${config.whatsapp.baseUrl}/${wabaId}/message_templates?name=${cleanName}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        logger.info('META_TEMPLATE_DELETED', `Deleted template '${cleanName}' from Meta Cloud API`);
      } catch (err: any) {
        logger.warn('META_TEMPLATE_DELETE_WARN', 'Could not delete from Meta API: ' + err.message);
      }
    }

    try {
      await executeQuery('DELETE FROM message_templates WHERE name = ?', [cleanName]);
      const store = getMemoryStore();
      store.message_templates = store.message_templates.filter(t => t.name !== cleanName);
      commitStoreMutation();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
