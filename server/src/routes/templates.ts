import { Router } from 'express';
import crypto from 'crypto';
import { executeQuery, getMemoryStore } from '../db/pool.js';
import { logger } from '../services/logger.js';
import { WhatsAppTemplateService } from '../services/whatsapp-templates.js';

export const templatesRouter = Router();

// GET /api/templates - Retrieve all approved Meta templates from MySQL
templatesRouter.get('/', async (req, res) => {
  try {
    const rawTemplates = await executeQuery(`
      SELECT 
        id, 
        name, 
        category, 
        language, 
        header_type, 
        body_text as body, 
        footer_text, 
        sample_variables, 
        status,
        created_at
      FROM message_templates
      ORDER BY created_at DESC
    `);

    let templates: any[] = [];
    if (Array.isArray(rawTemplates) && rawTemplates.length > 0) {
      templates = rawTemplates.map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        language: t.language,
        header_type: t.header_type,
        body: t.body,
        footer_text: t.footer_text || '',
        sampleVariables: typeof t.sample_variables === 'string'
          ? JSON.parse(t.sample_variables)
          : (Array.isArray(t.sample_variables) ? t.sample_variables : []),
        status: t.status
      }));
    } else {
      // Fallback to memory store if MySQL returned empty
      const store = getMemoryStore();
      templates = store.message_templates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        language: t.language,
        header_type: t.header_type,
        body: t.body_text,
        footer_text: t.footer_text || '',
        sampleVariables: [],
        status: t.status
      }));
    }

    res.json({
      success: true,
      templates
    });
  } catch (err: any) {
    logger.warn('TEMPLATES_FETCH', 'Failed reading templates from database', { details: { error: err.message } });
    const store = getMemoryStore();
    res.json({
      success: true,
      templates: store.message_templates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        language: t.language,
        header_type: t.header_type,
        body: t.body_text,
        footer_text: t.footer_text || '',
        sampleVariables: [],
        status: t.status
      }))
    });
  }
});

// POST /api/templates - Save or register a new Meta template into MySQL
templatesRouter.post('/', async (req, res) => {
  try {
    const { name, category, language, body, sample_variables, header_type, footer_text } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Template name is required' });
    }

    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const templateId = `TPL-${cleanName.toUpperCase()}`;
    const tCategory = category || 'UTILITY';
    const tLanguage = language || 'en';
    const tBody = body || '';
    const tHeaderType = header_type || 'NONE';
    const tFooter = footer_text || '';
    const tSampleVars = JSON.stringify(Array.isArray(sample_variables) ? sample_variables : []);

    // Upsert into MySQL message_templates
    await executeQuery(`
      INSERT INTO message_templates (
        id, name, meta_template_id, category, language, header_type, body_text, footer_text, sample_variables, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 'USR-PORTAL')
      ON DUPLICATE KEY UPDATE
        category = VALUES(category),
        language = VALUES(language),
        header_type = VALUES(header_type),
        body_text = VALUES(body_text),
        footer_text = VALUES(footer_text),
        sample_variables = VALUES(sample_variables),
        status = 'APPROVED'
    `, [
      templateId,
      cleanName,
      `meta_tpl_${cleanName}`,
      tCategory,
      tLanguage,
      tHeaderType,
      tBody,
      tFooter,
      tSampleVars
    ]);

    // Also update in-memory store
    const store = getMemoryStore();
    const existingIndex = store.message_templates.findIndex(t => t.name === cleanName);
    const newTplObj = {
      id: templateId,
      name: cleanName,
      category: tCategory as any,
      language: tLanguage,
      header_type: tHeaderType as any,
      body_text: tBody,
      footer_text: tFooter,
      status: 'APPROVED' as any
    };

    if (existingIndex >= 0) {
      store.message_templates[existingIndex] = newTplObj;
    } else {
      store.message_templates.unshift(newTplObj);
    }

    logger.info('TEMPLATE_SAVED', `Template '${cleanName}' successfully saved into database`, {
      details: { templateId, name: cleanName, category: tCategory }
    });

    res.json({
      success: true,
      message: `Template '${cleanName}' registered and saved successfully`,
      template: {
        id: templateId,
        name: cleanName,
        category: tCategory,
        language: tLanguage,
        body: tBody,
        sampleVariables: Array.isArray(sample_variables) ? sample_variables : [],
        status: 'APPROVED'
      }
    });
  } catch (err: any) {
    logger.error('TEMPLATE_SAVE_ERROR', 'Failed saving template to MySQL', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message || 'Database error saving template' });
  }
});

// POST /api/templates/create-and-submit - Studio endpoint submitting directly to Meta Cloud API
templatesRouter.post('/create-and-submit', async (req, res) => {
  try {
    const userRole = (req.body.userRole || 'STAFF') as string;
    const userId = (req.body.userId || 'USR-001') as string;

    const result = await WhatsAppTemplateService.createAndSubmit(req.body, userRole, userId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (err: any) {
    logger.error('TEMPLATE_STUDIO_ERROR', 'Unexpected error in template studio submission: ' + err.message);
    return res.status(500).json({ success: false, error: err.message || 'Internal error creating template' });
  }
});

// POST /api/templates/sync - 1-Click sync templates and statuses from Meta Cloud API
templatesRouter.post('/sync', async (req, res) => {
  try {
    const result = await WhatsAppTemplateService.syncFromMeta();
    return res.json(result);
  } catch (err: any) {
    logger.error('TEMPLATE_SYNC_ERROR', 'Error syncing from Meta: ' + err.message);
    return res.status(500).json({ success: false, error: err.message || 'Failed to sync templates from Meta' });
  }
});

// DELETE /api/templates/:name - Delete template from Meta and MySQL
templatesRouter.delete('/:name', async (req, res) => {
  try {
    const result = await WhatsAppTemplateService.deleteTemplate(req.params.name);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete template' });
  }
});

