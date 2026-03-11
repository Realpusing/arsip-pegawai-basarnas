import React from 'react'
import { useUpload } from '../../context/UploadContext'

function UploadProgress() {
  const { uploads, removeUpload } = useUpload()

  if (uploads.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80">
      {uploads.map(upload => (
        <div
          key={upload.id}
          className={`rounded-xl shadow-2xl border p-4 transition-all animate-slide-up ${
            upload.status === 'success' ? 'bg-green-50 border-green-200' :
            upload.status === 'error' ? 'bg-red-50 border-red-200' :
            'bg-white border-gray-200'
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-lg">
                {upload.status === 'uploading' ? '📤' :
                 upload.status === 'success' ? '✅' : '❌'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {upload.namaBerkas}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {upload.fileName}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeUpload(upload.id)}
              className="text-gray-400 hover:text-gray-600 text-sm ml-2"
            >
              ✕
            </button>
          </div>

          {/* Progress Bar */}
          {upload.status === 'uploading' && (
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-orange-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${upload.progress}%` }}
              />
            </div>
          )}

          {/* Status Text */}
          <p className={`text-xs mt-1 ${
            upload.status === 'uploading' ? 'text-orange-600' :
            upload.status === 'success' ? 'text-green-600' :
            'text-red-600'
          }`}>
            {upload.status === 'uploading' && `Mengupload... ${upload.progress}%`}
            {upload.status === 'success' && 'Upload berhasil! ✓'}
            {upload.status === 'error' && `Gagal: ${upload.error}`}
          </p>
        </div>
      ))}
    </div>
  )
}

export default UploadProgress