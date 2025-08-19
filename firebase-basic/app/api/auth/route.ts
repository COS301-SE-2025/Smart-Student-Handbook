import { DocumentManager } from '@y-sweet/sdk'
  import { NextResponse } from 'next/server'
 
  const connectionString = process.env.CONNECTION_STRING
  if (!connectionString) {
    throw new Error('CONNECTION_STRING environment variable is not set')
  }
  const manager = new DocumentManager(connectionString)
 
  export async function POST(request: Request) {
    const { docId } = await request.json()
    const clientToken = await manager.getOrCreateDocAndToken(docId, {
      authorization: 'full'
    })
    return NextResponse.json(clientToken)
  }

  async function getClientToken(docId : string ) {
    return await manager.getOrCreateDocAndToken(docId);
  }