const nodemailer = require('nodemailer');

// Email configuration for different providers
const emailProviders = {
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requiresAppPassword: true,
    authUrl: 'https://myaccount.google.com/apppasswords'
  },
  outlook: {
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    requiresAppPassword: true,
    authUrl: 'https://account.microsoft.com/security'
  },
  custom: {
    // For custom SMTP servers
  }
};

// Create email transporter
function createTransporter(config) {
  const { provider, email, password, customHost, customPort } = config;
  
  let transportConfig = {
    auth: {
      user: email,
      pass: password
    }
  };
  
  if (provider === 'custom') {
    transportConfig.host = customHost;
    transportConfig.port = customPort || 587;
    transportConfig.secure = customPort === 465;
  } else if (emailProviders[provider]) {
    transportConfig = {
      ...transportConfig,
      ...emailProviders[provider]
    };
  } else {
    throw new Error('Invalid email provider');
  }
  
  return nodemailer.createTransport(transportConfig);
}

// Verify email configuration
async function verifyEmailConfig(config) {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      hint: emailProviders[config.provider]?.requiresAppPassword 
        ? `You need an app-specific password. Create one at: ${emailProviders[config.provider].authUrl}`
        : 'Check your email settings and credentials'
    };
  }
}

// Send email
async function sendEmail(config, emailData) {
  try {
    const transporter = createTransporter(config);
    
    const mailOptions = {
      from: `"${emailData.fromName || config.companyName}" <${config.email}>`,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.body,
      html: emailData.html || emailData.body.replace(/\n/g, '<br>')
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected
    };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  emailProviders,
  createTransporter,
  verifyEmailConfig,
  sendEmail
};