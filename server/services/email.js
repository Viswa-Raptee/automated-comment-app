const { SendMailClient } = require("zeptomail");
require('dotenv').config();

const ZEPTOMAIL_TOKEN = process.env.ZEPTOMAIL_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Initialize ZeptoMail client
const client = new SendMailClient({
    url: "https://api.zeptomail.in/v1.1/email",
    token: ZEPTOMAIL_TOKEN
});

/**
 * Send assignment notification email with magic link
 */
async function sendAssignmentEmail(toEmail, toName, comment, magicLinkToken, assignerName) {
    if (!ZEPTOMAIL_TOKEN) {
        console.warn('⚠️ ZEPTOMAIL_TOKEN not set, skipping email');
        return false;
    }

    const magicLinkUrl = `${FRONTEND_URL}/view-comment/${magicLinkToken}`;

    const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📝 Comment Assigned to You</h1>
      </div>
      
      <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: 0;">
        <p style="color: #64748b; margin: 0 0 15px;">
          <strong>${assignerName || 'A team member'}</strong> has assigned a comment to you.
        </p>
        
        <div style="background: white; border-left: 4px solid #6366f1; padding: 15px; margin: 15px 0; border-radius: 4px;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">
            <strong>From:</strong> ${comment.authorName || 'Unknown'}
          </p>
          <p style="color: #1e293b; margin: 0; font-size: 14px; line-height: 1.6;">
            "${comment.content}"
          </p>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${magicLinkUrl}" 
             style="display: inline-block; background: #1e293b; 
                    color: white; text-decoration: none; padding: 14px 32px; 
                    border-radius: 8px; font-weight: bold; font-size: 16px;">
            View & Reply
          </a>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          This link expires in 3 days. Click once to access the comment directly.
        </p>
      </div>
      
      <div style="background: #1e293b; padding: 15px; border-radius: 0 0 12px 12px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          Raptee Comment Management System
        </p>
      </div>
    </div>
  `;

    try {
        const result = await client.sendMail({
            from: {
                address: "social@rapteehv.com",
                name: "Raptee Comments"
            },
            to: [{
                email_address: {
                    address: toEmail,
                    name: toName || toEmail
                }
            }],
            subject: `Comment assigned to you by ${assignerName || 'team member'}`,
            htmlbody: htmlBody
        });

        console.log(`✅ Assignment email sent to ${toEmail}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send email:', error?.message || error?.error || JSON.stringify(error));
        return false;
    }
}

module.exports = { sendAssignmentEmail };

