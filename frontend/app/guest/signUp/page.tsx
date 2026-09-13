"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  Upload,
  Camera,
  IdCard,
  UserRound,
  Mail,
  Lock,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  CalendarDays,
  Users,
  Hash,
  Heart,
  Vote,
  AlertCircle,
} from "lucide-react";

// ─── Validation rules ────────────────────────────────────────────
type FormValues = {
  name: string;
  email: string;
  contact: string;
  address: string;
  password: string;
  confirmPassword: string;
  gender: string;
  dateOfBirth: string;
  civilStatus: string;
  purok: string;
  voterStatus: string;
  houseHoldNumber: string;
};

const validators: {
  [K in keyof FormValues]: (value: string, values: FormValues) => string;
} = {
  name: (v) => {
    if (!v.trim()) return "Full name is required";
    if (v.trim().length < 2) return "Name looks too short";
    if (!/^[a-zA-ZñÑ.'\-\s]+$/.test(v)) return "Name can only contain letters and spaces";
    return "";
  },
  email: (v) => {
    const email = v.trim();
    if (!email) return "Email is required";
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(email)) {
      return "Enter a valid email address (e.g. name@domain.com)";
    }
    return "";
  },
  contact: (v) => {
    if (!v.trim()) return "Contact number is required";
    if (!/^09\d{9}$/.test(v)) return "Enter a valid 11-digit mobile number (e.g. 09171234567)";
    return "";
  },
  address: (v) => {
    if (!v.trim()) return "Address is required";
    if (v.trim().length < 5) return "Please enter a complete address";
    return "";
  },
  password: (v) => {
    if (!v) return "Password is required";
    if (v.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(v)) return "Password must include an uppercase letter (A-Z)";
    if (!/[a-z]/.test(v)) return "Password must include a lowercase letter (a-z)";
    if (!/[0-9]/.test(v)) return "Password must include a number (0-9)";
    if (!/[^A-Za-z0-9]/.test(v)) return "Password must include a special character";
    return "";
  },
  confirmPassword: (v, values) => {
    if (!v) return "Please confirm your password";
    if (v !== values.password) return "Passwords do not match";
    return "";
  },
  gender: (v) => (!v ? "Please select a gender" : ""),
  dateOfBirth: (v) => {
    if (!v) return "Date of birth is required";
    const dob = new Date(v);
    if (isNaN(dob.getTime())) return "Enter a valid date";
    const today = new Date();
    if (dob > today) return "Date of birth cannot be in the future";
    const ageMs = today.getTime() - dob.getTime();
    const age = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 13) return "Resident must be at least 13 years old";
    if (age > 120) return "Enter a valid date of birth";
    return "";
  },
  civilStatus: (v) => (!v ? "Please select a civil status" : ""),
  purok: (v) => (!v ? "Please select a purok" : ""),
  voterStatus: (v) => (!v ? "Please select a voter status" : ""),
  houseHoldNumber: (v) => (!v.trim() ? "Household number is required" : ""),
};

// ─── ID image verification ───────────────────────────────────────
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
};

const MAX_ID_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_ID_IMAGE_SIZE = 250; // pixels per side

