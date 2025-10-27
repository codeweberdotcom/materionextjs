// Next Imports
import { NextResponse } from 'next/server'
import { sendEmail } from '@/utils/email'

export async function POST(req: Request) {
  try {
    const { to, subject, html, text, from, templateId, variables } = await req.json()

    // Validate required fields
    if (!to) {
      return NextResponse.json(
        { message: 'Recipient is required' },
        { status: 400 }
      )
    }

    // If template is used, subject and html are optional
    if (templateId && (!subject || !html)) {
      // Template will provide subject and content
    } else if (!templateId && (!subject || !html)) {
      return NextResponse.json(
        { message: 'Subject and content (or template) are required' },
        { status: 400 }
      )
    }

    // Send email
    const info = await sendEmail({
      to,
      subject,
      html,
      text,
      from,
      templateId,
      variables
    })

    return NextResponse.json({
      message: 'Email sent successfully',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected
    })
  } catch (error) {
    console.error('Email sending error:', error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to send email'
      },
      { status: 500 }
    )
  }
}