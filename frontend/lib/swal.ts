import Swal from 'sweetalert2';

// Standard dark theme configuration for SweetAlert2 matching MassMailer design
const darkSwal = Swal.mixin({
  background: '#12121f',
  color: '#e2e8f0',
  confirmButtonColor: '#8b5cf6',
  cancelButtonColor: '#475569',
  customClass: {
    popup: 'border border-[rgba(139,92,246,0.2)] rounded-2xl shadow-2xl backdrop-blur-md',
    title: 'text-xl font-bold text-slate-100',
    htmlContainer: 'text-sm text-slate-300',
    confirmButton: 'btn btn-primary px-5 py-2 font-medium text-sm rounded-lg',
    cancelButton: 'btn btn-ghost px-5 py-2 font-medium text-sm rounded-lg',
  },
  buttonsStyling: false,
});

// Toast notification preset
const toastSwal = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: '#1a1a2e',
  color: '#e2e8f0',
  customClass: {
    popup: 'border border-[rgba(139,92,246,0.3)] rounded-xl shadow-lg',
    title: 'text-sm font-medium text-slate-200',
  },
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const showToast = (
  icon: 'success' | 'error' | 'warning' | 'info',
  title: string
) => {
  return toastSwal.fire({
    icon,
    title,
  });
};

export const showAlert = ({
  title,
  text,
  icon = 'info',
  confirmButtonText = 'OK',
}: {
  title: string;
  text?: string;
  icon?: 'success' | 'error' | 'warning' | 'info' | 'question';
  confirmButtonText?: string;
}) => {
  return darkSwal.fire({
    title,
    text,
    icon,
    confirmButtonText,
  });
};

export const showConfirm = ({
  title,
  text,
  icon = 'warning',
  confirmButtonText = 'Yes, proceed',
  cancelButtonText = 'Cancel',
}: {
  title: string;
  text?: string;
  icon?: 'warning' | 'error' | 'info' | 'question';
  confirmButtonText?: string;
  cancelButtonText?: string;
}) => {
  return darkSwal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
  });
};

export default darkSwal;
