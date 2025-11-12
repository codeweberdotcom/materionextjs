import { NextResponse } from 'next/server'

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
  instance?: string
  errors?: Record<string, string[]>
}

export interface ProblemDetailsInit {
  type?: string
  title: string
  status: number
  detail?: string
  instance?: string
  errors?: Record<string, string[]>
}

export const createProblemDetails = ({
  type = 'about:blank',
  ...rest
}: ProblemDetailsInit): ProblemDetails => ({
  type,
  ...rest
})

export const problemJson = (details: ProblemDetailsInit) =>
  NextResponse.json(createProblemDetails(details), { status: details.status })
