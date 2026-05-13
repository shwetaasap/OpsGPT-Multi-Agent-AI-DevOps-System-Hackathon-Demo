import React, { useRef, useState, useCallback } from 'react';
import { Upload, AlertCircle, Loader2, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';

interface LogUploaderProps {
  onAnalysisStart: (logs: string, fileName?: string) => Promise<unknown>;
  isAnalyzing: boolean;
  error?: string | null;
}

type Status = 'idle' | 'dragging' | 'reading' | 'analyzing' | 'error';

export function LogUploader({ onAnalysisStart, isAnalyzing, error }: LogUploaderProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStatus('idle');
    setFileName(null);
    setLocalError(null);
  };

  const handleFile = useCallback(async (file: File) => {
    const validExtensions = ['.log', '.txt', '.json'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(extension)) {
      setLocalError(`Invalid file type. Please upload ${validExtensions.join(', ')}`);
      setStatus('error');
      return;
    }

    setFileName(file.name);
    setLocalError(null);
    setStatus('reading');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setStatus('analyzing');
      try {
        await onAnalysisStart(content, file.name);
        setStatus('idle');
      } catch {
        setStatus('error');
      }
    };
    reader.onerror = () => {
      setLocalError('Could not read file.');
      setStatus('error');
    };
    reader.readAsText(file);
  }, [onAnalysisStart]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setStatus('idle');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setStatus('dragging');
  };

  const onDragLeave = () => {
    if (status === 'dragging') setStatus('idle');
  };

  const showStatus = isAnalyzing || status === 'reading' || status === 'analyzing' || status === 'error';
  const displayError = error || localError;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {!showStatus ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer group',
              status === 'dragging'
                ? 'border-primary bg-blue-500/5'
                : 'border-border hover:border-muted bg-card/50 hover:bg-card/40'
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".log,.txt,.json"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="flex flex-col items-center gap-4 text-center">
              <div className={cn(
                'w-16 h-16 rounded-full bg-card flex items-center justify-center border border-border group-hover:scale-110 transition-transform',
                status === 'dragging' && 'border-primary text-primary animate-bounce'
              )}>
                <Upload className={cn('w-8 h-8', status === 'dragging' ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">Upload Operational Logs</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Drag and drop .log, .txt, or .json files to trigger automated incident analysis.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-8 shadow-2xl"
          >
            <div className="flex items-start gap-5">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                status === 'reading' || status === 'analyzing' || isAnalyzing ? 'bg-primary/10 text-primary' :
                  'bg-red-500/10 text-red-500'
              )}>
                {status === 'reading' && <Loader2 className="w-6 h-6 animate-spin" />}
                {(status === 'analyzing' || isAnalyzing) && (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                    <RefreshCcw className="w-6 h-6" />
                  </motion.div>
                )}
                {status === 'error' && <AlertCircle className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-foreground truncate max-w-[400px]">{fileName ?? 'Processing'}</h4>
                <p className="text-xs text-muted-foreground mt-1 uppercase font-mono tracking-tighter">
                  {status === 'reading' && 'Reading file…'}
                  {(status === 'analyzing' || isAnalyzing) && 'LangGraph pipeline running…'}
                  {status === 'error' && 'Pipeline error'}
                </p>
                {status === 'error' && displayError && (
                  <div className="mt-4 p-3 bg-red-950/20 border border-red-900/50 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs text-red-200 break-all">{displayError}</span>
                    <button onClick={reset} className="ml-auto text-xs font-bold text-red-500 hover:underline">
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
