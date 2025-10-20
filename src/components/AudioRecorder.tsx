// src/components/AudioRecorder.tsx
'use client';

import React, { useState, useRef, useCallback } from 'react';

const AudioRecorder: React.FC = () => {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [denoisedAudioUrl, setDenoisedAudioUrl] = useState<string | null>(null);
  const [audioMetadata, setAudioMetadata] = useState<{
    dominant_frequency_hz?: number;
    centroid_frequency_hz?: number;
    rms?: number;
    duration_seconds?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 1. Start Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop()); // Stop the stream
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      setDenoisedAudioUrl(null);
      setAudioMetadata(null);
      setMessage('Recording...');
    } catch (err) {
      console.error('Error starting recording:', err);
      setMessage('Error: Could not access microphone.');
    }
  };

  // 2. Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setMessage('Recording stopped. Ready to denoise.');
    }
  };

  // 3. Handle File Upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        setMessage('Please upload a valid audio file.');
        return;
      }
      setAudioBlob(file);
      setDenoisedAudioUrl(null);
      setAudioMetadata(null);
      setMessage(`File loaded: ${file.name}. Ready to denoise.`);
    }
  };

  // 4. Denoise Audio
  const denoiseAudio = useCallback(async () => {
    if (!audioBlob) {
      setMessage('Please record or upload an audio file first.');
      return;
    }

    setLoading(true);
    setMessage('Denoising in progress...');

    try {
      // Create FormData to send the file
      const formData = new FormData();
      formData.append('file', audioBlob, 'input.wav');

      // Call the Next.js API route
      const response = await fetch('/api/denoise', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unknown error occurred.');
      }

      // Extract metadata from custom header "X-Audio-Metadata"
      const metadataHeader = response.headers.get('X-Audio-Metadata');
      let metadata = null;
      if (metadataHeader) {
        try {
          metadata = JSON.parse(metadataHeader);
          setAudioMetadata(metadata);
          setMessage(
            `Denoising complete! Dominant freq: ${metadata.dominant_frequency_hz} Hz | Duration: ${metadata.duration_seconds}s`
          );
        } catch {
          setMessage('Denoising complete! (Failed to parse audio metadata)');
        }
      } else {
        setMessage('Denoising complete! Play or download the enhanced audio.');
      }

      // Get the denoised audio blob
      const denoisedBlob = await response.blob();

      // Create a URL for the <audio> tag
      const url = URL.createObjectURL(denoisedBlob);
      setDenoisedAudioUrl(url);
    } catch (error) {
      console.error('Denoising Error:', error);
      setMessage(`Denoising failed: ${error instanceof Error ? error.message : String(error)}`);
      setDenoisedAudioUrl(null);
      setAudioMetadata(null);
    } finally {
      setLoading(false);
    }
  }, [audioBlob]);

  const sourceAudioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;

  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-50 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-700">Audio Denoiser 🎧</h1>

      {/* 1. Recorder Controls */}
      <div className="flex justify-center space-x-4 mb-6">
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-semibold transition duration-200 ${
            recording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
          } disabled:opacity-50`}
        >
          {recording ? '🔴 Stop Recording' : '🎤 Start Recording'}
        </button>

        <label
          htmlFor="file-upload"
          className="cursor-pointer px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition duration-200 disabled:opacity-50 flex items-center"
        >
          📤 Upload .wav File
        </label>
        <input
          id="file-upload"
          type="file"
          accept="audio/wav"
          onChange={handleFileUpload}
          disabled={loading || recording}
          className="hidden"
        />
      </div>

      {/* 2. Status Message */}
      <p className={`text-center mb-6 font-medium ${loading ? 'text-yellow-600' : 'text-gray-700'}`}>{message}</p>

      {/* 3. Original Audio Player */}
      {sourceAudioUrl && (
        <div className="mb-6 border p-4 rounded-md bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-2 text-gray-800">Original (Noisy) Audio</h2>
          <audio src={sourceAudioUrl} controls className="w-full" />
        </div>
      )}

      {/* 4. Denoise Button */}
      <div className="text-center mb-6">
        <button
          onClick={denoiseAudio}
          disabled={!audioBlob || loading || recording}
          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-lg transition duration-200 disabled:opacity-30"
        >
          {loading ? 'Processing... (up to 30s)' : '✨ Denoise Audio'}
        </button>
      </div>

      {/* 5. Denoised Audio Player and Download */}
      {denoisedAudioUrl && (
        <div className="border border-green-400 p-4 rounded-md bg-green-50 shadow-md">
          <h2 className="text-xl font-semibold mb-2 text-green-700">Enhanced (Clean) Audio</h2>
          <audio src={denoisedAudioUrl} controls className="w-full mb-3" />
          {audioMetadata && (
            <div className="mb-3 p-3 bg-white rounded shadow-inner text-gray-800 font-mono text-sm">
              <p>
                <strong>Dominant Frequency:</strong> {audioMetadata.dominant_frequency_hz} Hz
              </p>
              <p>
                <strong>Centroid Frequency:</strong> {audioMetadata.centroid_frequency_hz} Hz
              </p>
              <p>
                <strong>RMS (Loudness):</strong> {audioMetadata.rms}
              </p>
              <p>
                <strong>Duration:</strong> {audioMetadata.duration_seconds} s
              </p>
            </div>
          )}
          <div className="text-center">
            <a
              href={denoisedAudioUrl}
              download="denoised_audio.wav"
              className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
            >
              ⬇️ Download Enhanced Audio
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
