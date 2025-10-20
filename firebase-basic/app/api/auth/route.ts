import { DocumentManager } from '@y-sweet/sdk'
import { NextResponse } from 'next/server'

const connectionString = process.env.CONNECTION_STRING

// Only create manager if connectionString exists
const manager = connectionString ? new DocumentManager(connectionString) : null

export async function POST(request: Request) {
  if (!connectionString || !manager) {
    return NextResponse.json(
      { error: 'CONNECTION_STRING environment variable is not set' },
      { status: 500 }
    )
  }
  
  const { docId } = await request.json()
  const clientToken = await manager.getOrCreateDocAndToken(docId, {
    authorization: 'full'
  })
  return NextResponse.json(clientToken)
}

async function getClientToken(docId: string) {
  if (!manager) {
    throw new Error('CONNECTION_STRING environment variable is not set')
  }
  return await manager.getOrCreateDocAndToken(docId)
}