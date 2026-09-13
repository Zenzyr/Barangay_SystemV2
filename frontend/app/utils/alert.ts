import Swal from "sweetalert2";
import { toast } from "sonner";

export const successAlert = (text: string) => {
  toast.success(text);
};

export const errorAlert = (text: string) => {
  toast.error(text);
};

export const confirmAlert = (
  text: string,
  buttonText: string,
  callback: () => void
) => {
  Swal.fire({
    title: "Are you sure?",
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: buttonText,
    cancelButtonText: "Cancel",
  }).then((result) => {
    if (result.isConfirmed) {
      callback();
    }
  });
};