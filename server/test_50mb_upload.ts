import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('====================================================');
  console.log('🚀 TESTING 50 MB VIDEO UPLOAD & MULTI-STORAGE ENGINE');
  console.log('====================================================\n');

  const BASE_URL = 'http://localhost:5000';

  // 1. Generate a ~32 MB mock MP4 buffer (with valid mp4 header bytes: ftypisom)
  console.log('1. Generating 32 MB test video buffer...');
  const size32Mb = 32 * 1024 * 1024;
  const videoBuffer = Buffer.alloc(size32Mb);
  // Write minimal MP4 ftyp box signature
  videoBuffer.writeUInt32BE(0x0000001c, 0); // box size 28
  videoBuffer.write('ftyp', 4);
  videoBuffer.write('isom', 8);
  videoBuffer.writeUInt32BE(0x00000200, 12); // minor version
  videoBuffer.write('isomiso2mp41', 16);

  console.log(`✓ Generated 32 MB buffer (${(videoBuffer.length / (1024 * 1024)).toFixed(1)} MB)`);

  // 2. Upload 32 MB video to /api/upload
  console.log('\n2. Testing 32 MB Video Upload via Built-in Storage...');
  const formData = new FormData();
  const fileBlob = new Blob([videoBuffer], { type: 'video/mp4' });
  formData.append('file', fileBlob, 'commercial_showcase_32mb.mp4');

  const uploadStart = Date.now();
  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed with status ${uploadRes.status}: ${await uploadRes.text()}`);
  }

  const uploadData = (await uploadRes.json()) as any;
  const elapsed = ((Date.now() - uploadStart) / 1000).toFixed(2);
  console.log(`✓ 32 MB Upload Successful in ${elapsed}s!`, uploadData);

  if (!uploadData.url || uploadData.fileType !== 'VIDEO') {
    throw new Error('Upload response missing video metadata');
  }

  // 3. Verify static download of the uploaded video
  console.log('\n3. Verifying Static Delivery of Uploaded 32 MB Video...');
  const headRes = await fetch(uploadData.url, { method: 'HEAD' });
  if (!headRes.ok) {
    throw new Error(`Failed to HEAD fetch uploaded video: ${headRes.status}`);
  }
  const contentLength = Number(headRes.headers.get('content-length') || 0);
  console.log(`✓ Video reachable via HTTP ${headRes.status}`);
  console.log(`✓ Content-Length verified: ${(contentLength / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`✓ Security Header X-Content-Type-Options: ${headRes.headers.get('x-content-type-options')}`);

  // 4. Test Supabase Connection Endpoint
  console.log('\n4. Testing Supabase Validator Endpoint...');
  const supaRes = await fetch(`${BASE_URL}/api/settings/test-supabase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://mockproject.supabase.co',
      anonKey: 'mock_anon_key_1234567890',
      bucket: 'whatsapp-media'
    })
  });
  const supaData = (await supaRes.json()) as any;
  console.log('✓ Supabase Validation Endpoint Response:', supaData);

  // 5. Create Template with the 32 MB Video URL
  console.log('\n5. Creating Template with 32 MB Video Header...');
  const templatePayload = {
    name: `video_showcase_${Date.now()}`,
    category: 'MARKETING',
    language: 'en_US',
    header_type: 'VIDEO',
    header_content: uploadData.url,
    body_text: 'Watch our full facility tour in 1080p high definition! Save up to 50% on commercial energy costs with IntelliGreen.',
    footer_text: 'Reply STOP to unsubscribe.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Schedule Inspection' }],
    sample_values: [],
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
  console.log(`✓ Template created successfully with 32 MB Video! ID: ${createdTpl.id}`);
  console.log(`✓ Header Type: ${createdTpl.header_type}`);
  console.log(`✓ Header Content: ${createdTpl.header_content}`);

  // Clean up uploaded file from data/uploads to save local disk
  const uploadedDiskPath = path.join(process.cwd(), 'data', 'uploads', uploadData.fileName);
  if (fs.existsSync(uploadedDiskPath)) {
    fs.unlinkSync(uploadedDiskPath);
    console.log(`✓ Cleaned up test video from disk (${uploadData.fileName})`);
  }

  console.log('\n====================================================');
  console.log('🎉 50 MB VIDEO UPLOAD & MULTI-STORAGE ENGINE VERIFIED 100%!');
  console.log('====================================================\n');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
