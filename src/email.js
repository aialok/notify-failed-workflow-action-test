import { createTransport } from 'nodemailer';
import core from '@actions/core';

const setupAndSendEmail = async (
  sender_email,
  sender_email_password,
  team_email_addresses,
  subject,
  text
) => {
  try {
    const transport = createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: sender_email,
        pass: sender_email_password
      }
    });

    const email = team_email_addresses.split(',');

    email.forEach(async email => {
      await transport.sendMail({
        from: sender_email,
        to: email,
        subject: subject,
        text: text
      });
    });

    core.debug('email sent successfully');
  } catch (error) {
    core.core.setFailed(error.message);
  }
};

export { setupAndSendEmail };
