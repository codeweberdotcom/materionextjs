// Next Imports
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { hasPermission } from '@/utils/rbac'

// In-memory storage for demo purposes
// In production, this should be replaced with database storage
let emailTemplates: any[] = [
  {
    id: '1',
    name: 'Welcome Email',
    subject: 'Welcome to our platform!',
    content: '<h1>Welcome {name}!</h1><p>Thank you for joining us. Your account has been created successfully.</p><p>Best regards,<br>Admin Team</p>',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Password Reset',
    subject: 'Password Reset Request',
    content: '<h1>Password Reset</h1><p>Hello {name},</p><p>You have requested a password reset. Click the link below to reset your password:</p><p><a href="{link}">Reset Password</a></p><p>If you did not request this, please ignore this email.</p>',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !hasPermission(session.user, 'email-templates-management-read')) {
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
    if (!session || !hasPermission(session.user, 'email-templates-management-write')) {
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