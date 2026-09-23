async function runTest() {
  console.log('Testing Send Test to Personal Phone Number API...');
  const BASE_URL = 'http://localhost:5000';

  // 1. Fetch an approved template
  const tplsRes = await fetch(`${BASE_URL}/api/templates`);
  const templates = (await tplsRes.json()) as any[];
  const approved = templates.find((t) => t.status === 'APPROVED');
  if (!approved) throw new Error('No approved template found for testing.');

  console.log(`✓ Using Approved Template: "${approved.name}" (ID: ${approved.id})`);

  // 2. Test send-test endpoint with a test phone number
  const testPhone = '+919876543210';
  const sendRes = await fetch(`${BASE_URL}/api/templates/${approved.id}/send-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone_number: testPhone,
      variables: { '1': 'Test User', '2': 'SAVE50' }
    })
  });

  const sendData = (await sendRes.json()) as any;
  console.log('✓ Send Test API Response:', sendData);
  if (!sendData.success) {
    throw new Error('Send test failed: ' + JSON.stringify(sendData));
  }

  // 3. Verify that the contact and message were logged in the CRM
  const convsRes = await fetch(`${BASE_URL}/api/conversations`);
  const convs = (await convsRes.json()) as any[];
  const match = convs.find((c) => c.phone_number === testPhone);
  if (!match) throw new Error('Conversation for test phone was not created in CRM.');

  console.log(`✓ Verified: Conversation created in CRM Query Inbox for ${match.phone_number}!`);
  console.log('🎉 SEND TEST FEATURE PASSING 100%!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
