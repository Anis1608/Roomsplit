import nodemailer from 'nodemailer';

export const sendSettlementEmail = async (toEmail, toName, fromName, amount, groupName) => {
  try {
    // Generate a test ethereal account automatically for dev purposes 
    // This allows free real email captures without needing Gmail passwords
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });

    const info = await transporter.sendMail({
      from: '"RoomSplit App" <noreply@roomsplit.app>',
      to: toEmail,
      subject: `✅ Settlement Received from ${fromName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10B981;">Good News, ${toName}!</h2>
          <p style="font-size: 16px; color: #333;">
            <strong>${fromName}</strong> has just settled their debt with you in the group <strong>${groupName}</strong>.
          </p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Amount Settled</p>
            <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: 900; color: #111827;">₹${amount}</p>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            - The RoomSplit Team
          </p>
        </div>
      `,
    });

    console.log('✅ Settlement Email Sent!');
    console.log('📬 PREVIEW EMAIL HERE: %s', nodemailer.getTestMessageUrl(info));
    // In production, we would use SENDGRID, MailGun, Gmail, etc.
  } catch (err) {
    console.error('Email failed to send:', err);
  }
};

export const sendApprovalEmail = async (toEmail, toName, approverName, amount, groupName) => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });

    const info = await transporter.sendMail({
      from: '"RoomSplit App" <noreply@roomsplit.app>',
      to: toEmail,
      subject: `✅ Payment Approved by ${approverName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10B981;">Awesome News, ${toName}!</h2>
          <p style="font-size: 16px; color: #333;">
            <strong>${approverName}</strong> has just approved your settlement payment for the group <strong>${groupName}</strong>. 
            You are officially off the hook for this amount!
          </p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Amount Approved</p>
            <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: 900; color: #111827;">₹${amount}</p>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            - The RoomSplit Team
          </p>
        </div>
      `,
    });
    console.log('✅ Approval Email Sent!');
    console.log('📬 PREVIEW EMAIL HERE: %s', nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error('Email failed to send:', err);
  }
};
