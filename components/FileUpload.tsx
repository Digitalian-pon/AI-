import React from 'react';
import { UploadCloudIcon } from './Icons';
import { useI18n } from '../i18n';

interface FileUploadProps {
  label: string;
  acceptedTypes: string;
  file?: File | null;
  files?: File[];
  onFileChange: (file: File | null) => void;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, acceptedTypes, file, files, onFileChange, Icon, multiple = false }) => {
  const { t } = useI18n();

  const onDrop = React.useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      if (multiple) {
        Array.from(event.dataTransfer.files).forEach(f => onFileChange(f));
      } else {
        onFileChange(event.dataTransfer.files[0]);
      }
    }
  }, [onFileChange, multiple]);

  const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
       if (multiple) {
        Array.from(event.target.files).forEach(f => onFileChange(f));
      } else {
        onFileChange(event.target.files[0]);
      }
    } else {
      onFileChange(null);
    }
    event.target.value = '';
  };

  const hasFiles = multiple ? files && files.length > 0 : !!file;

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        className={`flex justify-center items-center w-full h-48 px-4 transition bg-gray-800/50 border-2 border-gray-600 border-dashed rounded-lg appearance-none cursor-pointer hover:border-purple-500 focus:outline-none ${hasFiles ? 'pt-4' : ''}`}
      >
        {hasFiles ? (
           multiple && files ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex-grow overflow-y-auto grid grid-cols-3 gap-2 pr-2">
                {files.map((f, i) => (
                  <img key={i} src={URL.createObjectURL(f)} alt={`preview ${i}`} className="w-full h-full object-cover rounded" />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center pb-2">{t('uploadAddMoreImages')}</p>
            </div>
           ) : file ? (
             <div className="text-center">
              <Icon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p className="text-sm text-gray-300 break-all">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{t('uploadClickToChange')}</p>
            </div>
           ) : null
        ) : (
          <div className="text-center">
            <Icon className="mx-auto h-12 w-12 text-gray-500" />
            <span className="mt-2 block text-sm font-medium text-gray-400">
              {t('uploadDragAndDrop')}
            </span>
            <span className="text-xs text-gray-500">{t('uploadOrClick')}</span>
          </div>
        )}
        <input type="file" name="file_upload" className="hidden" accept={acceptedTypes} onChange={handleFileChange} multiple={multiple} />
      </label>
    </div>
  );
};

export default FileUpload;