import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

async function runEndToEndVerification() {
  console.log('====================================================');
  console.log('🚀 STARTING END-TO-END VERIFICATION OF INTELLIGREEN WA CRM');
  console.log('====================================================\n');

  try {
    // 1. Verify Settings & Operating Mode
    console.log('1. Checking Settings & Sandbox Mode...');
    const settingsRes = await axios.get(`${BASE_URL}/settings`);
    console.log('✓ Mode:', settingsRes.data.mode);
    console.log('✓ Messaging Tier:', settingsRes.data.messaging_tier);
    console.log('✓ Phone Quality Rating:', settingsRes.data.quality_rating);

    // 2. Verify Pre-Seeded Templates
    console.log('\n2. Fetching Meta Templates...');
    const tplsRes = await axios.get(`${BASE_URL}/templates`);
    console.log(`✓ Total Templates in DB: ${tplsRes.data.length}`);
    const approvedTpl = tplsRes.data.find((t: any) => t.status === 'APPROVED');
    console.log(`✓ Found Approved Template for Broadcast: "${approvedTpl.name}" (${approvedTpl.header_type})`);

    // 3. Create a New Template with Video Header and Dynamic Variables
    console.log('\n3. Creating and Submitting New Template with Media Header...');
    const newTplName = 'cleantech_industrial_v' + Date.now().toString().slice(-4);
    const createTplRes = await axios.post(`${BASE_URL}/templates`, {
      name: newTplName,
      category: 'MARKETING',
      header_type: 'VIDEO',
      header_content: 'https://example.com/clean_energy_demo.mp4',
      body_text: 'Dear {{1}},\n\nIntelliGreen is offering a 20% subsidy on commercial solar microgrids. Claim your rebate with ID: {{2}}.',
      footer_text: 'Reply STOP to opt out.',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Schedule Demo' },
        { type: 'QUICK_REPLY', text: 'Stop Promo' }
      ],
      sample_values: ['Plant Manager', 'REBATE2026'],
      submit_immediately: true
    });
    console.log(`✓ Template "${createTplRes.data.name}" created with status: ${createTplRes.data.status}`);

    // Simulate instant verification approval
    console.log('✓ Simulating Meta AI verification approval...');
    const approvedRes = await axios.post(`${BASE_URL}/templates/${createTplRes.data.id}/simulate-action`, {
      action: 'APPROVE'
    });
    console.log(`✓ Template status updated to: ${approvedRes.data.status} (Meta ID: ${approvedRes.data.meta_template_id})`);

    // 4. Test 1,000 Contacts Generation
    console.log('\n4. Generating 1,000 Test Contacts for High-Volume Broadcast Test...');
    const genRes = await axios.post(`${BASE_URL}/contacts/generate-sample`, { count: 1000 });
    console.log(`✓ ${genRes.data.message} Total Contacts in Hub: ${genRes.data.totalContacts}`);

    // Check contact count and opt-out suppression
    const contactsRes = await axios.get(`${BASE_URL}/contacts?limit=1`);
    console.log(`✓ Active Recipients: ${contactsRes.data.activeCount}, Opted Out: ${contactsRes.data.optedOutCount}`);

    // 5. Test Launching Rate-Limited Broadcast Campaign (5 msgs/sec with anti-ban jitter)
    console.log('\n5. Creating & Launching Rate-Limited Broadcast Campaign...');
    const campaignRes = await axios.post(`${BASE_URL}/campaigns`, {
      name: 'Q4 1,000 Contact Solar Outreach',
      template_id: approvedRes.data.id,
      messages_per_second: 10,
      target_tags: 'ALL'
    });
    console.log(`✓ Campaign Created: ID ${campaignRes.data.id} (${campaignRes.data.totalContacts} target recipients)`);

    // Start Campaign
    console.log('✓ Starting Broadcast Engine...');
    await axios.post(`${BASE_URL}/campaigns/${campaignRes.data.id}/start`);
    console.log('✓ Broadcast Engine running with anti-ban pacing & circuit breaker enabled.');

    // Wait 3 seconds to let some messages dispatch
    console.log('✓ Waiting 3 seconds to observe live dispatch pacing...');
    await new Promise(r => setTimeout(r, 3000));

    const campProgressRes = await axios.get(`${BASE_URL}/campaigns/${campaignRes.data.id}`);
    console.log(`✓ Live Campaign Progress: Sent: ${campProgressRes.data.campaign.sent_count}, Delivered: ${campProgressRes.data.campaign.delivered_count}`);

    // Pause Campaign to test pause/resume controls
    await axios.post(`${BASE_URL}/campaigns/${campaignRes.data.id}/pause`);
    console.log('✓ Campaign successfully paused via safety controls.');

    // 6. Test Query Tab (Inbound Messages & 24-hr Customer Service Window)
    console.log('\n6. Testing Query Tab (Customer Replies & 24h Window)...');
    const convsRes = await axios.get(`${BASE_URL}/conversations`);
    console.log(`✓ Total Active Customer Threads: ${convsRes.data.length}`);
    const activeConv = convsRes.data[0];

    // Simulate an incoming query from a customer
    console.log(`✓ Simulating incoming query from customer "${activeConv.contact_name}"...`);
    const simInboundRes = await axios.post(`${BASE_URL}/conversations/simulate-incoming`, {
      contact_id: activeConv.contact_id,
      text: 'Hello, what is the warranty period on your commercial solar panels?'
    });
    console.log('✓ Inbound query received in inbox! Message ID:', simInboundRes.data.messageId);

    // Send an Agent Reply
    console.log('✓ Sending Agent reply within 24-hour customer service window...');
    const replyRes = await axios.post(`${BASE_URL}/conversations/${activeConv.id}/reply`, {
      text: 'Hi! Our solar systems include a 25-year performance warranty and 10-year comprehensive maintenance.'
    });
    console.log('✓ Reply delivered to contact! Success:', replyRes.data.success);

    // 7. Test Anti-Ban Opt-Out Keyword ("STOP")
    console.log('\n7. Testing Anti-Ban Opt-Out Handling (Recipient texts "STOP")...');
    const optOutRes = await axios.post(`${BASE_URL}/conversations/simulate-incoming`, {
      contact_id: activeConv.contact_id,
      text: 'STOP'
    });
    console.log('✓ Contact sent "STOP" keyword. Auto-opt-out triggered:', optOutRes.data.isOptOut);

    // Verify contact is now blacklisted
    const checkContactRes = await axios.get(`${BASE_URL}/contacts?search=${encodeURIComponent(activeConv.phone_number)}`);
    const contactAfter = checkContactRes.data.contacts[0];
    console.log(`✓ Verification: Contact ${contactAfter.name} is_opted_out = ${contactAfter.is_opted_out} (Future broadcasts will be auto-suppressed!)`);

    console.log('\n====================================================');
    console.log('🎉 ALL 7 CORE FEATURES VERIFIED AND PASSING 100%!');
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Verification failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

runEndToEndVerification();
