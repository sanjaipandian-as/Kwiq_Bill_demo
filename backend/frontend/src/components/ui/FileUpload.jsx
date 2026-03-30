import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';

export const FileUpload = ({ value, onChange, accept = 'image/*,.pdf', maxSize = 5 * 1024 * 1024 }) => {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    const validateFile = (file) => {
        if (file.size > maxSize) {
            setError(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
            return false;
        }

        const acceptedTypes = accept.split(',').map(t => t.trim());
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        const mimeType = file.type;

        const isAccepted = acceptedTypes.some(type => {
            if (type.startsWith('.')) {
                return fileExtension === type;
            }
            if (type.includes('*')) {
                return mimeType.startsWith(type.split('/*')[0]);
            }
            return mimeType === type;
        });

        if (!isAccepted) {
            setError('File type not supported. Please upload an image or PDF.');
            return false;
        }

        setError('');
        return true;
    };

    const handleFile = (file) => {
        if (file && validateFile(file)) {
            onChange(file);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const removeFile = () => {
        onChange(null);
        setError('');
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const getFileIcon = () => {
        if (!value) return null;
        if (value.type?.startsWith('image/')) {
            return <ImageIcon className="h-8 w-8 text-blue-500" />;
        }
        return <FileText className="h-8 w-8 text-red-500" />;
    };

    const getFilePreview = () => {
        if (!value) return null;
        if (value.type?.startsWith('image/')) {
            return (
                <img
                    src={URL.createObjectURL(value)}
                    alt="Preview"
                    className="max-h-32 rounded-lg object-contain"
                />
            );
        }
        return null;
    };

    return (
        <div className="space-y-2">
            {!value ? (
                <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-600 mb-2">
                        Drag and drop your file here, or
                    </p>
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                        Browse Files
                    </button>
                    <p className="text-xs text-slate-500 mt-2">
                        Supported: Images (JPG, PNG) and PDF (Max {maxSize / (1024 * 1024)}MB)
                    </p>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        onChange={handleChange}
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                            {getFileIcon()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                                {value.name}
                            </p>
                            <p className="text-xs text-slate-500">
                                {(value.size / 1024).toFixed(2)} KB
                            </p>
                            {getFilePreview() && (
                                <div className="mt-2">
                                    {getFilePreview()}
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={removeFile}
                            className="flex-shrink-0 p-1 hover:bg-slate-200 rounded-full transition-colors"
                        >
                            <X className="h-4 w-4 text-slate-600" />
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
        </div>
    );
};
