import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary configuration is incomplete.');
  }

  return { cloudName, apiKey, apiSecret };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file received.' }, { status: 400 });
    }

    const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'ekheti/community';
    const signatureBase = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHash('sha1').update(signatureBase).digest('hex');

    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('api_key', apiKey);
    uploadForm.append('timestamp', timestamp);
    uploadForm.append('folder', folder);
    uploadForm.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: uploadForm,
      cache: 'no-store',
    });

    const payload = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error?.message || 'Cloudinary upload failed.' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      secureUrl: payload.secure_url as string,
      publicId: payload.public_id as string,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
