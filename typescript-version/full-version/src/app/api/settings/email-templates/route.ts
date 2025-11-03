// Next Imports
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { checkPermission } from '@/utils/permissions'

// In-memory storage for demo purposes
// In production, this should be replaced with database storage
const emailTemplates: any[] = [
  {
    id: '1',
    name: 'Welcome Email',
    subject: 'Welcome to our platform, {{name}}!',
    content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome {{name}}!</h1>

        {{#if user.premium}}
          <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>🎉 Premium Account Activated!</h3>
            <p>You have access to all premium features.</p>
          </div>
        {{else}}
          <div style="background: #fff8dc; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p>Upgrade to premium for additional features!</p>
          </div>
        {{/if}}

        <p>Thank you for joining us. Your account has been created successfully.</p>

        {{#if user.profile.avatar}}
          <img src="{{user.profile.avatar}}" alt="Profile" style="width: 100px; height: 100px; border-radius: 50%;">
        {{/if}}

        <p>Your registration date: {{formatDate createdAt "short"}}</p>

        <div style="margin-top: 30px;">
          <a href="{{loginUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login to Account</a>
        </div>

        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          Best regards,<br>
          Admin Team
        </p>
      </div>
    `,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Password Reset',
    subject: 'Password Reset Request - {{uppercase name}}',
    content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc3545;">Password Reset</h1>

        <p>Hello <strong>{{name}}</strong>,</p>

        <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0;">
          <p>You have requested a password reset for your account.</p>
          <p><strong>This link will expire in 24 hours.</strong></p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="{{resetLink}}" style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>

        {{#ifCond attempts ">" 3}}
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="color: #856404; margin: 0;">
              ⚠️ Multiple reset attempts detected. If this wasn't you, please contact support.
            </p>
          </div>
        {{/ifCond}}

        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 3px;">
          {{resetLink}}
        </p>

        <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
          If you did not request this password reset, please ignore this email.
          Your password will remain unchanged.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

        <p style="color: #666; font-size: 12px;">
          This email was sent to {{email}} on {{formatDate (now) "short"}}<br>
          © {{year}} Your Company. All rights reserved.
        </p>
      </div>
    `,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Order Confirmation',
    subject: 'Order Confirmation #{{order.id}}',
    content: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #28a745;">Order Confirmation</h1>

        <p>Dear {{customer.name}},</p>

        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #155724; margin-top: 0;">✅ Order #{{order.id}} Confirmed</h3>
          <p style="margin-bottom: 0;">Total: <strong>$\{{order.total}}</strong></p>
        </div>

        <h3>Order Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">Item</th>
              <th style="border: 1px solid #dee2e6; padding: 8px; text-align: center;">Qty</th>
              <th style="border: 1px solid #dee2e6; padding: 8px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            {{#each order.items}}
            <tr>
              <td style="border: 1px solid #dee2e6; padding: 8px;">{{name}}</td>
              <td style="border: 1px solid #dee2e6; padding: 8px; text-align: center;">{{quantity}}</td>
              <td style="border: 1px solid #dee2e6; padding: 8px; text-align: right;">$\{{price}}</td>
            </tr>
            {{/each}}
          </tbody>
        </table>

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 5px;">
          <h4>Shipping Address:</h4>
          <p style="margin: 5px 0;">
            {{shipping.name}}<br>
            {{shipping.address}}<br>
            {{shipping.city}}, {{shipping.state}} {{shipping.zip}}
          </p>
        </div>

        {{#if order.trackingNumber}}
        <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 5px;">
          <p><strong>Tracking Number:</strong> {{order.trackingNumber}}</p>
          <a href="{{trackingUrl}}" style="color: #007bff;">Track Your Order</a>
        </div>
        {{/if}}

        <p style="margin-top: 30px;">
          Thank you for your business! We'll send you shipping updates as your order progresses.
        </p>

        <div style="margin-top: 30px; text-align: center;">
          <a href="{{orderUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">View Order</a>
          <a href="{{supportUrl}}" style="background: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Contact Support</a>
        </div>
      </div>
    `,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !checkPermission(session.user, 'Email Templates', 'Read')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    
return NextResponse.json(emailTemplates)
  } catch (error) {
    console.error('Error fetching email templates:', error)
    
return NextResponse.json(
      { message: 'Failed to fetch email templates' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !checkPermission(session.user, 'Email Templates', 'Write')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { name, subject, content } = body

    if (!name || !subject || !content) {
      return NextResponse.json(
        { message: 'Name, subject, and content are required' },
        { status: 400 }
      )
    }

    const newTemplate = {
      id: Date.now().toString(),
      name,
      subject,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    emailTemplates.push(newTemplate)

    return NextResponse.json(newTemplate)
  } catch (error) {
    console.error('Error creating email template:', error)
    
return NextResponse.json(
      { message: 'Failed to create email template' },
      { status: 500 }
    )
  }
}