// Reads the file's magic bytes so a renamed non-image file is rejected.
function readImageMagicBytes(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result as ArrayBuffer | null;
      if (!buf) return resolve(null);
      const b = new Uint8Array(buf, 0, 12);
      // JPEG: FF D8 FF
      if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return resolve("jpeg");
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (
        b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e &&
        b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a &&
        b[6] === 0x1a && b[7] === 0x0a
      ) return resolve("png");
      // WebP: RIFF....WEBP
      const magic =
        String.fromCharCode(b[0], b[1], b[2], b[3]) +
        String.fromCharCode(b[8], b[9], b[10], b[11]);
      if (magic === "RIFF" + "WEBP") return resolve("webp");
      resolve(null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

// Loads the image to confirm it actually decodes and get its real dimensions.
function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function verifyIdImage(file: File): Promise<{ ok: boolean; error?: string }> {
  if (!ALLOWED_IMAGE_TYPES[file.type]) {
    return {
      ok: false,
      error: "Please upload a valid image file (JPG, PNG or WEBP)",
    };
  }
  if (file.size > MAX_ID_IMAGE_SIZE) {
    return { ok: false, error: "Image must be less than 5MB" };
  }

  const magic = await readImageMagicBytes(file);
  if (!magic) {
    return {
      ok: false,
      error: "This file is not a real image — please upload a valid JPG, PNG or WEBP photo of your ID",
    };
  }

  const dims = await readImageDimensions(file);
  if (!dims) {
    return {
      ok: false,
      error: "The image could not be read — please retake the photo and upload it again",
    };
  }
  if (dims.width < MIN_ID_IMAGE_SIZE || dims.height < MIN_ID_IMAGE_SIZE) {
    return {
      ok: false,
      error: "The image is too small to read clearly — please upload a clearer photo (at least 250×250 pixels)",
    };
  }

  return { ok: true };
}

// Downsizes and compresses the image so it fits OCR.space's 1MB submission limit.
async function compressImageToBase64(
  file: File,
  maxDim = 1280,
  maxBytes = 850 * 1024
): Promise<string | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode-failed"));
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    let quality = 0.85;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > maxBytes && quality > 0.4) {
      quality -= 0.15;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    return dataUrl;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
      <AlertCircle className="size-3 shrink-0" />
      {message}
    </p>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Uppercase letter (A-Z)", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", ok: /[a-z]/.test(password) },
    { label: "Number (0-9)", ok: /[0-9]/.test(password) },
    { label: "Special character (!@#$...)", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <ul className="mt-2 space-y-1">
      {checks.map((check) => (
        <li
          key={check.label}
          className={`flex items-center gap-1.5 text-xs ${
            check.ok ? "text-emerald-600" : "text-gray-400"
          }`}
        >
          {check.ok ? (
            <CheckCircle2 className="size-3 shrink-0" />
          ) : (
            <span className="size-3 shrink-0 rounded-full border border-gray-300" />
          )}
          {check.label}
        </li>
      ))}
    </ul>
  );
}

