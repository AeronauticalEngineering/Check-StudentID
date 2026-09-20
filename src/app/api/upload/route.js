import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const body = await request.json();
    const { base64, path: targetPath } = body;

    if (!base64) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Extract base64 content
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: 'Invalid base64 string' }, { status: 400 });
    }

    const buffer = Buffer.from(matches[2], 'base64');

    // Generate filename from targetPath or timestamp
    const cleanFilename = (targetPath || `evidence_${Date.now()}.jpg`)
      .replace(/^documents\//, '')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, cleanFilename);
    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${cleanFilename}`;
    return NextResponse.json({ url: publicUrl, success: true });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
