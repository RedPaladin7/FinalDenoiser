// src/app/api/denoise/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_API_URL not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    // Forward the exact FormData object (which now contains the key 'audio')
    const response = await fetch(backendUrl, { method: 'POST', body: formData });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || 'Backend returned an unknown error' }, { status: response.status });
    }

    const metadataRaw = response.headers.get('X-Audio-Metadata') || '{}';
    
    const arrayBuffer = await response.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'X-Audio-Metadata': metadataRaw,
      },
    });
  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: 'Unable to reach backend server or network error' }, { status: 500 });
  }
}