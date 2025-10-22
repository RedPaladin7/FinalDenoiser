# /python-server/app.py (REGENERATED with strict ASCII spacing)
import io
import os
import math
import numpy as np
import tensorflow as tf
from scipy.io import wavfile
from scipy.fft import rfft, rfftfreq
from fastapi import FastAPI, UploadFile, HTTPException, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated

# --- Configuration ---
app = FastAPI()
SR = 16000
SEGMENT = 32000
EXPORT_DIR = "./denoiser_export"
model_wrapper = None
allowed_origins = [
    "http:/localhost:3000",
    "https://final-denoiser.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Utility Functions ---

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
    """
    Calculate metadata using simplified keys to match the original frontend.
    """
    N = len(y)
    fft_vals = np.abs(rfft(y))
    fft_freqs = rfftfreq(N, 1 / sr)

    idx = np.argmax(fft_vals)
    dominant_freq = fft_freqs[idx]
    rms = np.sqrt(np.mean(y**2))
    duration = N / sr

    total_magnitude = np.sum(fft_vals)
    weighted_freq = np.sum(fft_freqs * fft_vals) / (total_magnitude + 1e-9)
    
    return {
        # Simplified keys for compatibility with the untouched frontend
        "dominant_frequency": round(float(dominant_freq), 2),
        "centroid_frequency": round(float(weighted_freq), 2),
        "rms": round(float(rms), 6),
        "duration": round(float(duration), 2),
    }

# --- Model Loading ---

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

# --- API Endpoint ---

@app.post("/denoise")
# FastAPI expects the form field key "audio" to match the frontend
async def denoise(audio: Annotated[UploadFile, Form()]):
    if model_wrapper is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Service unavailable.")
    
    try:
        content = await audio.read()
        noisy, sr = read_wav(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid WAV data or read error: {e}")

    # Padding for inference
    T = len(noisy)
    pad = (math.ceil(T / SEGMENT) * SEGMENT) - T
    noisy_pad = np.pad(noisy, (0, pad), mode='reflect').astype(np.float32)
    noisy_tensor = tf.convert_to_tensor(noisy_pad)

    try:
        enhanced_tensor = model_wrapper.denoise(noisy_tensor)
        enhanced = enhanced_tensor.numpy()[:T]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed in TensorFlow model: {e}")

    wav_io = write_wav_bytes(enhanced)
    metadata = analyze_audio(enhanced, sr)

    # Return the WAV file and metadata as a header
    response = StreamingResponse(
        wav_io,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f'attachment; filename="denoised_{audio.filename}"',
            # Use str(metadata) which produces a dict-like string with single quotes
            "X-Audio-Metadata": str(metadata), 
        },
    )
    return response