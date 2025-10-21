'use client'

import React, { useState, useRef } from 'react';
import { Mic, Upload, Zap, Download, Activity, Radio } from 'lucide-react';

interface AudioMetadata {
  dominantFrequency: number;
  centroidFrequency: number;
  rms: number;
  duration: number;
}

const AudioRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [sourceAudioUrl, setSourceAudioUrl] = useState<string | null>(null);
  const [denoisedAudioUrl, setDenoisedAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [message, setMessage] = useState<string>('SYSTEM READY. AWAITING INPUT.');
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setSourceAudioUrl(url);
        setMessage('RECORDING CAPTURED. READY FOR NEURAL PROCESSING.');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setMessage('RECORDING IN PROGRESS...');
      setDenoisedAudioUrl(null);
      setMetadata(null);
    } catch (error) {
      setMessage('ERROR: MICROPHONE ACCESS DENIED.');
      console.error('Recording error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.includes('audio')) {
      setAudioBlob(file);
      const url = URL.createObjectURL(file);
      setSourceAudioUrl(url);
      setMessage('AUDIO FILE LOADED. READY FOR NEURAL PROCESSING.');
      setDenoisedAudioUrl(null);
      setMetadata(null);
    } else {
      setMessage('ERROR: INVALID FILE FORMAT. AUDIO FILES ONLY.');
    }
  };

  const denoiseAudio = async () => {
    if (!audioBlob) {
      setMessage('ERROR: NO AUDIO DATA AVAILABLE.');
      return;
    }

    setLoading(true);
    setMessage('INITIATING NEURAL ANALYSIS...');

    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.wav');

    try {
      const response = await fetch('/api/denoise', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const metadataHeader = response.headers.get('X-Audio-Metadata');
      if (metadataHeader) {
        const jsonString = metadataHeader.replace(/'/g, '"');
        const parsedMetadata = JSON.parse(jsonString);
        setMetadata({
          dominantFrequency: parsedMetadata.dominant_frequency || 0,
          centroidFrequency: parsedMetadata.centroid_frequency || 0,
          rms: parsedMetadata.rms || 0,
          duration: parsedMetadata.duration || 0,
        });
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDenoisedAudioUrl(url);
      setMessage('NEURAL PROCESSING COMPLETE. AUDIO ENHANCED.');
    } catch (error) {
      setMessage(`ERROR: PROCESSING FAILED - ${error instanceof Error ? error.message : 'UNKNOWN'}`);
      console.error('Denoise error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="text-center mb-10 border-b-2 border-blue-500 pb-6 rounded-xl bg-gradient-to-b from-purple-950/20 to-transparent">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Radio className="w-10 h-10 text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
            <h1 className="text-4xl font-bold tracking-wider text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,1)]">
              NEURAL AUDIO MATRIX
            </h1>
            <Radio className="w-10 h-10 text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
          </div>
          <h2 className="text-xl tracking-widest text-purple-400">[ DENOISER v2.0 ]</h2>
        </div>

        {/* Status Message */}
        <div className="mb-8 p-4 bg-purple-950/40 border-2 border-blue-500 rounded-2xl shadow-[0_0_25px_rgba(59,130,246,0.4)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Activity className={`w-5 h-5 ${loading ? 'animate-pulse text-blue-300' : 'text-blue-400'}`} />
            <p className={`text-sm ${loading ? 'text-blue-300 animate-pulse' : 'text-blue-200'}`}>
              {message}
            </p>
          </div>
        </div>

        {/* Control Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Recording Control */}
          <div className="bg-purple-950/40 p-6 border-2 border-purple-600 rounded-2xl shadow-[0_0_20px_rgba(147,51,234,0.4)] backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 text-purple-300">
              <Mic className="w-5 h-5" />
              <h3 className="text-lg tracking-wide font-bold">RECORD</h3>
            </div>
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)] hover:shadow-[0_0_25px_rgba(59,130,246,1)]"
              >
                START CAPTURE
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold tracking-wider animate-pulse transition-all shadow-[0_0_15px_rgba(220,38,38,0.6)]"
              >
                STOP RECORDING
              </button>
            )}
          </div>

          {/* Upload Control */}
          <div className="bg-purple-950/40 p-6 border-2 border-purple-600 rounded-2xl shadow-[0_0_20px_rgba(147,51,234,0.4)] backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 text-purple-300">
              <Upload className="w-5 h-5" />
              <h3 className="text-lg tracking-wide font-bold">UPLOAD</h3>
            </div>
            <label className="block">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-wider transition-all cursor-pointer block text-center shadow-[0_0_15px_rgba(59,130,246,0.6)] hover:shadow-[0_0_25px_rgba(59,130,246,1)]"
              >
                SELECT FILE
              </label>
            </label>
          </div>

          {/* Process Control */}
          <div className="bg-purple-950/40 p-6 border-2 border-purple-600 rounded-2xl shadow-[0_0_20px_rgba(147,51,234,0.4)] backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4 text-purple-300">
              <Zap className="w-5 h-5" />
              <h3 className="text-lg tracking-wide font-bold">PROCESS</h3>
            </div>
            <button
              onClick={denoiseAudio}
              disabled={!audioBlob || loading}
              className={`w-full py-3 rounded-xl font-bold tracking-wider transition-all ${
                !audioBlob || loading
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed border-2 border-gray-700'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] hover:shadow-[0_0_25px_rgba(59,130,246,1)]'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Activity className="w-5 h-5 animate-spin" />
                  PROCESSING...
                </span>
              ) : (
                'DENOISE'
              )}
            </button>
          </div>
        </div>

        {/* Audio Playback Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Original Audio */}
          <div className="bg-purple-950/40 p-6 border-2 border-blue-500 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] backdrop-blur-sm">
            <h3 className="text-lg mb-4 text-blue-300 tracking-wide font-bold">[ NOISY INPUT ]</h3>
            {sourceAudioUrl ? (
              <audio
                controls
                src={sourceAudioUrl}
                className="w-full rounded-xl"
                style={{
                  filter: 'hue-rotate(240deg) saturate(1.5) brightness(1.2) contrast(1.3)',
                }}
              />
            ) : (
              <div className="h-12 flex items-center justify-center text-gray-600 border-2 border-gray-800 rounded-xl bg-black/50">
                NO DATA
              </div>
            )}
          </div>

          {/* Denoised Audio */}
          <div className="bg-purple-950/40 p-6 border-2 border-blue-400 rounded-2xl shadow-[0_0_25px_rgba(59,130,246,0.5)] backdrop-blur-sm">
            <h3 className="text-lg mb-4 text-blue-300 tracking-wide font-bold">[ ENHANCED OUTPUT ]</h3>
            {denoisedAudioUrl ? (
              <div className="space-y-4">
                <audio
                  controls
                  src={denoisedAudioUrl}
                  className="w-full rounded-xl"
                  style={{
                    filter: 'hue-rotate(240deg) saturate(1.5) brightness(1.2) contrast(1.3)',
                  }}
                />
                <a
                  href={denoisedAudioUrl}
                  download="denoised_audio.wav"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(59,130,246,0.6)] hover:shadow-[0_0_25px_rgba(59,130,246,1)]"
                >
                  <Download className="w-5 h-5" />
                  DOWNLOAD
                </a>
              </div>
            ) : (
              <div className="h-12 flex items-center justify-center text-gray-600 border-2 border-gray-800 rounded-xl bg-black/50">
                AWAITING PROCESSING
              </div>
            )}
          </div>
        </div>

        {/* Metadata Panel */}
        {metadata && (
          <div className="bg-purple-950/40 p-6 border-2 border-blue-500 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.5)] backdrop-blur-sm">
            <h3 className="text-xl mb-6 text-blue-300 tracking-widest text-center border-b-2 border-blue-600 pb-3 font-bold">
              [ SPECTRAL ANALYSIS ]
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-black/30 rounded-xl border border-purple-700">
                <p className="text-purple-400 text-xs mb-2 tracking-wider font-bold">DOMINANT FREQ</p>
                <p className="text-3xl text-blue-400 font-bold drop-shadow-[0_0_12px_rgba(59,130,246,1)]">
                  {metadata.dominantFrequency.toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs mt-1">Hz</p>
              </div>
              <div className="text-center p-4 bg-black/30 rounded-xl border border-purple-700">
                <p className="text-purple-400 text-xs mb-2 tracking-wider font-bold">CENTROID FREQ</p>
                <p className="text-3xl text-blue-400 font-bold drop-shadow-[0_0_12px_rgba(59,130,246,1)]">
                  {metadata.centroidFrequency.toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs mt-1">Hz</p>
              </div>
              <div className="text-center p-4 bg-black/30 rounded-xl border border-purple-700">
                <p className="text-purple-400 text-xs mb-2 tracking-wider font-bold">RMS LOUDNESS</p>
                <p className="text-3xl text-blue-400 font-bold drop-shadow-[0_0_12px_rgba(59,130,246,1)]">
                  {metadata.rms.toFixed(4)}
                </p>
                <p className="text-gray-500 text-xs mt-1">AMPLITUDE</p>
              </div>
              <div className="text-center p-4 bg-black/30 rounded-xl border border-purple-700">
                <p className="text-purple-400 text-xs mb-2 tracking-wider font-bold">DURATION</p>
                <p className="text-3xl text-blue-400 font-bold drop-shadow-[0_0_12px_rgba(59,130,246,1)]">
                  {metadata.duration.toFixed(2)}
                </p>
                <p className="text-gray-500 text-xs mt-1">SECONDS</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;
