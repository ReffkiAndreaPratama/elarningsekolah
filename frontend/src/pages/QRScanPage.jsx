import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, MapPin, CheckCircle, XCircle, Loader, ArrowLeft, Shield, Wifi } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';

const steps = [
  { icon: MapPin,   title: 'Enable GPS',    desc: 'Allow location access' },
  { icon: QrCode,   title: 'Scan QR Code',  desc: 'Point camera at QR' },
  { icon: CheckCircle, title: 'Confirmed',  desc: 'Attendance marked' },
];

export default function QRScanPage() {
  const [step, setStep] = useState('idle'); // idle | locating | ready | scanning | success | error
  const [location, setLocation] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    getLocation();
    return () => { if (scannerRef.current) { try { scannerRef.current.clear(); } catch {} } };
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation not supported by your browser');
      setStep('error');
      return;
    }
    setStep('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setStep('ready');
        toast.success('GPS location acquired');
      },
      (err) => {
        setErrorMsg('Failed to get GPS location. Please enable location services and try again.');
        setStep('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const startScanning = () => {
    setStep('scanning');
    setResult(null);

    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      });
      scannerRef.current = scanner;

      scanner.render(
        async (decodedText) => {
          try { scanner.clear(); } catch {}
          setStep('processing');
          try {
            const qrData = JSON.parse(decodedText);
            await markAttendance(qrData);
          } catch {
            setErrorMsg('Invalid QR code format. Please scan the correct QR code.');
            setStep('error');
          }
        },
        () => {}
      );
    }, 100);
  };

  const markAttendance = async (qrData) => {
    try {
      const { data } = await api.post('/attendance/qr', {
        qr_token: qrData.token,
        session_id: qrData.sessionId,
        lat: location?.lat,
        lng: location?.lng,
        accuracy: location?.accuracy,
      });
      setResult({ success: true, data: data.data, message: data.message });
      setStep('success');
      toast.success(data.message);
      setTimeout(() => navigate('/dashboard'), 4000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to mark attendance';
      setErrorMsg(msg);
      setResult({ success: false, message: msg });
      setStep('error');
      toast.error(msg);
    }
  };

  const reset = () => {
    setStep('ready');
    setResult(null);
    setErrorMsg('');
    if (scannerRef.current) { try { scannerRef.current.clear(); } catch {} }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="page-title mb-0">Scan QR Code</h1>
          <p className="page-subtitle">Mark your attendance for today's class</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => {
            const isActive = (i === 0 && ['locating','ready','scanning','processing','success'].includes(step)) ||
                             (i === 1 && ['scanning','processing'].includes(step)) ||
                             (i === 2 && step === 'success');
            const isDone   = (i === 0 && ['ready','scanning','processing','success'].includes(step)) ||
                             (i === 1 && ['processing','success'].includes(step)) ||
                             (i === 2 && step === 'success');
            return (
              <React.Fragment key={s.title}>
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all
                    ${isDone ? 'bg-emerald-500' : isActive ? 'bg-primary-500' : 'bg-slate-100'}`}>
                    <s.icon className={`w-5 h-5 ${isDone || isActive ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  <p className={`text-xs font-medium ${isDone || isActive ? 'text-slate-800' : 'text-slate-400'}`}>{s.title}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${isDone ? 'bg-emerald-400' : 'bg-slate-100'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* GPS status */}
      <div className={`card p-4 flex items-center gap-3 border-l-4 transition-all
        ${location ? 'border-l-emerald-500 bg-emerald-50/30' : step === 'locating' ? 'border-l-blue-400 bg-blue-50/30' : 'border-l-orange-400 bg-orange-50/30'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
          ${location ? 'bg-emerald-100' : 'bg-orange-100'}`}>
          {step === 'locating'
            ? <Loader className="w-4 h-4 text-blue-500 animate-spin" />
            : <MapPin className={`w-4 h-4 ${location ? 'text-emerald-600' : 'text-orange-500'}`} />
          }
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {location ? 'GPS Location Ready' : step === 'locating' ? 'Getting Location...' : 'Location Required'}
          </p>
          {location
            ? <p className="text-xs text-slate-500">±{Math.round(location.accuracy)}m accuracy · {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
            : <p className="text-xs text-slate-500">Enable location services to continue</p>
          }
        </div>
        {location && <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
      </div>

      {/* Main content */}
      {step === 'idle' || step === 'locating' ? (
        <div className="card p-10 text-center">
          <div className="w-20 h-20 bg-primary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Loader className="w-10 h-10 text-primary-400 animate-spin" />
          </div>
          <p className="font-semibold text-slate-700">Getting your location...</p>
          <p className="text-sm text-slate-400 mt-1">Please allow location access when prompted</p>
        </div>
      ) : step === 'ready' ? (
        <div className="card p-10 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <QrCode className="w-12 h-12 text-primary-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Ready to Scan</h3>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Ask your teacher to display the QR code, then tap the button below to start scanning.
          </p>
          <button onClick={startScanning} className="btn-primary mx-auto px-8 py-3 text-base">
            <QrCode className="w-5 h-5" /> Start Camera
          </button>
        </div>
      ) : step === 'scanning' ? (
        <div className="card p-4">
          <div id="qr-reader" className="w-full rounded-2xl overflow-hidden" />
          <button onClick={reset} className="btn-secondary w-full mt-4 justify-center">
            Cancel
          </button>
        </div>
      ) : step === 'processing' ? (
        <div className="card p-10 text-center">
          <div className="w-20 h-20 bg-primary-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Loader className="w-10 h-10 text-primary-500 animate-spin" />
          </div>
          <p className="font-semibold text-slate-700">Verifying attendance...</p>
          <p className="text-sm text-slate-400 mt-1">Validating QR code and GPS location</p>
        </div>
      ) : step === 'success' ? (
        <div className="card p-8 text-center border-2 border-emerald-200 bg-emerald-50/30 animate-scale-in">
          <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">Attendance Marked!</h3>
          <p className="text-slate-500 text-sm mb-5">{result?.message}</p>

          <div className="grid grid-cols-2 gap-3 text-left mb-5">
            {[
              { label: 'Status',   value: result?.data?.status,   color: result?.data?.status === 'present' ? 'text-emerald-600' : 'text-amber-600' },
              { label: 'Method',   value: result?.data?.method?.toUpperCase(), color: 'text-slate-800' },
              { label: 'GPS Valid', value: result?.data?.gpsValid ? 'Yes ✓' : 'No ✗', color: result?.data?.gpsValid ? 'text-emerald-600' : 'text-red-500' },
              { label: 'Distance', value: `${Math.round(result?.data?.gpsDistance || 0)}m`, color: 'text-slate-800' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl p-3 border border-emerald-100">
                <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                <p className={`text-sm font-bold capitalize ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {result?.data?.spoofingWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-left">
              <p className="text-xs text-amber-700 font-medium">⚠️ GPS Warning: {result.data.spoofingWarning.join(', ')}</p>
            </div>
          )}

          <p className="text-xs text-slate-400">Redirecting to dashboard in a few seconds...</p>
        </div>
      ) : step === 'error' ? (
        <div className="card p-8 text-center border-2 border-red-200 bg-red-50/30 animate-scale-in">
          <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Failed</h3>
          <p className="text-red-600 text-sm mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={getLocation} className="btn-secondary">
              <MapPin className="w-4 h-4" /> Retry GPS
            </button>
            <button onClick={reset} className="btn-primary">
              <QrCode className="w-4 h-4" /> Try Again
            </button>
          </div>
        </div>
      ) : null}

      {/* Info card */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary-500" />
          <h3 className="font-semibold text-slate-800 text-sm">How it works</h3>
        </div>
        <ol className="space-y-2">
          {[
            'Enable GPS — you must be within school premises',
            'Ask your teacher to display the session QR code',
            'Tap "Start Camera" and point at the QR code',
            'Your attendance is automatically recorded',
          ].map((text, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600">
              <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
              {text}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
