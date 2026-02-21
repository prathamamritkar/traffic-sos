// ============================================================
// Twilio SMS Test Script
// ============================================================
require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
    console.error('❌ Missing Twilio credentials in .env file');
    process.exit(1);
}

const client = twilio(accountSid, authToken);

async function sendTestSMS() {
    try {
        console.log('📱 Sending test SMS...');
        
        const message = await client.messages.create({
            body: '🚨 RescuEdge Test: Your emergency alert system is configured correctly!',
            from: fromNumber,
            to: '+918767726477', // Your phone number
        });

        console.log('✅ SMS sent successfully!');
        console.log(`   Message SID: ${message.sid}`);
        console.log(`   Status: ${message.status}`);
        console.log(`   From: ${message.from}`);
        console.log(`   To: ${message.to}`);
    } catch (error) {
        console.error('❌ Failed to send SMS:', error.message);
    }
}

sendTestSMS();
