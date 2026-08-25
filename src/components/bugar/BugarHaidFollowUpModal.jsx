import Modal from '../Modal.jsx';

export default function BugarHaidFollowUpModal({
  isOpen,
  onStillOnPeriod,
  onFinished,
  loading,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="Konfirmasi Periode Haid"
      hideActionButton
    >
      <div className="flex flex-col gap-3 pt-1">
        <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
          Periode haid sebelumnya sudah berakhir. Apakah Anda masih dalam periode haid?
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onStillOnPeriod}
            disabled={loading}
            className="w-full py-3 rounded-[14px] bg-rose-600 text-white text-xs font-black disabled:opacity-60"
          >
            {loading ? 'Menyimpan…' : 'Ya, masih'}
          </button>
          <button
            type="button"
            onClick={onFinished}
            disabled={loading}
            className="w-full py-3 rounded-[14px] bg-slate-100 text-slate-700 text-xs font-extrabold disabled:opacity-60"
          >
            Sudah selesai
          </button>
        </div>
      </div>
    </Modal>
  );
}
