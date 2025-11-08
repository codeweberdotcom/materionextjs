/**
 * ! We haven't used this file in our template. We've used the server actions in the
 * ! `src/app/server/actions.ts` file to fetch the static data from the fake-db.
 * ! This file has been created to help you understand how you can create your own API routes.
 * ! Only consider making API routes if you're planing to share your project data with other applications.
 * ! else you can use the server actions or third-party APIs to fetch the data from your database.
 */
import { NextRequest, NextResponse } from 'next/server'

// Next Imports

// Data Imports
// Since we're starting fresh, return empty array for permissions
const db: any[] = []

export async function GET() {
  return NextResponse.json(db)
}


