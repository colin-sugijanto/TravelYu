export const travelYuNotificationWorkflow = {
  name: "TravelYu Notifications (Gmail + Evolution)",
  active: false,
  settings: {
    executionOrder: "v1",
  },
  nodes: [
    {
      id: "1",
      name: "Webhook: TravelYu Events",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 0],
      parameters: {
        httpMethod: "POST",
        path: "travelyu/notifications",
        responseMode: "onReceived",
      },
    },
    {
      id: "2",
      name: "Normalize Payload",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [220, 0],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            { name: "event_type", value: "={{$json.body.event_type || $json.event_type}}", type: "string" },
            {
              name: "channel_preference",
              value:
                "={{ (() => { const pref = String($json.body?.channel_preference ?? $json.channel_preference ?? '').toLowerCase(); const email = String($json.body?.email ?? $json.email ?? '').trim(); const phone = String($json.body?.phone_e164 ?? $json.phone_e164 ?? '').trim(); if (pref === 'both') return email && phone ? 'both' : (email ? 'email' : (phone ? 'whatsapp' : 'email')); if (pref === 'email') return email ? 'email' : (phone ? 'whatsapp' : 'email'); if (pref === 'whatsapp') return phone ? 'whatsapp' : (email ? 'email' : 'whatsapp'); if (email && phone) return 'both'; if (phone) return 'whatsapp'; return 'email'; })() }}",
              type: "string",
            },
            { name: "email", value: "={{$json.body.email || $json.email}}", type: "string" },
            { name: "phone_e164", value: "={{$json.body.phone_e164 || $json.phone_e164}}", type: "string" },
            { name: "user_name", value: "={{$json.body.user_name || $json.user_name || 'Traveler'}}", type: "string" },
            { name: "trip_id", value: "={{$json.body.trip_id || $json.trip_id}}", type: "string" },
            { name: "subject_override", value: "={{$json.body.subject || $json.subject || ''}}", type: "string" },
            { name: "email_text_override", value: "={{$json.body.email_text || $json.email_text || ''}}", type: "string" },
            { name: "wa_text_override", value: "={{$json.body.wa_text || $json.wa_text || ''}}", type: "string" },
          ],
        },
      },
    },
    {
      id: "3",
      name: "Switch Event Type",
      type: "n8n-nodes-base.switch",
      typeVersion: 3.2,
      position: [460, 0],
      parameters: {
        mode: "rules",
        rules: {
          values: [
            { conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{$json.event_type}}", rightValue: "itinerary_ready", operator: { type: "string", operation: "equals" } }] } },
            { conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{$json.event_type}}", rightValue: "cs_approved", operator: { type: "string", operation: "equals" } }] } },
            { conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{$json.event_type}}", rightValue: "trip_reminder_h1", operator: { type: "string", operation: "equals" } }] } },
            { conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{$json.event_type}}", rightValue: "vendor_contact", operator: { type: "string", operation: "equals" } }] } },
          ],
        },
      },
    },
    {
      id: "4",
      name: "Set Message Itinerary Ready",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [700, -120],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            { name: "subject", value: "={{$json.subject_override || 'Your itinerary is ready'}}", type: "string" },
            { name: "email_text", value: "={{$json.email_text_override || ('Hi ' + $json.user_name + ', your itinerary for trip ' + $json.trip_id + ' is ready.')}}", type: "string" },
            { name: "wa_text", value: "={{$json.wa_text_override || ('Hi ' + $json.user_name + ', itinerary trip ' + $json.trip_id + ' sudah siap.')}}", type: "string" },
          ],
        },
      },
    },
    {
      id: "5",
      name: "Set Message CS Approved",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [700, -20],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            { name: "subject", value: "={{$json.subject_override || 'CS approved your request'}}", type: "string" },
            { name: "email_text", value: "={{$json.email_text_override || ('Perubahan itinerary untuk trip ' + $json.trip_id + ' sudah disetujui CS.')}}", type: "string" },
            { name: "wa_text", value: "={{$json.wa_text_override || ('Permintaan perubahan trip ' + $json.trip_id + ' sudah disetujui CS.')}}", type: "string" },
          ],
        },
      },
    },
    {
      id: "6",
      name: "Set Message Trip Reminder",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [700, 80],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            { name: "subject", value: "={{$json.subject_override || 'Trip reminder H-1'}}", type: "string" },
            { name: "email_text", value: "={{$json.email_text_override || ('Reminder: trip ' + $json.trip_id + ' mulai besok. Jangan lupa packing list.')}}", type: "string" },
            { name: "wa_text", value: "={{$json.wa_text_override || ('Reminder H-1 untuk trip ' + $json.trip_id + '. Cek packing list ya.')}}", type: "string" },
          ],
        },
      },
    },
    {
      id: "7",
      name: "Set Message Vendor Contact",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [700, 180],
      parameters: {
        mode: "manual",
        assignments: {
          assignments: [
            { name: "subject", value: "={{$json.subject_override || 'TravelYu Vendor Message'}}", type: "string" },
            { name: "email_text", value: "={{$json.email_text_override || $json.wa_text_override || 'TravelYu update'}}", type: "string" },
            { name: "wa_text", value: "={{$json.wa_text_override || $json.email_text_override || 'TravelYu update'}}", type: "string" },
          ],
        },
      },
    },
    {
      id: "8",
      name: "Switch Channel",
      type: "n8n-nodes-base.switch",
      typeVersion: 3.2,
      position: [930, 20],
      parameters: {
        mode: "rules",
        rules: {
          values: [
            { conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{$json.channel_preference}}", rightValue: "email", operator: { type: "string", operation: "equals" } }] } },
            { conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{$json.channel_preference}}", rightValue: "whatsapp", operator: { type: "string", operation: "equals" } }] } },
            { conditions: { options: { caseSensitive: true }, conditions: [{ leftValue: "={{$json.channel_preference}}", rightValue: "both", operator: { type: "string", operation: "equals" } }] } },
          ],
        },
      },
    },
    {
      id: "9",
      name: "Send Email Gmail",
      type: "n8n-nodes-base.gmail",
      typeVersion: 2.2,
      position: [1160, -40],
      parameters: {
        resource: "message",
        operation: "send",
        sendTo: "={{$json.email}}",
        subject: "={{$json.subject}}",
        message: "={{$json.email_text}}",
        emailType: "text",
      },
    },
    {
      id: "10",
      name: "Send WhatsApp Evolution",
      type: "n8n-nodes-evolution-api.evolutionapi",
      typeVersion: 1,
      position: [1160, 100],
      parameters: {
        resource: "messages-api",
        operation: "send-text",
        remoteJid:
          "={{ (() => { const raw = String($json.phone_e164 ?? '').replace(/\\D/g, ''); if (!raw) return ''; const normalized = raw.startsWith('62') ? raw : (raw.startsWith('0') ? ('62' + raw.slice(1)) : (raw.startsWith('8') ? ('62' + raw) : raw)); return normalized ? (normalized + '@s.whatsapp.net') : ''; })() }}",
        messageText: "={{$json.wa_text}}",
        instanceName: "={{$env.EVOLUTION_INSTANCE || 'n8n'}}",
        options_message: {},
      },
    },
  ],
  connections: {
    "Webhook: TravelYu Events": { main: [[{ node: "Normalize Payload", type: "main", index: 0 }]] },
    "Normalize Payload": { main: [[{ node: "Switch Event Type", type: "main", index: 0 }]] },
    "Switch Event Type": {
      main: [
        [{ node: "Set Message Itinerary Ready", type: "main", index: 0 }],
        [{ node: "Set Message CS Approved", type: "main", index: 0 }],
        [{ node: "Set Message Trip Reminder", type: "main", index: 0 }],
        [{ node: "Set Message Vendor Contact", type: "main", index: 0 }],
      ],
    },
    "Set Message Itinerary Ready": { main: [[{ node: "Switch Channel", type: "main", index: 0 }]] },
    "Set Message CS Approved": { main: [[{ node: "Switch Channel", type: "main", index: 0 }]] },
    "Set Message Trip Reminder": { main: [[{ node: "Switch Channel", type: "main", index: 0 }]] },
    "Set Message Vendor Contact": { main: [[{ node: "Switch Channel", type: "main", index: 0 }]] },
    "Switch Channel": {
      main: [
        [{ node: "Send Email Gmail", type: "main", index: 0 }],
        [{ node: "Send WhatsApp Evolution", type: "main", index: 0 }],
        [{ node: "Send Email Gmail", type: "main", index: 0 }, { node: "Send WhatsApp Evolution", type: "main", index: 0 }],
      ],
    },
  },
} as const;
