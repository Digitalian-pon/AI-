
import React, { useState, useCallback, useEffect } from 'react';
import { UploadCloudIcon, MusicIcon, FileImageIcon } from './Icons';

interface FileUploadProps {
  label: string;
  acceptedTypes: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  isAudio?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, acceptedTypes, file, onFileChange, isAudio = false }) => {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file && !isAudio) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // Free memory when the component is unmounted
      return () => URL.revokeObjectURL(objectUrl);
    }
    // No preview for audio files, just show file name
    setPreview(null);
  }, [file, isAudio]);

  const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      onFileChange(event.dataTransfer.files[0]);
    }
  }, [onFileChange]);

  const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        onFileChange(event.target.files[0]);
    }
  };

  const Icon = isAudio ? MusicIcon : FileImageIcon;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="flex justify-center items-center w-full h-48 px-6 transition bg-gray-700 border-2 border-gray-600 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-500 focus:outline-none"
      >
        {file ? (
          <div className="text-center">
            {preview && !isAudio ? (
              <img src={preview} alt="Preview" className="max-h-32 rounded-md mx-auto mb-2" />
            ) : (
              <Icon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            )}
            <p className="text-sm text-gray-300 break-all">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">クリックして変更</p>
          </div>
        ) : (
          <div className="text-center">
            <UploadCloudIcon className="mx-auto h-12 w-12 text-gray-500" />
            <span className="mt-2 block text-sm font-medium text-gray-400">
              ファイルをここにドラッグ＆ドロップ
            </span>
            <span className="text-xs text-gray-500">またはクリックして選択</span>
          </div>
        )}
        <input type="file" name="file_upload" className="hidden" accept={acceptedTypes} onChange={handleFileChange} />
      </label>
    </div>
  );
};

export default FileUpload;
