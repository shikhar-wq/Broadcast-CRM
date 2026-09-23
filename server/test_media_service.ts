import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('====================================================');
  console.log('🛡️ TESTING MEDIA UPLOAD, SECURITY GUARDS & IMAGEKIT');
  console.log('====================================================\n');

  const BASE_URL = 'http://localhost:5000';

  // 1. Create a dummy test image (valid PNG file signature)
  const testImgPath = path.join(process.cwd(), 'data', 'test_sample.png');
  // Minimal 1x1 valid PNG buffer
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  fs.writeFileSync(testImgPath, pngBuffer);

  // 2. Test valid Image Upload
  console.log('1. Testing Valid Image Upload (PNG)...');
  const formData = new FormData();
  const fileBlob = new Blob([pngBuffer], { type: 'image/png' });
  formData.append('file', fileBlob, 'green_product.png');

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed with status: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  const uploadData = (await uploadRes.json()) as any;
  console.log('✓ Upload Success:', uploadData);
  if (!uploadData.url || !uploadData.fileType) {
    throw new Error('Upload response missing url or fileType');
  }

  // 3. Test Static Serving of Uploaded Media with nosniff security header
  console.log('\n2. Testing Static Serving & Anti-Sniffing Security Header...');
  const fileFetchRes = await fetch(uploadData.url);
  if (!fileFetchRes.ok) {
    throw new Error(`Failed to fetch uploaded file: ${fileFetchRes.status}`);
  }
  const nosniffHeader = fileFetchRes.headers.get('x-content-type-options');
  console.log(`✓ File fetched successfully (HTTP ${fileFetchRes.status})`);
  console.log(`✓ Security Header X-Content-Type-Options: ${nosniffHeader}`);
  if (nosniffHeader !== 'nosniff') {
    throw new Error('Expected X-Content-Type-Options: nosniff header');
  }

  // 4. Test Security Rejection of Malicious / Disallowed File Types
  console.log('\n3. Testing Security Defense Against Dangerous File Types (HTML/Script)...');
  const badFormData = new FormData();
  const badBlob = new Blob(['<script>alert("xss")</script>'], { type: 'text/html' });
  badFormData.append('file', badBlob, 'exploit.html');

  const badRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: badFormData
  });

  if (badRes.status === 400) {
    const badJson = (await badRes.json()) as any;
    console.log('✓ Malicious upload correctly rejected with HTTP 400:', badJson.error);
  } else {
    throw new Error(`Expected HTTP 400 rejection for HTML file, but received: ${badRes.status}`);
  }

  // 5. Test ImageKit Connection Validator Endpoint
  console.log('\n4. Testing ImageKit Connection Validator Endpoint...');
  const testIkRes = await fetch(`${BASE_URL}/api/settings/test-imagekit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: 'test_public_key',
      privateKey: 'test_private_key',
      urlEndpoint: 'https://ik.imagekit.io/test'
    })
  });
  const ikData = (await testIkRes.json()) as any;
  console.log('✓ ImageKit Validation Endpoint Response:', ikData);

  // 6. Test Creating a Template with the Uploaded Media Header
  console.log('\n5. Creating Template with the Uploaded Media URL...');
  const templatePayload = {
    name: `upload_test_tpl_${Date.now()}`,
    category: 'MARKETING',
    language: 'en_US',
    header_type: 'IMAGE',
    header_content: uploadData.url,
    body_text: 'Hello {{1}}, check out this uploaded photo template!',
    footer_text: 'Reply STOP to unsubscribe.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Interested' }],
    sample_values: ['Valued Client'],
    submit_immediately: true
  };

  const createTplRes = await fetch(`${BASE_URL}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templatePayload)
  });

  if (!createTplRes.ok) {
    throw new Error(`Failed to create template: ${await createTplRes.text()}`);
  }

  const createdTpl = (await createTplRes.json()) as any;
  console.log(`✓ Template created successfully with uploaded media! ID: ${createdTpl.id}`);
  console.log(`✓ Template Header Type: ${createdTpl.header_type}`);
  console.log(`✓ Template Header URL: ${createdTpl.header_content}`);

  // Clean up test image
  if (fs.existsSync(testImgPath)) {
    fs.unlinkSync(testImgPath);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL MEDIA UPLOADS & SECURITY DEFENSE TESTS PASSED 100%!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
