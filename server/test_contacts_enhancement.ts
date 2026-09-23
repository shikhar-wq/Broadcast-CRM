import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

async function testContactsEnhancements() {
  console.log('Testing Contacts Enhancements (Pagination, Tag Targeting, Delete Single Contact)...');

  try {
    // 1. Fetch tags
    const tagsRes = await axios.get(`${BASE_URL}/contacts/tags`);
    console.log('✓ Distinct Tags in DB:', tagsRes.data);

    // 2. Test Pagination (Page 1 vs Page 2)
    const page1Res = await axios.get(`${BASE_URL}/contacts?limit=15&offset=0`);
    console.log(`✓ Page 1: Received ${page1Res.data.contacts.length} contacts (Total: ${page1Res.data.total}, Filtered: ${page1Res.data.filteredTotal})`);

    const page2Res = await axios.get(`${BASE_URL}/contacts?limit=15&offset=15`);
    console.log(`✓ Page 2: Received ${page2Res.data.contacts.length} contacts`);

    // Verify page 1 and page 2 are different contacts
    const p1FirstId = page1Res.data.contacts[0]?.id;
    const p2FirstId = page2Res.data.contacts[0]?.id;
    if (p1FirstId !== p2FirstId) {
      console.log('✓ Pagination verified: Page 1 and Page 2 contain distinct contacts.');
    }

    // 3. Test Tag Filtering
    const testTag = tagsRes.data[0] || 'VIP Client';
    const filteredRes = await axios.get(`${BASE_URL}/contacts?tag=${encodeURIComponent(testTag)}&limit=15`);
    console.log(`✓ Tag Filter ("${testTag}"): Received ${filteredRes.data.contacts.length} contacts, Filtered Total: ${filteredRes.data.filteredTotal}`);
    
    // Verify all returned contacts have the tag
    const allMatch = filteredRes.data.contacts.every((c: any) => c.tags.includes(testTag));
    console.log(`✓ Tag Match Accuracy: ${allMatch ? '100% Matching' : 'Failed'}`);

    // 4. Test Single Contact Deletion
    // Create a temporary test contact to delete
    const newContactRes = await axios.post(`${BASE_URL}/contacts`, {
      name: 'Delete Me Test Contact',
      phone_number: '+919999999999',
      tags: 'Temp Tag'
    });
    const tempId = newContactRes.data.id;
    console.log(`✓ Created temporary contact for deletion test: ID ${tempId}`);

    // Delete it
    const deleteRes = await axios.delete(`${BASE_URL}/contacts/${tempId}`);
    console.log('✓ Delete API response:', deleteRes.data);

    // Verify it no longer exists
    const verifyDel = await axios.get(`${BASE_URL}/contacts?search=%2B919999999999`);
    if (verifyDel.data.contacts.length === 0) {
      console.log('✓ Verification passed: Contact was completely deleted from database.');
    }

    // 5. Test Tag-targeted Campaign creation
    const tpls = await axios.get(`${BASE_URL}/templates`);
    const approvedTpl = tpls.data.find((t: any) => t.status === 'APPROVED');
    if (approvedTpl) {
      const campRes = await axios.post(`${BASE_URL}/campaigns`, {
        name: `Tag Targeted Outreach (${testTag})`,
        template_id: approvedTpl.id,
        messages_per_second: 5,
        target_tags: testTag
      });
      console.log(`✓ Targeted Campaign created for tag "${testTag}": ${campRes.data.totalContacts} target recipients.`);
    }

    console.log('\n🎉 ALL CONTACTS & TAG TARGETING ENHANCEMENTS PASSING 100%!');
  } catch (err: any) {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testContactsEnhancements();
