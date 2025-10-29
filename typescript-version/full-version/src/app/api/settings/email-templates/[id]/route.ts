// Next Imports
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { checkPermission } from '@/utils/permissions'

// In-memory storage (same as in the main route)
const emailTemplates: any[] = [
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

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    const templateId = params.id

    if (!name || !subject || !content) {
      return NextResponse.json(
        { message: 'Name, subject, and content are required' },
        { status: 400 }
      )
    }

    const templateIndex = emailTemplates.findIndex(t => t.id === templateId)

    if (templateIndex === -1) {
      return NextResponse.json(
        { message: 'Template not found' },
        { status: 404 }
      )
    }

    const updatedTemplate = {
      ...emailTemplates[templateIndex],
      name,
      subject,
      content,
      updatedAt: new Date().toISOString()
    }

    emailTemplates[templateIndex] = updatedTemplate

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error('Error updating email template:', error)
    
return NextResponse.json(
      { message: 'Failed to update email template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !checkPermission(session.user, 'Email Templates', 'Write')) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const templateId = params.id

    const templateIndex = emailTemplates.findIndex(t => t.id === templateId)

    if (templateIndex === -1) {
      return NextResponse.json(
        { message: 'Template not found' },
        { status: 404 }
      )
    }

    emailTemplates.splice(templateIndex, 1)

    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error) {
    console.error('Error deleting email template:', error)
    
return NextResponse.json(
      { message: 'Failed to delete email template' },
      { status: 500 }
    )
  }
}
