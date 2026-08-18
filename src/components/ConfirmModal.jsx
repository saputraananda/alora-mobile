import React from 'react';
import Modal from './Modal.jsx';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message = 'Apakah Anda yakin?',
  confirmText = 'Ya',
  cancelText = 'Batal',
  variant = 'danger'
}) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      hideActionButton={true}
    >
      <div className="flex flex-col gap-4 pt-1">
        <p className="text-[12.5px] text-slate-600 font-medium leading-relaxed">
          {message}
        </p>
        <div className="flex items-center gap-2.5 pt-1">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-[14px] bg-slate-100 text-slate-700 text-xs font-extrabold hover:bg-slate-200 transition"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm || onClose}
            className={`flex-1 py-3 px-4 rounded-[14px] text-white text-xs font-black transition shadow-md ${
              variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-navy-950 hover:bg-navy-900 shadow-navy-950/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
