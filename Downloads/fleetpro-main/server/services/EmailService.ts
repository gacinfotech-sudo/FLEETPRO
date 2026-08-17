import nodemailer, { Transporter } from 'nodemailer';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailPayload {
  to: string;
  templateId: string;
  variables?: Record<string, any>;
  tenantId?: string;
  userId?: string;
  retryCount?: number;
  maxRetries?: number;
}

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Use SendGrid or AWS SES in production
    // For development, use Ethereal Email or console
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    } else {
      // Development: log to console instead
      this.transporter = {
        sendMail: async (options: any) => {
          return { messageId: `dev-${Date.now()}` };
        },
      } as any;
    }
  }

  async sendEmail(payload: EmailPayload): Promise<boolean> {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const template = this.getTemplate(payload.templateId, payload.variables || {});

      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@fleetpro.com',
        to: payload.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return true;
    } catch (error) {
      console.error(`❌ Email send failed for ${payload.to}:`, error);
      return false;
    }
  }

  private getTemplate(templateId: string, variables: Record<string, any>): EmailTemplate {
    const templates: Record<string, (vars: Record<string, any>) => EmailTemplate> = {
      'welcome': (vars) => ({
        subject: `Welcome to FleetPro, ${vars.name}!`,
        html: `
          <h2>Welcome to FleetPro</h2>
          <p>Hi ${vars.name},</p>
          <p>Your account has been created successfully. You can now login with:</p>
          <p><strong>Email:</strong> ${vars.email}</p>
          <p><a href="${vars.loginUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to FleetPro</a></p>
          <p>If you didn't create this account, please ignore this email.</p>
        `,
        text: `Welcome to FleetPro. Login: ${vars.loginUrl}`,
      }),
      'payment_confirmation': (vars) => ({
        subject: `Payment Confirmation - ₹${vars.amount.toLocaleString('en-IN')}`,
        html: `
          <h2>Payment Received</h2>
          <p>Hi ${vars.name},</p>
          <p>We've received your payment of <strong>₹${vars.amount.toLocaleString('en-IN')}</strong>.</p>
          <p><strong>Transaction ID:</strong> ${vars.transactionId}</p>
          <p><strong>Date:</strong> ${vars.date}</p>
          <p><strong>Plan:</strong> ${vars.plan}</p>
          <p>Thank you for your business!</p>
        `,
        text: `Payment confirmed: ₹${vars.amount}. Transaction ID: ${vars.transactionId}`,
      }),
      'subscription_upgraded': (vars) => ({
        subject: `Subscription Upgraded to ${vars.newPlan}`,
        html: `
          <h2>Subscription Upgraded</h2>
          <p>Hi ${vars.name},</p>
          <p>Your subscription has been upgraded from <strong>${vars.oldPlan}</strong> to <strong>${vars.newPlan}</strong>.</p>
          <p><strong>New limits:</strong></p>
          <ul>
            <li>Vehicles: ${vars.vehicleLimit}</li>
            <li>Drivers: ${vars.driverLimit}</li>
            <li>Managers: ${vars.managerLimit}</li>
          </ul>
          <p>Changes are effective immediately.</p>
        `,
        text: `Subscription upgraded to ${vars.newPlan}.`,
      }),
      'user_invitation': (vars) => ({
        subject: `You're invited to join ${vars.tenantName} on FleetPro`,
        html: `
          <h2>Team Invitation</h2>
          <p>Hi ${vars.invitedEmail},</p>
          <p><strong>${vars.inviterName}</strong> has invited you to join <strong>${vars.tenantName}</strong>.</p>
          <p><strong>Role:</strong> ${vars.role}</p>
          <p><a href="${vars.invitationUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a></p>
          <p>This invitation expires in 7 days.</p>
        `,
        text: `You've been invited to join ${vars.tenantName}. Accept: ${vars.invitationUrl}`,
      }),
      'password_reset': (vars) => ({
        subject: 'Reset Your FleetPro Password',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${vars.name},</p>
          <p>We received a request to reset your password. Click the link below to create a new password:</p>
          <p><a href="${vars.resetUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
        text: `Reset your password: ${vars.resetUrl}`,
      }),
      'payment_failed': (vars) => ({
        subject: '⚠️ Payment Failed - Action Required',
        html: `
          <h2>Payment Failed</h2>
          <p>Hi ${vars.name},</p>
          <p>Your payment of <strong>₹${vars.amount.toLocaleString('en-IN')}</strong> failed on ${vars.date}.</p>
          <p><strong>Reason:</strong> ${vars.reason}</p>
          <p>Please update your payment method to avoid service interruption.</p>
          <p><a href="${vars.billingUrl}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Update Payment Method</a></p>
        `,
        text: `Payment failed: ₹${vars.amount}. Update your payment method: ${vars.billingUrl}`,
      }),
      'subscription_renewal': (vars) => ({
        subject: `Your FleetPro Subscription Renews on ${vars.renewalDate}`,
        html: `
          <h2>Subscription Renewal Notice</h2>
          <p>Hi ${vars.name},</p>
          <p>Your ${vars.plan} subscription will renew on <strong>${vars.renewalDate}</strong>.</p>
          <p><strong>Renewal Amount:</strong> ₹${vars.amount.toLocaleString('en-IN')}</p>
          <p>Your current billing information is on file. No action needed unless you want to update your plan.</p>
          <p><a href="${vars.billingUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Manage Subscription</a></p>
        `,
        text: `Subscription renews on ${vars.renewalDate}. Amount: ₹${vars.amount}`,
      }),
      'usage_alert': (vars) => ({
        subject: `⚠️ Usage Alert - ${vars.resource} Limit Approaching`,
        html: `
          <h2>Usage Alert</h2>
          <p>Hi ${vars.name},</p>
          <p>You've used <strong>${vars.usage}/${vars.limit}</strong> ${vars.resource}.</p>
          <p>Consider upgrading your plan to avoid service interruption.</p>
          <p><a href="${vars.upgradeUrl}" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Plans</a></p>
        `,
        text: `Usage alert: ${vars.usage}/${vars.limit} ${vars.resource}`,
      }),
      'support_ticket_update': (vars) => ({
        subject: `Support Ticket #${vars.ticketId} - ${vars.status}`,
        html: `
          <h2>Support Ticket Update</h2>
          <p>Hi ${vars.name},</p>
          <p>Your support ticket has been updated.</p>
          <p><strong>Ticket ID:</strong> ${vars.ticketId}</p>
          <p><strong>Status:</strong> ${vars.status}</p>
          <p><strong>Update:</strong> ${vars.message}</p>
          <p><a href="${vars.ticketUrl}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a></p>
        `,
        text: `Ticket #${vars.ticketId} updated: ${vars.status}`,
      }),
    };

    const templateFn = templates[templateId];
    if (!templateFn) {
      throw new Error(`Template '${templateId}' not found`);
    }

    return templateFn(variables);
  }
}

export const emailService = new EmailService();
