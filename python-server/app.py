# python_server/app.py
import io
import os
import math
import numpy as np
import tensorflow as tf
from scipy.io import wavfile
from scipy.fft import rfft, rfftfreq
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
SR = 16000
SEGMENT = 32000
EXPORT_DIR = "./denoiser_export"
model_wrapper = None

# Allow local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def normalize_audio(x):
    x = np.asarray(x, dtype=np.float32)
    return x / (np.max(np.abs(x)) + 1e-9)

def read_wav(wav_bytes):
    sr, y = wavfile.read(io.BytesIO(wav_bytes))
    y = y.astype(np.float32)
    if y.ndim == 2:
        y = y.mean(axis=1)
    return normalize_audio(y), sr

def write_wav_bytes(y, sr=SR):
    y = np.asarray(y, dtype=np.float32)
    y = (y / (np.max(np.abs(y)) + 1e-9)) * 0.99
    out_io = io.BytesIO()
    wavfile.write(out_io, sr, (y * 32767.0).astype(np.int16))
    out_io.seek(0)
    return out_io

def analyze_audio(y, sr):
    """Calculate frequency, RMS, and duration metadata."""
    N = len(y)
    fft_vals = np.abs(rfft(y))
    fft_freqs = rfftfreq(N, 1 / sr)

    idx = np.argmax(fft_vals)
    dominant_freq = fft_freqs[idx]
    rms = np.sqrt(np.mean(y**2))
    duration = N / sr

    # Approximate frequency centroid
    weighted_freq = np.sum(fft_freqs * fft_vals) / np.sum(fft_vals)
    
    return {
        "dominant_frequency_hz": round(float(dominant_freq), 2),
        "centroid_frequency_hz": round(float(weighted_freq), 2),
        "rms": round(float(rms), 6),
        "duration_seconds": round(float(duration), 2),
    }

@app.on_event("startup")
async def load_model():
    global model_wrapper
    try:
        subdirs = [
            os.path.join(EXPORT_DIR, d)
            for d in os.listdir(EXPORT_DIR)
            if os.path.isdir(os.path.join(EXPORT_DIR, d))
        ]
        model_path = subdirs[0] if subdirs else EXPORT_DIR
        model_wrapper = tf.saved_model.load(model_path)
        print(f"✅ Model loaded from {model_path}")
    except Exception as e:
        print(f"❌ Model load failed: {e}")
        model_wrapper = None

@app.post("/denoise")
async def denoise(file: UploadFile):
    if model_wrapper is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        content = await file.read()
        noisy, sr = read_wav(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid WAV data: {e}")

    T = len(noisy)
    pad = (math.ceil(T / SEGMENT) * SEGMENT) - T
    noisy_pad = np.pad(noisy, (0, pad), mode='reflect').astype(np.float32)
    noisy_tensor = tf.convert_to_tensor(noisy_pad)

    try:
        enhanced_tensor = model_wrapper.denoise(noisy_tensor)
        enhanced = enhanced_tensor.numpy()[:T]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")

    wav_io = write_wav_bytes(enhanced)
    metadata = analyze_audio(enhanced, sr)

    # Return JSON metadata first, then stream audio separately
    response = StreamingResponse(
        wav_io,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f'attachment; filename="denoised_{file.filename}"',
            "X-Audio-Metadata": str(metadata),
        },
    )
    return response
