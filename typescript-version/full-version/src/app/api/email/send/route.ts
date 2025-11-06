// Next Imports

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/utils/email'

export async function POST(request: NextRequest) {
  try {
    const { to, subject, html, text, from, templateId, variables } = await request.json()

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

    // Handle different response types from nodemailer
    const response: any = {
      message: 'Email sent successfully'
    }

    if ('messageId' in info) {
      response.messageId = info.messageId
      response.accepted = info.accepted
      response.rejected = info.rejected
    } else if ('id' in info) {
      response.messageId = info.id
    }

    return NextResponse.json(response)
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