function UploadBox({
  label,
  icon: Icon,
  file,
  preview,
  inputRef,
  onSelect,
  onRemove,
  accentColor,
  verifying,
}: {
  label: string;
  icon: React.ElementType;
  file: File | null;
  preview: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (file: File) => void;
  onRemove: () => void;
  accentColor: string;
  verifying?: boolean;
}) {
  return (
    <div className="relative">
      <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
        {label}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onSelect(f);
            // Reset the input so the same file can be picked again after a
            // failed validation (otherwise onChange won't fire a second time).
            e.target.value = "";
          }
        }}
      />
      {verifying && (
        <div className="absolute inset-0 z-10 rounded-xl bg-white/75 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-sky-600">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-xs font-medium text-gray-600">Verifying ID...</span>
          </div>
        </div>
      )}
      {preview && file ? (
        <div className="relative group rounded-xl overflow-hidden border-2 border-sky-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
          <img
            src={preview}
            alt={label}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
            <button
              type="button"
              onClick={onRemove}
              className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg hover:shadow-red-500/25"
            >
              Remove
            </button>
          </div>
          <div className="absolute top-2 right-2">
            <CheckCircle2 className="size-5 text-green-500 drop-shadow-sm" />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full h-48 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-2 bg-white hover:shadow-lg group ${accentColor}`}
        >
          <div className="size-12 rounded-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-emerald-50 group-hover:scale-110 transition-transform duration-300">
            <Icon className="size-6 text-sky-500" />
          </div>
          <span className="text-sm font-medium text-gray-600">
            Click to upload
          </span>
          <span className="text-xs text-gray-400">
            PNG, JPG or WEBP (max 5MB)
          </span>
        </button>
      )}
    </div>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // New profile fields
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [purok, setPurok] = useState("");
  const [voterStatus, setVoterStatus] = useState("");
  const [houseHoldNumber, setHouseHoldNumber] = useState("");

  // Validation state
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});

  const formValues: FormValues = {
    name,
    email,
    contact,
    address,
    password,
    confirmPassword,
    gender,
    dateOfBirth,
    civilStatus,
    purok,
    voterStatus,
    houseHoldNumber,
  };

  const validateField = (field: keyof FormValues, values: FormValues = formValues) => {
    const message = validators[field](values[field], values);
    setErrors((prev) => ({ ...prev, [field]: message }));
    return message;
  };

  const handleBlur = (field: keyof FormValues) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateAll = (): boolean => {
    const fields = Object.keys(validators) as (keyof FormValues)[];
    const newErrors: Partial<Record<keyof FormValues, string>> = {};
    const newTouched: Partial<Record<keyof FormValues, boolean>> = {};
    let firstErrorField: keyof FormValues | null = null;

    fields.forEach((field) => {
      const message = validators[field](formValues[field], formValues);
      newTouched[field] = true;
      if (message) {
        newErrors[field] = message;
        if (!firstErrorField) firstErrorField = field;
      }
    });

    setErrors(newErrors);
    setTouched(newTouched);

    if (firstErrorField) {
      document.getElementById(firstErrorField)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return !firstErrorField;
  };

  // File uploads
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [idSelfie, setIdSelfie] = useState<File | null>(null);

  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);
  const [idSelfiePreview, setIdSelfiePreview] = useState<string | null>(null);

  const [verifyingSide, setVerifyingSide] = useState<"front" | "back" | null>(null);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (
    file: File,
    side: "front" | "back" | "selfie",
    setFile: (f: File) => void,
    setPreview: (url: string) => void
  ) => {
    const result = await verifyIdImage(file);
    if (!result.ok) {
      errorAlert(result.error || "Please select a valid image file");
      return;
    }
    if (side !== "selfie") {
      setVerifyingSide(side);
      try {
        const base64 = await compressImageToBase64(file);
        if (!base64) throw new Error("Could not read image");
        const { data } = await axiosInstance.post("/account/verify-id", { base64, side });
        if (!data?.ok) {
          errorAlert(
            data?.message ||
              "This image does not look like a valid ID — please upload a clear photo of your ID."
          );
          return;
        }
      } catch (err) {
        const message =
          (err as { response?: { data?: unknown } })?.response?.data ??
          "Could not verify this image (network error). Please try again.";
        errorAlert(typeof message === "string" ? message : "Could not verify this image. Please try again.");
        return;
      } finally {
        setVerifyingSide(null);
      }
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const removeImage = (
    setFile: (f: null) => void,
    setPreview: (url: null) => void,
    ref: React.RefObject<HTMLInputElement | null>
  ) => {
    setFile(null);
    setPreview(null);
    if (ref.current) ref.current.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (verifyingSide) {
      errorAlert("Please wait for the ID images to finish verifying");
      return;
    }

    if (!validateAll()) {
      errorAlert("Please fix the highlighted fields before submitting");
      return;
    }

    // UX-only identity check (ONE PERSON = ONE ACCOUNT). The backend
    // carries out the authoritative check when the account is created.
    try {
      const precheck = await axiosInstance.post("/account/check-duplicate", {
        name: name.trim(),
        dateOfBirth,
        gender,
        contact,
      });
      if (precheck.data?.status === "blocked") {
        errorAlert(
          "This person is already registered in the system. Please log in using your existing account or use account recovery."
        );
        return;
      }
    } catch {
      // Network hiccup — the backend check will catch duplicates anyway.
    }

    if (!idFront || !idBack || !idSelfie) {
      errorAlert("Please upload all 3 ID images (front, back, selfie)");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("address", address.trim());
      formData.append("email", email.trim());
      formData.append("password", password);
      formData.append("status", "pending");
      formData.append("contact", contact);
      formData.append("gender", gender);
      formData.append("dateOfBirth", dateOfBirth);
      formData.append("civilStatus", civilStatus);
      formData.append("purok", purok);
      formData.append("voterStatus", voterStatus);
      formData.append("houseHoldNumber", houseHoldNumber.trim());
      formData.append("profile", "/assets/profile.jpg");
      formData.append("idFront", idFront);
      formData.append("idBack", idBack);
      formData.append("idSelfie", idSelfie);

      await axiosInstance.post("/account", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      successAlert("Registration successful! Please sign in.");
      setTimeout(() => router.push("/guest/signIn"), 1500);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: unknown } })?.response?.data ||
        (err as Error)?.message ||
        "Registration failed";
      errorAlert(typeof message === "string" ? message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-sky-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-sky-600 transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/assets/logo.jpg"
                alt="Barangay Logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-sm font-semibold bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
                Barangay Rabon
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="pointer-events-none absolute -top-20 -left-20 size-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 size-72 rounded-full bg-emerald-200/40 blur-3xl" />

        {/* Brand Header */}
        <div className="relative mb-8 flex flex-col items-center text-center">
          <div className="relative mb-3 size-16 overflow-hidden rounded-2xl shadow-lg shadow-sky-200/40 ring-2 ring-sky-200/60">
            <Image
              src="/assets/logo.jpg"
              alt="Barangay Logo"
              fill
              className="object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Create Your Account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Join Barangay Rabon to access all community services
          </p>
        </div>

        {/* Form Card */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-white/80 shadow-2xl shadow-sky-100/60 backdrop-blur-sm">
          <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-8 space-y-8">
            {/* Personal Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="size-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Full Name
                  </Label>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      id="name"
                      placeholder="Juan Dela Cruz"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={handleBlur("name")}
                      className={`pl-10 h-10 transition-all ${
                        touched.name && errors.name
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    />
                  </div>
                  <FieldError message={touched.name ? errors.name : undefined} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      maxLength={254}
                      placeholder="juan@example.com"
                      value={email}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEmail(value);
                        if (touched.email) {
                          validateField("email", { ...formValues, email: value });
                        }
                      }}
                      onBlur={handleBlur("email")}
                      className={`pl-10 h-10 transition-all ${
                        touched.email && errors.email
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    />
                  </div>
                  <FieldError message={touched.email ? errors.email : undefined} />
                </div>

               

                 <div className="space-y-1.5">
                    <Label htmlFor="contact" className="text-sm font-medium text-gray-700">
                        Contact
                    </Label>

                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />

                        <Input
                        id="contact"
                        type="text"
                        placeholder="0909989785"
                        value={contact}
                        onChange={(e) => setContact(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
                        onBlur={handleBlur("contact")}
                        className={`pl-10 h-10 transition-all ${
                            touched.contact && errors.contact
                            ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                            : contact.length === 11
                            ? "border-green-500 focus:border-green-500 focus:ring-green-500/20"
                            : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                        }`}
                        />
                    </div>
                    <FieldError message={touched.contact ? errors.contact : undefined} />
                </div>


                <div className="space-y-1.5 ">
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                    Address
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                      id="address"
                      placeholder="123 Barangay St., Rabon"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      onBlur={handleBlur("address")}
                      className={`pl-10 h-10 transition-all ${
                        touched.address && errors.address
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    />
                  </div>
                  <FieldError message={touched.address ? errors.address : undefined} />
                </div>

              
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters with uppercase, number & symbol"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (touched.confirmPassword) {
                          validateField("confirmPassword", { ...formValues, password: e.target.value });
                        }
                      }}
                      onBlur={handleBlur("password")}
                      className={`pl-10 pr-10 h-10 transition-all ${
                        touched.password && errors.password
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <FieldError message={touched.password ? errors.password : undefined} />
                  <PasswordRequirements password={password} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 z-10" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={handleBlur("confirmPassword")}
                      className={`pl-10 pr-10 h-10 transition-all ${
                        touched.confirmPassword && errors.confirmPassword
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <FieldError message={touched.confirmPassword ? errors.confirmPassword : undefined} />
                </div>
              </div>
            </div>

            {/* Additional Profile Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="size-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
                Profile Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gender */}
                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-sm font-medium text-gray-700">
                    Gender
                  </Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                    <select
                      id="gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      onBlur={handleBlur("gender")}
                      className={`w-full h-10 pl-10 pr-3 rounded-lg border bg-white text-sm text-gray-700 focus:ring-2 transition-all appearance-none cursor-pointer ${
                        touched.gender && errors.gender
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    >
                      <option value="" disabled>Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <FieldError message={touched.gender ? errors.gender : undefined} />
                </div>

                {/* Date of Birth */}
                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700">
                    Date of Birth
                  </Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                    <input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      onBlur={handleBlur("dateOfBirth")}
                      max={new Date().toISOString().slice(0, 10)}
                      className={`w-full h-10 pl-10 pr-3 rounded-lg border bg-white text-sm text-gray-700 focus:ring-2 transition-all ${
                        touched.dateOfBirth && errors.dateOfBirth
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    />
                  </div>
                  <FieldError message={touched.dateOfBirth ? errors.dateOfBirth : undefined} />
                </div>

                {/* Civil Status */}
                <div className="space-y-1.5">
                  <Label htmlFor="civilStatus" className="text-sm font-medium text-gray-700">
                    Civil Status
                  </Label>
                  <div className="relative">
                    <Heart className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                    <select
                      id="civilStatus"
                      value={civilStatus}
                      onChange={(e) => setCivilStatus(e.target.value)}
                      onBlur={handleBlur("civilStatus")}
                      className={`w-full h-10 pl-10 pr-3 rounded-lg border bg-white text-sm text-gray-700 focus:ring-2 transition-all appearance-none cursor-pointer ${
                        touched.civilStatus && errors.civilStatus
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    >
                      <option value="" disabled>Select civil status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Widowed">Widowed</option>
                      <option value="Separated">Separated</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  </div>
                  <FieldError message={touched.civilStatus ? errors.civilStatus : undefined} />
                </div>

                {/* Purok */}
                <div className="space-y-1.5">
                  <Label htmlFor="purok" className="text-sm font-medium text-gray-700">
                    Purok
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                    <select
                      id="purok"
                      value={purok}
                      onChange={(e) => setPurok(e.target.value)}
                      onBlur={handleBlur("purok")}
                      className={`w-full h-10 pl-10 pr-3 rounded-lg border bg-white text-sm text-gray-700 focus:ring-2 transition-all appearance-none cursor-pointer ${
                        touched.purok && errors.purok
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    >
                      <option value="" disabled>Select purok</option>
                      <option value="Purok 1">Purok 1</option>
                      <option value="Purok 2">Purok 2</option>
                      <option value="Purok 3">Purok 3</option>
                      <option value="Purok 4">Purok 4</option>
                    </select>
                  </div>
                  <FieldError message={touched.purok ? errors.purok : undefined} />
                </div>

                {/* Voter Status */}
                <div className="space-y-1.5">
                  <Label htmlFor="voterStatus" className="text-sm font-medium text-gray-700">
                    Voter Status
                  </Label>
                  <div className="relative">
                    <Vote className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
                    <select
                      id="voterStatus"
                      value={voterStatus}
                      onChange={(e) => setVoterStatus(e.target.value)}
                      onBlur={handleBlur("voterStatus")}
                      className={`w-full h-10 pl-10 pr-3 rounded-lg border bg-white text-sm text-gray-700 focus:ring-2 transition-all appearance-none cursor-pointer ${
                        touched.voterStatus && errors.voterStatus
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    >
                      <option value="" disabled>Select voter status</option>
                      <option value="Registered">Registered</option>
                      <option value="Not Registered">Not Registered</option>
                    </select>
                  </div>
                  <FieldError message={touched.voterStatus ? errors.voterStatus : undefined} />
                </div>

                {/* Household Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="houseHoldNumber" className="text-sm font-medium text-gray-700">
                    Household Number
                  </Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <input
                      id="houseHoldNumber"
                      type="text"
                      placeholder="e.g. HH-001"
                      value={houseHoldNumber}
                      onChange={(e) => setHouseHoldNumber(e.target.value)}
                      onBlur={handleBlur("houseHoldNumber")}
                      className={`w-full h-10 pl-10 pr-3 rounded-lg border bg-white text-sm text-gray-700 focus:ring-2 transition-all ${
                        touched.houseHoldNumber && errors.houseHoldNumber
                          ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                          : "border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                      }`}
                    />
                  </div>
                  <FieldError message={touched.houseHoldNumber ? errors.houseHoldNumber : undefined} />
                </div>
              </div>
            </div>

            {/* ID Upload Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <div className="size-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
                ID Image Upload
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Upload a clear photo of your valid government-issued ID for
                verification.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <UploadBox
                  label="Front of ID"
                  icon={IdCard}
                  file={idFront}
                  preview={idFrontPreview}
                  inputRef={frontRef}
                  onSelect={(f) => handleFileSelect(f, "front", setIdFront, setIdFrontPreview)}
                  onRemove={() => removeImage(setIdFront, setIdFrontPreview, frontRef)}
                  accentColor="border-sky-300 hover:border-sky-400 hover:bg-sky-50/50"
                  verifying={verifyingSide === "front"}
                />
                <UploadBox
                  label="Back of ID"
                  icon={IdCard}
                  file={idBack}
                  preview={idBackPreview}
                  inputRef={backRef}
                  onSelect={(f) => handleFileSelect(f, "back", setIdBack, setIdBackPreview)}
                  onRemove={() => removeImage(setIdBack, setIdBackPreview, backRef)}
                  accentColor="border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50/50"
                  verifying={verifyingSide === "back"}
                />
                <UploadBox
                  label="Selfie with ID"
                  icon={Camera}
                  file={idSelfie}
                  preview={idSelfiePreview}
                  inputRef={selfieRef}
                  onSelect={(f) => handleFileSelect(f, "selfie", setIdSelfie, setIdSelfiePreview)}
                  onRemove={() => removeImage(setIdSelfie, setIdSelfiePreview, selfieRef)}
                  accentColor="border-sky-300 hover:border-sky-400 hover:bg-sky-50/50"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="space-y-4">
              <Button
                type="submit"
                disabled={loading || verifyingSide !== null}
                className="w-full h-11 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium rounded-xl shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all duration-300 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Create Account
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link
                  href="/guest/signIn"
                  className="font-medium text-sky-600 hover:text-sky-700 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          By registering, you agree to the terms and privacy policy of Barangay
          Rabon.
        </p>
      </div>
    </div>
  );
}
