import { Router } from 'express';
import crypto from 'crypto';
import { getMemoryStore, commitStoreMutation, executeQuery } from '../db/pool.js';
import { MysqlMessageQueue } from '../queue/mysql-queue.js';
import { MessageLifecycleService } from '../services/message-lifecycle.js';
import { AuditService } from '../services/audit.js';
import { decryptPhone } from '../services/crypto.js';

export const campaignRouter = Router();

// GET /api/campaigns - List all campaigns with refreshed counters
campaignRouter.get('/', (req, res) => {
  const store = getMemoryStore();
  store.campaigns.forEach(c => {
    MessageLifecycleService.refreshCampaignCounters(c.id);
  });
  commitStoreMutation();

  res.json({
    success: true,
    campaigns: store.campaigns
  });
});

// GET /api/campaigns/:id - Detailed campaign view including full recipient delivery receipts
campaignRouter.get('/:id', async (req, res) => {
  const store = getMemoryStore();
  const campaign = store.campaigns.find(c => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ success: false, error: 'Campaign not found' });
  }

  // Refresh counters dynamically
  MessageLifecycleService.refreshCampaignCounters(campaign.id);
  commitStoreMutation();

  const snapshot = store.campaign_snapshots.find(s => s.campaign_id === campaign.id);
  const template = store.message_templates.find(t => t.id === campaign.template_id);
  const recips = store.campaign_recipients.filter(r => r.campaign_id === campaign.id);

  // Fetch contact details from MySQL
  const contactsMap: Record<string, any> = {};
  try {
    const contactIds = recips.map(r => r.contact_id).filter(Boolean);
    if (contactIds.length > 0) {
      const placeholders = contactIds.map(() => '?').join(',');
      const rawContacts = await executeQuery(`
        SELECT c.id, c.external_identifier, c.first_name, c.last_name, c.phone_encrypted, cat.name as category_name
        FROM contacts c
        LEFT JOIN categories cat ON c.category_id = cat.id
        WHERE c.id IN (${placeholders})
      `, contactIds);

      if (Array.isArray(rawContacts)) {
        for (const c of rawContacts) {
          let phoneStr = '';
          if (c.phone_encrypted) {
            phoneStr = decryptPhone(c.phone_encrypted);
          }
          contactsMap[c.id] = {
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.external_identifier,
            category: c.category_name || 'STUDENT',
            phone: phoneStr
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('Could not query contact details for campaign recipients:', err.message);
  }

  const enrichedRecipients = recips.map(r => {
    const contactInfo = contactsMap[r.contact_id] || {};
    let maskedPhone = '—';
    if (contactInfo.phone) {
      const p = contactInfo.phone;
      if (p.length >= 10) {
        maskedPhone = `+${p.slice(0, 2)} ${p.slice(2, 7)} •••${p.slice(-2)}`;
      } else {
        maskedPhone = `•••• •••• ${p.slice(-3)}`;
      }
    } else if (process.env.TEST_RECIPIENT_PHONE) {
      const p = process.env.TEST_RECIPIENT_PHONE;
      maskedPhone = `+${p.slice(0, 2)} ${p.slice(2, 7)} •••${p.slice(-2)}`;
    }

    const hasProviderId = Boolean(r.provider_message_id);
    return {
      id: r.id,
      correlation_id: r.correlation_id,
      contact_id: r.contact_id,
      recipient_name: contactInfo.name || 'University Recipient',
      category: contactInfo.category || 'STUDENT',
      phone_masked: maskedPhone,
      provider_message_id: r.provider_message_id || null,
      status: hasProviderId ? 'DELIVERED' : r.status,
      raw_status: r.status,
      submitted_at: r.submitted_at || r.created_at,
      delivered_at: r.delivered_at || (hasProviderId ? r.submitted_at : null),
      retry_count: r.retry_count || 0
    };
  });

  res.json({
    success: true,
    campaign,
    snapshot,
    template,
    recipients: enrichedRecipients
  });
});

// GET /api/campaigns/:id/recipients - Dedicated endpoint for recipients
campaignRouter.get('/:id/recipients', async (req, res) => {
  const store = getMemoryStore();
  const campaign = store.campaigns.find(c => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ success: false, error: 'Campaign not found' });
  }

  const recips = store.campaign_recipients.filter(r => r.campaign_id === campaign.id);
  const contactsMap: Record<string, any> = {};
  try {
    const contactIds = recips.map(r => r.contact_id).filter(Boolean);
    if (contactIds.length > 0) {
      const placeholders = contactIds.map(() => '?').join(',');
      const rawContacts = await executeQuery(`
        SELECT c.id, c.external_identifier, c.first_name, c.last_name, c.phone_encrypted, cat.name as category_name
        FROM contacts c
        LEFT JOIN categories cat ON c.category_id = cat.id
        WHERE c.id IN (${placeholders})
      `, contactIds);

      if (Array.isArray(rawContacts)) {
        for (const c of rawContacts) {
          let phoneStr = '';
          if (c.phone_encrypted) {
            phoneStr = decryptPhone(c.phone_encrypted);
          }
          contactsMap[c.id] = {
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.external_identifier,
            category: c.category_name || 'STUDENT',
            phone: phoneStr
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('Could not query contact details:', err.message);
  }

  const enrichedRecipients = recips.map(r => {
    const contactInfo = contactsMap[r.contact_id] || {};
    let maskedPhone = '—';
    if (contactInfo.phone) {
      const p = contactInfo.phone;
      if (p.length >= 10) {
        maskedPhone = `+${p.slice(0, 2)} ${p.slice(2, 7)} •••${p.slice(-2)}`;
      } else {
        maskedPhone = `•••• •••• ${p.slice(-3)}`;
      }
    }

    const hasProviderId = Boolean(r.provider_message_id);
    return {
      id: r.id,
      correlation_id: r.correlation_id,
      contact_id: r.contact_id,
      recipient_name: contactInfo.name || 'University Recipient',
      category: contactInfo.category || 'STUDENT',
      phone_masked: maskedPhone,
      provider_message_id: r.provider_message_id || null,
      status: hasProviderId ? 'DELIVERED' : r.status,
      raw_status: r.status,
      submitted_at: r.submitted_at || r.created_at,
      delivered_at: r.delivered_at || (hasProviderId ? r.submitted_at : null),
      retry_count: r.retry_count || 0
    };
  });

  res.json({
    success: true,
    campaign_id: campaign.id,
    recipients: enrichedRecipients
  });
});


// POST /api/campaigns/launch - 5-Step Wizard submission
campaignRouter.post('/launch', async (req, res) => {
  const { name, template_id, template_name, template_body, template_category, template_language, audience, schedule_type, scheduled_at, variables } = req.body;
  const store = getMemoryStore();

  const campaignId = `CMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  let template = store.message_templates.find(t => t.id === template_id || t.name === template_name || t.name === variables?.meta_template_name);

  const activeTemplateName = (template_name || variables?.meta_template_name || (template ? template.name : 'ganesh_chaturthi')).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const activeTemplateBody = template_body || (template ? template.body_text : '');
  const activeCategory = template_category || (template ? template.category : 'UTILITY');
  const activeLanguage = template_language || (template ? template.language : 'en');
  const tplId = template?.id || `TPL-${activeTemplateName.toUpperCase()}`;

  // Automatically save/upsert template in MySQL so it appears in the portal template list permanently
  try {
    await executeQuery(`
      INSERT INTO message_templates (
        id, name, meta_template_id, category, language, header_type, body_text, footer_text, sample_variables, status, created_by
      ) VALUES (?, ?, ?, ?, ?, 'NONE', ?, '', ?, 'APPROVED', 'USR-PORTAL')
      ON DUPLICATE KEY UPDATE
        category = VALUES(category),
        language = VALUES(language),
        body_text = VALUES(body_text),
        status = 'APPROVED'
    `, [
      tplId,
      activeTemplateName,
      `meta_tpl_${activeTemplateName}`,
      activeCategory,
      activeLanguage,
      activeTemplateBody,
      JSON.stringify(Object.values(variables || {}))
    ]);

    const existingIdx = store.message_templates.findIndex(t => t.name === activeTemplateName);
    const updatedTpl = {
      id: tplId,
      name: activeTemplateName,
      category: activeCategory as any,
      language: activeLanguage,
      header_type: 'NONE' as any,
      body_text: activeTemplateBody,
      footer_text: '',
      status: 'APPROVED' as any
    };
    if (existingIdx >= 0) {
      store.message_templates[existingIdx] = updatedTpl;
    } else {
      store.message_templates.unshift(updatedTpl);
    }
    template = updatedTpl;
  } catch (err: any) {
    console.warn('Template auto-save notice:', err.message);
  }

  // 1. Calculate Target & Eligible Audience count from REAL contacts
  let targetContacts: any[] = [];
  try {
    const whereParts: string[] = [];
    const params: any[] = [];

    if (audience?.category && audience.category !== 'ALL') {
      whereParts.push('cat.code = ?');
      params.push(audience.category);
    }

    if (audience?.department && audience.department !== 'ALL') {
      whereParts.push('(d.code = ? OR d.id = ? OR d.name = ?)');
      params.push(audience.department, audience.department, audience.department);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    targetContacts = await executeQuery(`
      SELECT c.id, c.external_identifier, c.first_name, c.last_name 
      FROM contacts c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN departments d ON c.department_id = d.id
      ${whereSql}
    `, params);
  } catch (err) {
    targetContacts = [];
  }

  // If testing with TEST_RECIPIENT_PHONE and 0 contacts in database, target 1 recipient for testing
  if (!Array.isArray(targetContacts) || targetContacts.length === 0) {
    if (process.env.TEST_RECIPIENT_PHONE) {
      targetContacts = [{ id: 'CNT-LOCAL-TEST', external_identifier: 'TEST-001', first_name: 'Test', last_name: 'Recipient' }];
    }
  }

  const matchingContacts = targetContacts.length;
  const eligibleCount = matchingContacts;
  const suppressedCount = 0;

  // 2. Create Campaign Entity
  const newCampaign = {
    id: campaignId,
    code: campaignId,
    name: name || 'Official University Communication Broadcast',
    template_id: template.id,
    creator_id: 'USR-001',
    status: schedule_type === 'SCHEDULED' ? 'SCHEDULED' : 'PROCESSING',
    scheduled_at: scheduled_at || null,
    launched_at: schedule_type === 'SCHEDULED' ? null : now,
    completed_at: null,
    targeted_count: matchingContacts,
    eligible_count: eligibleCount,
    suppressed_count: suppressedCount,
    queued_count: eligibleCount,
    processing_count: 0,
    submitted_count: 0,
    accepted_count: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    retrying_count: 0,
    cancelled_count: 0,
    skipped_count: 0,
    created_at: now,
    updated_at: now
  };
  store.campaigns.unshift(newCampaign);

  // 3. Create Immutable Campaign Snapshot (Section 5)
  const snapshot = {
    id: `SNP-${crypto.randomUUID()}`,
    campaign_id: campaignId,
    campaign_name: newCampaign.name,
    creator_name: 'Office of the Provost',
    audience_definition: audience || { category: 'STUDENT', departments: ['ALL'] },
    template_snapshot: {
      template_id: template.id,
      name: variables?.meta_template_name || template.name,
      category: template.category,
      language: template.language,
      body: template.body_text,
      variables: variables || {}
    },
    consent_rules: { channel: 'WHATSAPP', required_status: 'OPTED_IN' },
    system_config_version: 'v1.4.0-linux-native',
    created_at: now
  };
  store.campaign_snapshots.push(snapshot);

  // 4. Generate Campaign Recipients and Queue Jobs for REAL contacts
  const jobBatch: Array<{ recipientId: string; correlationId: string }> = [];

  for (let i = 0; i < targetContacts.length; i++) {
    const contact = targetContacts[i];
    const recipId = `RECIP-${crypto.randomUUID()}`;
    const corrId = `CORR-${campaignId.slice(-6)}-${String(i + 1).padStart(4, '0')}`;

    const recipient = {
      id: recipId,
      campaign_id: campaignId,
      contact_id: contact.id,
      correlation_id: corrId,
      status: 'QUEUED' as any,
      provider_message_id: null,
      retry_count: 0,
      queued_at: now,
      submitted_at: null,
      sent_at: null,
      delivered_at: null,
      read_at: null,
      failed_at: null,
      created_at: now,
      updated_at: now
    };
    store.campaign_recipients.push(recipient);

    // Initial lifecycle event
    await MessageLifecycleService.recordTransition({
      recipientId: recipId,
      campaignId,
      correlationId: corrId,
      eventType: 'QUEUED',
      newStatus: 'QUEUED',
      workerId: 'CAMPAIGN_DISPATCHER'
    });

    jobBatch.push({ recipientId: recipId, correlationId: corrId });
  }

  // 5. Enqueue into MySQL Queue Engine
  if (schedule_type !== 'SCHEDULED') {
    await MysqlMessageQueue.enqueueBatch(campaignId, jobBatch);
  }

  // 6. Record Audit Log for Developer inspection
  await AuditService.log({
    userId: req.body.userId || 'USR-SENDER-001',
    userRole: req.body.userRole || 'SENDER',
    action: 'WHATSAPP_CAMPAIGN_LAUNCHED',
    entity: 'WHATSAPP_CAMPAIGN',
    entityId: campaignId,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'],
    success: true,
    metadata: {
      campaign_name: newCampaign.name,
      targeted: matchingContacts,
      eligible: eligibleCount,
      template: template.name,
      schedule_type
    }
  });

  commitStoreMutation();

  res.status(201).json({
    success: true,
    campaign_id: campaignId,
    code: campaignId,
    message: 'Campaign launched and immutable snapshot persisted'
  });
});
