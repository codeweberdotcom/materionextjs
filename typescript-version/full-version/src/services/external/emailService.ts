// Email service for external API integrations
import nodemailer from 'nodemailer'
import * as cron from 'node-cron'
import * as fs from 'fs'
import * as path from 'path'
import Handlebars from 'handlebars'
import logger from '@/lib/logger'

export interface SmtpConfig {
  host: string
  port: string
  username: string
  password: string
  encryption: string
  fromEmail: string
  fromName: string
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer | string
    contentType?: string
  }>
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private config: SmtpConfig | null = null

  async initialize(): Promise<void> {
    this.config = await this.getSmtpConfig()
    this.transporter = await this.createTransporter()
  }

  private async getSmtpConfig(): Promise<SmtpConfig> {
    // Simplified version - use environment variables
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || '587',
      username: process.env.SMTP_USERNAME || '',
      password: process.env.SMTP_PASSWORD || '',
      encryption: process.env.SMTP_ENCRYPTION || 'tls',
      fromEmail: process.env.SMTP_FROM_EMAIL || 'admin@example.com',
      fromName: process.env.SMTP_FROM_NAME || 'Admin'
    }
  }

  private async createTransporter(): Promise<nodemailer.Transporter> {
    if (!this.config) throw new Error('SMTP config not initialized')

    const transporterConfig: any = {
      host: this.config.host,
      port: parseInt(this.config.port),
      auth: {
        user: this.config.username,
        pass: this.config.password
      }
    }

    if (this.config.encryption === 'ssl') {
      transporterConfig.secure = true
    } else if (this.config.encryption === 'tls') {
      transporterConfig.secure = false
    }

    return nodemailer.createTransport(transporterConfig)
  }

  async sendEmail(options: EmailOptions): Promise<any> {
    if (!this.transporter) await this.initialize()
    if (!this.config) throw new Error('Service not initialized')

    const mailOptions = {
      from: options.from || `"${this.config.fromName}" <${this.config.fromEmail}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments
    }

    const info = await this.transporter!.sendMail(mailOptions)

    logger.info('📧 Email sent successfully:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected
    })

    return info
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.transporter) await this.initialize()
      await this.transporter!.verify()
      return { success: true, message: 'SMTP connection successful' }
    } catch (error) {
      return {
        success: false,
        message: `SMTP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

// Export singleton instance
export const emailService = new EmailService()