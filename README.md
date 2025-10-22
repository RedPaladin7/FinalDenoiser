# 🎧 Neural Audio Denoiser: UNet/ResNet Web Application

This project is a full-stack, deep learning solution for real-time audio noise reduction. It uses a decoupled architecture where a **Next.js frontend** captures and displays audio, and a **FastAPI server** handles the heavy-duty TensorFlow inference.

## ✨ Features

* **🎙️ Audio Input:** Record audio directly via the microphone or upload an existing WAV file.
* **💻 Dark, Tech-Themed UI:** A modern, visually engaging "Neural Matrix" interface using **Tailwind CSS** and custom fonts.
* **🧠 Deep Learning Inference:** Leverages a trained TensorFlow model (**UNet** or **ResNet**) for spectral masking and noise reduction.
* **📈 Quantitative Analysis:** Displays key post-denoising metrics: **Dominant Frequency**, **Centroid Frequency**, **RMS Loudness**, and **Duration**.
* **🌐 Scalable Architecture:** Decoupled ML backend for easier scaling and deployment.

***

## 🏛️ Project Architecture

The application is composed of three primary services that communicate via HTTP:

| File | Technology | Role |
| :--- | :--- | :--- |
| **ML Logic** (`base_model.py`) | Python / TensorFlow | Defines the **UNet/ResNet** model architecture, training configuration, and loss functions. |
| **ML Server** (`/python-server/app.py`) | FastAPI / TensorFlow | **Inference Engine.** Loads the model, handles audio segmenting/padding, runs the denoiser, calculates metrics, and streams the enhanced WAV file. |
| **API Proxy** (`src/app/api/denoise/route.ts`) | Next.js API Routes | **Proxy Layer.** Forwards the incoming audio `FormData` to the external FastAPI URL and relays the response headers (`X-Audio-Metadata`) and audio file back to the client. |
| **Frontend** (`src/components/AudioRecorder.tsx`) | Next.js (React/TS) | **User Interface.** Manages recording, file upload, status display, and parses the metadata header for display. |

***

## 🚀 Setup and Installation

### Prerequisites

You need two environments running simultaneously:

1.  **Python 3.10+** (with a trained TensorFlow model).
2.  **Node.js 18+** (for the Next.js frontend).

### 1. Python Backend Setup

Navigate to the `python-server` directory (or where `app.py` is located).

```bash
# 1. Setup Environment
python3 -m venv venv
source venv/bin/activate

# 2. Install Dependencies
# Ensure you include: tensorflow, fastapi, uvicorn, numpy, scipy
pip install -r requirements.txt 

# 3. Ensure Model Export
# A trained model (from base_model.py) must be saved as a TensorFlow SavedModel 
# within the directory: ./denoiser_export/