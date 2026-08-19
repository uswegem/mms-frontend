'use client';

import { FormEvent, ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  FileText,
  GraduationCap,
  Loader2,
  Pencil,
  Smartphone,
  Store,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import {
  addBeneficialOwner,
  assignSettlementAccount,
  createOnboardingApplication,
  OnboardingApiError,
  submitOnboarding,
  updateOnboardingApplication,
  uploadOnboardingKycFile,
  verifyBeneficialOwnerNida,
  verifySettlement,
  verifyTin,
  type OnboardingApplication,
  type VerificationAttempt,
} from '@/lib/onboarding-api';
import { createSchoolOnboarding } from '@/lib/schools-api';
import { useTanzaniaLocations } from '@/hooks/use-tanzania-locations';
import { DEFAULT_BANK_SWIFT, formatBankDisplay, formatBankLabel, TANZANIA_BANKS } from '@/lib/tanzania-banks';

const STEP_META = [
  { n: '0', label: 'Entity type' },
  { n: '1', label: 'Details' },
  { n: '2', label: 'NIDA' },
  { n: '3', label: 'TIN / TRA' },
  { n: '4', label: 'Documents' },
  { n: '5', label: 'Settlement' },
  { n: '6', label: 'Review' },
] as const;

const NEXT_STEPS_TIMELINE = [
  'KYC document review by an onboarding checker',
  'Risk & AML screening',
  'Settlement account CBS validation (if not already completed above)',
  'TIPS registration and QR / Lipa Namba issuance',
  'Final activation — confirmation by SMS and email',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human label for a failed/negative verification outcome. */
function resultLabel(result: VerificationAttempt['result']): string {
  switch (result) {
    case 'MISMATCH':
      return 'Name does not match';
    case 'NOT_FOUND':
      return 'Not found';
    case 'PROVIDER_ERROR':
      return 'Registry unreachable — retry shortly';
    default:
      return 'Verified';
  }
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-border-default bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-text-primary">{title}</p>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-[12.5px] text-accent-link hover:text-accent-link-hover"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
      <dl className="grid gap-3 text-[13px] sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11.5px] text-text-muted">{label}</dt>
      <dd className={cn('mt-0.5 text-text-primary', mono ? 'font-mono text-[12.5px]' : 'font-medium')}>{value}</dd>
    </div>
  );
}

function ChecklistRow({ done, title, detail, last }: { done: boolean; title: string; detail: string; last?: boolean }) {
  return (
    <div className={cn('flex items-start gap-3 py-3', !last && 'border-b border-border-row')}>
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white',
          done ? 'bg-success-strong' : 'border border-border-input bg-surface',
        )}
      >
        {done ? '✓' : ''}
      </span>
      <div>
        <p className={cn('text-[13.5px] font-medium', done ? 'text-text-primary' : 'text-text-muted')}>{title}</p>
        <p className="text-[12.5px] text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

/** NIDA/TRA result panel — brief §4.3 verification UX, real API-driven, no fabricated fields. */
function VerificationPanel({ attempt, fields }: { attempt: VerificationAttempt; fields: Array<[string, string]> }) {
  const ok = attempt.result === 'MATCH';
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-[12px] border p-4',
        ok ? 'border-success-border bg-success-bg-soft' : 'border-danger bg-danger-bg',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] text-white',
            ok ? 'bg-success-strong' : 'bg-danger',
          )}
        >
          {ok ? '✓' : '!'}
        </span>
        <span className={cn('text-[13.5px] font-semibold', ok ? 'text-success-text-dark' : 'text-danger-text')}>
          {ok ? 'Verified' : resultLabel(attempt.result)}
        </span>
      </div>
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <p className="text-[11px] uppercase tracking-[.07em] text-text-muted">{label}</p>
              <p className="mt-0.5 text-[13px] text-text-primary">{value}</p>
            </div>
          ))}
        </div>
      )}
      {!ok && attempt.failureReason && <p className="text-[12.5px] text-danger-text">{attempt.failureReason}</p>}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  touched: boolean;
  onTouch?: () => void;
  error: string | null;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  hint?: string;
  mono?: boolean;
  className?: string;
}

function Field({
  label,
  value,
  onChange,
  touched,
  onTouch,
  error,
  type = 'text',
  required,
  readOnly,
  hint,
  mono,
  className,
}: FieldProps) {
  const showError = touched && !!error;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[12.5px] text-text-body">
        {label}
        {required && <span className="ml-0.5 text-required">*</span>}
        {!required && <span className="ml-1 text-text-disabled">optional</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        readOnly={readOnly}
        onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
        onBlur={readOnly ? undefined : onTouch}
        className={cn(
          'rounded-[9px] border px-3 py-[10px] text-[13.5px] text-text-primary outline-none transition-colors',
          mono && 'font-mono',
          readOnly
            ? 'cursor-default border-border-input bg-subtle text-text-muted'
            : showError
              ? 'border-danger bg-surface focus:border-danger'
              : 'border-border-input bg-surface focus:border-accent',
        )}
      />
      {showError && <p className="text-[12px] text-danger-text">{error}</p>}
      {hint && !showError && <p className="text-[12px] text-text-muted">{hint}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[12.5px] text-text-body">
        {label}
        {required && <span className="ml-0.5 text-required">*</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[9px] border border-border-input bg-surface px-3 py-[10px] text-[13.5px] text-text-primary outline-none focus:border-accent"
      >
        {children}
      </select>
    </div>
  );
}

function DocumentRow({
  label,
  hint,
  fieldId,
  file,
  onFile,
  required,
}: {
  label: string;
  hint: string;
  fieldId: string;
  file: File | null;
  onFile: (f: File | null) => void;
  required: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  if (file) {
    return (
      <div className="flex items-center justify-between rounded-[12px] border border-border-default px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-[46px] w-[38px] items-center justify-center rounded-[5px] border border-border-default bg-track">
            <FileText className="h-4 w-4 text-text-muted" />
          </div>
          <div>
            <p className="text-[13.5px] font-medium text-text-primary">{label}</p>
            <p className="font-mono text-[12px] text-text-muted">
              {file.name} · {formatFileSize(file.size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {required && (
            <span className="rounded-[20px] bg-success-bg px-[10px] py-[3px] text-[11.5px] font-medium text-success-text">
              Mandatory
            </span>
          )}
          <button
            type="button"
            onClick={() => onFile(null)}
            className="text-[12.5px] text-accent-link hover:text-accent-link-hover"
          >
            Replace
          </button>
        </div>
      </div>
    );
  }
  return (
    <label
      htmlFor={fieldId}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border border-dashed p-5 text-center transition-colors',
        dragging ? 'border-[#b8b8b2] bg-subtle' : 'border-border-input hover:border-[#b8b8b2] hover:bg-subtle',
      )}
    >
      <UploadCloud className="h-6 w-6 text-text-muted" />
      <p className="text-[13.5px] font-medium text-text-primary">
        {label}
        {required && <span className="ml-0.5 text-required">*</span>}
      </p>
      <p className="text-[12px] text-text-muted">{hint} · PDF, JPG or PNG up to 8 MB</p>
      <input
        id={fieldId}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function EntityTypeCard({
  icon: Icon,
  title,
  description,
  meta,
  selected,
  disabled,
  badge,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  meta: string;
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-[14px] border p-5 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-border-default bg-subtle opacity-60'
          : selected
            ? 'border-2 border-accent bg-surface'
            : 'border-border-default bg-surface hover:border-[#c9c9c3]',
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[16px] font-semibold text-text-primary">
          <Icon className="h-[18px] w-[18px] text-text-muted" />
          {title}
        </span>
        {selected && !disabled && (
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-white">
            ✓
          </span>
        )}
        {badge && (
          <span className="shrink-0 rounded-[20px] bg-warning-bg px-[9px] py-[2px] text-[11px] font-medium text-warning-text-dark">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[13px] leading-[1.5] text-text-body">{description}</p>
      <p className="mt-0.5 font-mono text-[11.5px] text-text-muted">{meta}</p>
    </button>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [onboardingType, setOnboardingType] = useState<'MERCHANT' | 'SCHOOL'>('MERCHANT');
  const [entityType, setEntityType] = useState<'SOLE_PROPRIETOR' | 'COMPANY'>('SOLE_PROPRIETOR');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submittedApp, setSubmittedApp] = useState<OnboardingApplication | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    legalName: '',
    tradingName: '',
    mcc: '5814',
    region: '',
    district: '',
    ward: '',
    city: 'Dar es Salaam',
    postalCode: '',
    vrn: '',
    licenseNumber: '',
    companyRegistrationNo: '',
    contactPhone: '',
    contactEmail: '',
    headName: '',
    ownerFullName: '',
    nidaNumber: '',
    taxId: '',
    accountNumber: '',
    accountName: '',
    bankCode: DEFAULT_BANK_SWIFT,
    kycFile: null as File | null,
    kycLicenseFile: null as File | null,
    kycTinFile: null as File | null,
  });

  // Step 2 — NIDA
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [nidaResult, setNidaResult] = useState<VerificationAttempt | null>(null);
  const [nidaVerifying, setNidaVerifying] = useState(false);
  const [nidaError, setNidaError] = useState<string | null>(null);

  // Step 3 — TIN / TRA
  const [tinResult, setTinResult] = useState<(VerificationAttempt & { tin: string }) | null>(null);
  const [tinVerifying, setTinVerifying] = useState(false);
  const [tinError, setTinError] = useState<string | null>(null);

  // Step 5 — Settlement / CBS
  const [settlementVerified, setSettlementVerified] = useState(false);
  const [settlementVerifying, setSettlementVerifying] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  const { regions, districts, wards, getPostcode } = useTanzaniaLocations(
    form.region || undefined,
    form.district || undefined,
  );

  const token = accessToken!;

  const touch = (name: string) => setTouched((t) => ({ ...t, [name]: true }));

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail);
  const mccValid = /^[0-9]{4}$/.test(form.mcc);
  const postcodeValid = /^[0-9]{5}$/.test(form.postalCode);
  const ninValid = /^[0-9]{20}$/.test(form.nidaNumber.replace(/\s/g, ''));
  const tinFormatValid = /^[0-9]{9}$/.test(form.taxId);
  const needsCompanyDocs = onboardingType === 'SCHOOL' || entityType === 'COMPANY';

  const fieldErrors = {
    legalName: form.legalName.trim() ? null : 'Legal name is required',
    tradingName: form.tradingName.trim() ? null : 'Trading name is required',
    ownerFullName: form.ownerFullName.trim() ? null : 'Owner / authorized signatory name is required',
    mcc: onboardingType === 'MERCHANT' ? (mccValid ? null : 'MCC must be 4 digits') : null,
    companyRegistrationNo:
      onboardingType === 'SCHOOL' && !form.companyRegistrationNo.trim()
        ? 'School registration number is required'
        : null,
    postalCode: postcodeValid ? null : 'Postcode must be 5 digits',
    contactPhone: form.contactPhone.trim() ? null : 'Contact mobile is required',
    contactEmail: emailValid ? null : 'Enter a valid email address',
    accountNumber:
      form.accountNumber.trim().length >= 10 ? null : 'Account number must be at least 10 characters',
    accountName: form.accountName.trim() ? null : 'Account name is required',
  };

  const detailsValid =
    !fieldErrors.legalName &&
    !fieldErrors.tradingName &&
    !fieldErrors.ownerFullName &&
    !fieldErrors.mcc &&
    !fieldErrors.companyRegistrationNo &&
    !fieldErrors.postalCode &&
    !fieldErrors.contactPhone &&
    !fieldErrors.contactEmail;
  const nidaStepValid = nidaResult?.result === 'MATCH';
  const tinStepValid = tinResult?.result === 'MATCH';
  const documentsValid = needsCompanyDocs
    ? !!form.kycFile && !!form.kycLicenseFile && !!form.kycTinFile
    : !!form.kycFile;
  const settlementValid = !fieldErrors.accountNumber && !fieldErrors.accountName;

  async function ensureApplication(): Promise<string> {
    if (applicationId) return applicationId;
    const mcc = onboardingType === 'SCHOOL' ? '8211' : form.mcc;
    const body = {
      legalEntityType: onboardingType === 'SCHOOL' ? 'COMPANY' : entityType,
      legalName: form.legalName,
      tradingName: form.tradingName,
      mcc,
      region: form.region || undefined,
      district: form.district || undefined,
      ward: form.ward || undefined,
      city: form.city,
      postalCode: form.postalCode,
      vrn: form.vrn || undefined,
      licenseNumber: form.licenseNumber || undefined,
      companyRegistrationNo: form.companyRegistrationNo || undefined,
      contactPhone: form.contactPhone,
      contactEmail: form.contactEmail,
      isSchool: onboardingType === 'SCHOOL',
    };

    const app: OnboardingApplication =
      onboardingType === 'SCHOOL'
        ? await createSchoolOnboarding(token, {
            legalName: form.legalName,
            tradingName: form.tradingName,
            city: form.city,
            postalCode: form.postalCode,
            registrationNo: form.companyRegistrationNo || undefined,
            headName: form.headName || undefined,
            contactPhone: form.contactPhone,
            contactEmail: form.contactEmail,
          })
        : await createOnboardingApplication(token, body);

    setApplicationId(app.id);
    return app.id;
  }

  async function handleVerifyNida() {
    setNidaError(null);
    setNidaVerifying(true);
    try {
      const id = await ensureApplication();
      let oid = ownerId;
      if (!oid) {
        const owner = await addBeneficialOwner(token, id, {
          fullName: form.ownerFullName,
          idNumber: form.nidaNumber.replace(/\s/g, ''),
        });
        oid = owner.id;
        setOwnerId(oid);
      }
      const result = await verifyBeneficialOwnerNida(token, id, oid);
      setNidaResult(result);
    } catch (err) {
      if (err instanceof OnboardingApiError && err.result) {
        setNidaResult({
          id: 'attempt',
          result: err.result as VerificationAttempt['result'],
          verifiedName: null,
          failureReason: err.message,
          verifiedAt: new Date().toISOString(),
        });
      } else {
        setNidaError(err instanceof Error ? err.message : 'NIDA verification failed');
      }
    } finally {
      setNidaVerifying(false);
    }
  }

  async function handleVerifyTin() {
    setTinError(null);
    setTinVerifying(true);
    try {
      const id = await ensureApplication();
      await updateOnboardingApplication(token, id, { taxId: form.taxId });
      const result = await verifyTin(token, id);
      setTinResult(result);
    } catch (err) {
      if (err instanceof OnboardingApiError && err.result) {
        setTinResult({
          id: 'attempt',
          tin: form.taxId,
          result: err.result as VerificationAttempt['result'],
          verifiedName: null,
          failureReason: err.message,
          verifiedAt: new Date().toISOString(),
        });
      } else {
        setTinError(err instanceof Error ? err.message : 'TRA verification failed');
      }
    } finally {
      setTinVerifying(false);
    }
  }

  async function handleVerifySettlement() {
    setSettlementError(null);
    setSettlementVerifying(true);
    try {
      const id = await ensureApplication();
      await assignSettlementAccount(token, id, {
        accountNumber: form.accountNumber,
        accountName: form.accountName,
        bankCode: form.bankCode,
      });
      await verifySettlement(token, id);
      setSettlementVerified(true);
    } catch (err) {
      setSettlementVerified(false);
      setSettlementError(err instanceof Error ? err.message : 'CBS verification failed');
    } finally {
      setSettlementVerifying(false);
    }
  }

  async function handleNext(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (step === 1) {
        const id = await ensureApplication();
        await updateOnboardingApplication(token, id, {
          tradingName: form.tradingName,
          mcc: onboardingType === 'SCHOOL' ? '8211' : form.mcc,
          vrn: form.vrn || undefined,
          licenseNumber: form.licenseNumber || undefined,
          companyRegistrationNo: form.companyRegistrationNo || undefined,
          region: form.region || undefined,
          district: form.district || undefined,
          ward: form.ward || undefined,
          city: form.city,
          postalCode: form.postalCode,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
        });
      }
      if (step === 4) {
        if (!form.kycFile) {
          throw new Error('Please upload the ID document to continue');
        }
        if (needsCompanyDocs && (!form.kycLicenseFile || !form.kycTinFile)) {
          throw new Error('Business license and TIN certificate are required');
        }
        const id = await ensureApplication();
        await uploadOnboardingKycFile(token, id, form.kycFile, 'KYC_ID');
        if (needsCompanyDocs && form.kycLicenseFile && form.kycTinFile) {
          await uploadOnboardingKycFile(token, id, form.kycLicenseFile, 'KYC_LICENSE');
          await uploadOnboardingKycFile(token, id, form.kycTinFile, 'KYC_TIN');
        }
      }
      if (step === 5) {
        const id = await ensureApplication();
        await assignSettlementAccount(token, id, {
          accountNumber: form.accountNumber,
          accountName: form.accountName,
          bankCode: form.bankCode,
        });
      }
      if (step === 6) {
        setSubmitting(true);
        const id = await ensureApplication();
        const app = await submitOnboarding(token, id);
        setSubmittedApp(app);
        setSubmitting(false);
        return;
      }
      const next = Math.min(step + 1, STEP_META.length - 1);
      setStep(next);
      setMaxStep((m) => Math.max(m, next));
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Step failed');
    }
  }

  if (submittedApp) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
          <span className="text-[24px] text-success-strong">✓</span>
        </div>
        <div>
          <h2 className="text-[22px] font-semibold text-text-primary">Application submitted</h2>
          <p className="mt-1 text-[13.5px] text-text-muted">
            Application{' '}
            <span className="font-mono font-medium text-text-primary">{submittedApp.applicationNo}</span> has been
            sent for checker review.
          </p>
        </div>
        <div className="rounded-[14px] border border-border-default bg-surface p-5 text-left">
          <p className="mb-3 text-[13px] font-semibold text-text-primary">What happens next</p>
          <ol className="flex flex-col gap-3.5">
            {NEXT_STEPS_TIMELINE.map((item, i) => (
              <li key={item} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-accent text-[11.5px] font-semibold text-text-primary">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-[13px] text-text-body">{item}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex justify-center gap-2.5">
          <button
            onClick={() => router.push('/onboarding')}
            className="rounded-[10px] border border-border-input px-5 py-[11px] text-[13.5px] text-text-body hover:border-[#c9c9c3]"
          >
            Back to list
          </button>
          <button
            onClick={() => router.push(`/onboarding/${submittedApp.id}`)}
            className="rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white hover:bg-button-primary-hover"
          >
            View application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/onboarding">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-border-default bg-surface text-text-body hover:border-[#c9c9c3]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div className="flex flex-col gap-1">
            <p className="eyebrow text-text-muted">Merchant onboarding · Steps 0–6</p>
            <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">{STEP_META[step].label}</h1>
          </div>
        </div>
        <Link
          href="/onboarding"
          className="rounded-[8px] border border-border-default bg-surface px-3 py-[7px] text-[12.5px] text-text-body hover:border-[#c9c9c3]"
        >
          Save &amp; exit
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STEP_META.map((s, i) => {
          const clickable = i <= maxStep;
          const state = i === step ? 'active' : i < step ? 'done' : clickable ? 'visited' : 'upcoming';
          return (
            <button
              key={s.label}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setStep(i)}
              className={cn(
                'flex items-center gap-1.5 rounded-[20px] border px-3 py-[6px] text-[12px] transition-colors',
                state === 'active' && 'border-accent-border bg-accent-bg font-medium text-text-primary',
                state === 'done' && 'border-success-border bg-success-bg-soft text-success-text-dark',
                state === 'visited' && 'border-border-default bg-surface text-text-body hover:border-[#c9c9c3]',
                state === 'upcoming' && 'cursor-not-allowed border-border-default bg-surface text-text-disabled',
              )}
            >
              <span className="font-mono text-[11px] opacity-75">{s.n}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-[10px] border border-danger bg-danger-bg px-4 py-2.5 text-[13px] text-danger-text">
          {error}
        </div>
      )}

      <form onSubmit={handleNext} className="flex flex-col gap-4">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <p className="max-w-[720px] text-[13.5px] text-text-body">
              The entity type chosen here drives the KYC field set and which documents are required at the
              Documents step.
            </p>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <EntityTypeCard
                icon={Store}
                title="Sole Proprietor"
                description="Owner-run shop, kiosk, restaurant or transport operator. Owner NIDA and TIN are verified against national registries."
                meta="ID + registration document"
                selected={onboardingType === 'MERCHANT' && entityType === 'SOLE_PROPRIETOR'}
                onClick={() => {
                  setOnboardingType('MERCHANT');
                  setEntityType('SOLE_PROPRIETOR');
                }}
              />
              <EntityTypeCard
                icon={Building2}
                title="Company"
                description="Registered limited company. Company TIN and at least one director's NIDA are required."
                meta="ID + business license + TIN certificate"
                selected={onboardingType === 'MERCHANT' && entityType === 'COMPANY'}
                onClick={() => {
                  setOnboardingType('MERCHANT');
                  setEntityType('COMPANY');
                }}
              />
              <EntityTypeCard
                icon={GraduationCap}
                title="School / Institution"
                description="Company-type KYC for the institution; a bulk student roster issues one Lipa Namba per student after activation."
                meta="Company document set"
                selected={onboardingType === 'SCHOOL'}
                onClick={() => setOnboardingType('SCHOOL')}
              />
              <EntityTypeCard
                icon={Smartphone}
                title="Online-only Seller"
                description="Instagram, WhatsApp or TikTok seller without formal registration. Relaxed KYC with a transaction-value cap."
                meta="Relaxed KYC · capped limits"
                badge="Needs BOT sign-off"
                selected={false}
                disabled
                onClick={() => {}}
              />
            </div>
            <button
              type="submit"
              className="self-start rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white hover:bg-button-primary-hover"
            >
              Continue to details
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="flex flex-col gap-5 rounded-[14px] border border-border-default bg-surface p-[22px]">
              <div>
                <p className="mb-3 text-[13px] font-semibold text-text-primary">Business identity</p>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field
                    className="sm:col-span-2"
                    label="Legal name"
                    required
                    value={form.legalName}
                    onChange={(v) => setForm({ ...form, legalName: v })}
                    touched={!!touched.legalName}
                    onTouch={() => touch('legalName')}
                    error={fieldErrors.legalName}
                  />
                  <Field
                    className="sm:col-span-2"
                    label="Trading / display name"
                    required
                    value={form.tradingName}
                    onChange={(v) => setForm({ ...form, tradingName: v })}
                    touched={!!touched.tradingName}
                    onTouch={() => touch('tradingName')}
                    error={fieldErrors.tradingName}
                  />
                  <Field
                    className="sm:col-span-2"
                    label="Owner or authorized signatory — full name"
                    required
                    hint="Used for the National ID (NIDA) verification in the next step."
                    value={form.ownerFullName}
                    onChange={(v) => {
                      setForm({ ...form, ownerFullName: v });
                      if (ownerId) {
                        setOwnerId(null);
                        setNidaResult(null);
                      }
                    }}
                    touched={!!touched.ownerFullName}
                    onTouch={() => touch('ownerFullName')}
                    error={fieldErrors.ownerFullName}
                  />
                  {onboardingType === 'MERCHANT' && (
                    <Field
                      label="MCC"
                      required
                      mono
                      value={form.mcc}
                      onChange={(v) => setForm({ ...form, mcc: v })}
                      touched={!!touched.mcc}
                      onTouch={() => touch('mcc')}
                      error={fieldErrors.mcc}
                    />
                  )}
                  <Field
                    label="VRN"
                    value={form.vrn}
                    onChange={(v) => setForm({ ...form, vrn: v })}
                    touched={false}
                    error={null}
                  />
                  <Field
                    label={onboardingType === 'SCHOOL' ? 'School registration no' : 'Business registration no'}
                    required={onboardingType === 'SCHOOL'}
                    value={form.companyRegistrationNo}
                    onChange={(v) => setForm({ ...form, companyRegistrationNo: v })}
                    touched={!!touched.companyRegistrationNo}
                    onTouch={() => touch('companyRegistrationNo')}
                    error={fieldErrors.companyRegistrationNo}
                  />
                  {onboardingType === 'SCHOOL' && (
                    <Field
                      label="Principal / head name"
                      value={form.headName}
                      onChange={(v) => setForm({ ...form, headName: v })}
                      touched={false}
                      error={null}
                    />
                  )}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[13px] font-semibold text-text-primary">Location</p>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <SelectField
                    label="Region"
                    value={form.region}
                    onChange={(v) => setForm({ ...form, region: v, district: '', ward: '' })}
                  >
                    <option value="">Select region</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="District"
                    value={form.district}
                    onChange={(v) => setForm({ ...form, district: v, ward: '' })}
                  >
                    <option value="">Select district</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Ward"
                    value={form.ward}
                    onChange={(v) => {
                      const postcode = v ? (getPostcode(v) ?? '') : '';
                      setForm({ ...form, ward: v, postalCode: postcode });
                      touch('postalCode');
                    }}
                  >
                    <option value="">Select ward</option>
                    {wards.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </SelectField>
                  <Field
                    label="Postcode"
                    required
                    readOnly
                    mono
                    value={form.postalCode}
                    touched={!!touched.postalCode}
                    error={fieldErrors.postalCode}
                    hint="Auto-populated when you select a ward"
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-[13px] font-semibold text-text-primary">Contact details</p>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field
                    label="Contact mobile"
                    required
                    value={form.contactPhone}
                    onChange={(v) => setForm({ ...form, contactPhone: v })}
                    touched={!!touched.contactPhone}
                    onTouch={() => touch('contactPhone')}
                    error={fieldErrors.contactPhone}
                  />
                  <Field
                    label="Contact email"
                    required
                    type="email"
                    value={form.contactEmail}
                    onChange={(v) => setForm({ ...form, contactEmail: v })}
                    touched={!!touched.contactEmail}
                    onTouch={() => touch('contactEmail')}
                    error={fieldErrors.contactEmail}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!detailsValid}
                className="self-start rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to NIDA verification
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="rounded-[14px] border border-border-default bg-surface p-5">
                <p className="mb-2 text-[13px] font-semibold text-text-primary">Phone verification</p>
                <p className="text-[12.5px] leading-[1.5] text-text-muted">
                  OTP verification of the contact mobile is not yet wired to an SMS gateway — the number above is
                  used for onboarding status notifications, but is not enforced as a hard gate in this build.
                </p>
              </div>
              <div className="rounded-[14px] border border-border-default bg-surface p-5">
                <p className="mb-2 text-[13px] font-semibold text-text-primary">Assisted onboarding</p>
                <p className="text-[12.5px] leading-[1.5] text-text-muted">
                  A field agent or branch officer can complete this form on the merchant&apos;s behalf, using the
                  same wizard.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="flex flex-col gap-4 rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="text-[15px] font-semibold text-text-primary">National ID verification</p>
              <Field
                className="max-w-[420px]"
                label="NIDA number (NIN) — owner"
                required
                mono
                hint="20-digit National ID Number, no spaces."
                value={form.nidaNumber}
                onChange={(v) => {
                  setForm({ ...form, nidaNumber: v });
                  if (ownerId) {
                    setOwnerId(null);
                    setNidaResult(null);
                  }
                }}
                touched={!!touched.nidaNumber}
                onTouch={() => touch('nidaNumber')}
                error={ninValid ? null : 'NIN must be exactly 20 digits'}
              />

              {nidaResult && (
                <VerificationPanel
                  attempt={nidaResult}
                  fields={
                    nidaResult.result === 'MATCH'
                      ? [
                          ['Returned name', nidaResult.verifiedName ?? form.ownerFullName],
                          ['Status', 'Active'],
                        ]
                      : []
                  }
                />
              )}
              {nidaError && <p className="text-[12.5px] text-danger-text">{nidaError}</p>}

              {onboardingType === 'MERCHANT' && entityType === 'COMPANY' && (
                <div className="flex items-center justify-between rounded-[12px] border border-dashed border-border-input p-4">
                  <div>
                    <p className="text-[13px] font-medium text-text-primary">Company path — director list</p>
                    <p className="text-[12.5px] text-text-muted">
                      One director&apos;s NIDA is mandatory. Capturing every director is a proposed enhancement,
                      pending Compliance sign-off.
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-text-disabled">1 of N captured</span>
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={!form.ownerFullName.trim() || !ninValid || nidaVerifying}
                  onClick={() => void handleVerifyNida()}
                  className="flex items-center gap-2 rounded-[10px] border border-[#131416] px-4 py-[10px] text-[13px] text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {nidaVerifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {nidaResult && nidaResult.result !== 'MATCH' ? 'Retry with NIDA' : 'Verify with NIDA'}
                </button>
                <button
                  type="submit"
                  disabled={!nidaStepValid}
                  className="rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue to TIN
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-[14px] border border-border-default bg-surface p-5">
              <p className="text-[13px] font-semibold text-text-primary">Verification trail</p>
              <div className="flex flex-col gap-2.5">
                <TrailRow label="Owner details captured" done at="Step 1" />
                <TrailRow label="NIDA lookup" done={nidaStepValid} pending={!nidaResult} at={nidaStepValid ? 'match' : nidaResult ? 'no match' : 'pending'} />
                <TrailRow label="TRA TIN lookup" done={false} pending at="pending" />
                <TrailRow label="CBS account validation" done={false} pending at="pending" />
              </div>
              <p className="border-t border-border-hairline pt-3 text-[12px] leading-[1.5] text-text-muted">
                Every verification result is stored against the application and shown to the checker at review.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="flex flex-col gap-4 rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="text-[15px] font-semibold text-text-primary">TIN verification against TRA</p>
              <div className="flex flex-wrap items-end gap-3">
                <Field
                  className="w-[220px]"
                  label="TIN number"
                  required
                  mono
                  hint="9 digits."
                  value={form.taxId}
                  onChange={(v) => {
                    setForm({ ...form, taxId: v });
                    if (tinResult) setTinResult(null);
                  }}
                  touched={!!touched.taxId}
                  onTouch={() => touch('taxId')}
                  error={tinFormatValid ? null : 'TIN must be exactly 9 digits'}
                />
                <button
                  type="button"
                  disabled={!tinFormatValid || tinVerifying}
                  onClick={() => void handleVerifyTin()}
                  className="flex items-center gap-2 rounded-[9px] border border-[#131416] px-4 py-[10px] text-[13px] text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tinVerifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {tinResult && tinResult.result !== 'MATCH' ? 'Retry with TRA' : 'Verify with TRA'}
                </button>
              </div>

              {tinResult && (
                <VerificationPanel
                  attempt={tinResult}
                  fields={
                    tinResult.result === 'MATCH'
                      ? [
                          ['Registered name', tinResult.verifiedName ?? form.legalName],
                          ['Taxpayer status', 'Active'],
                        ]
                      : []
                  }
                />
              )}
              {tinError && <p className="text-[12.5px] text-danger-text">{tinError}</p>}

              <button
                type="submit"
                disabled={!tinStepValid}
                className="self-start rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to documents
              </button>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-border-default bg-surface p-5">
              <p className="text-[13px] font-semibold text-text-primary">If TRA returns no match</p>
              <p className="text-[12.5px] leading-[1.55] text-text-body">
                The application is blocked from reaching document upload. Correct the TIN and retry — there is no
                manual override available to the applicant.
              </p>
              <p className="border-t border-border-hairline pt-3 text-[12px] leading-[1.5] text-text-muted">
                Periodic re-verification can be run on demand against any live merchant from the back-office
                console.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="flex flex-col gap-4 rounded-[14px] border border-border-default bg-surface p-[22px]">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-text-primary">Supporting documents</p>
                <p className="text-[12.5px] text-text-muted">
                  {[form.kycFile, ...(needsCompanyDocs ? [form.kycLicenseFile, form.kycTinFile] : [])].filter(
                    Boolean,
                  ).length}{' '}
                  of {needsCompanyDocs ? 3 : 1} required captured
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <DocumentRow
                  label="ID document"
                  hint="National ID or passport"
                  fieldId="kyc-id-file"
                  file={form.kycFile}
                  onFile={(f) => setForm({ ...form, kycFile: f })}
                  required
                />
                {needsCompanyDocs && (
                  <>
                    <DocumentRow
                      label="Business license"
                      hint="BRELA certificate or equivalent"
                      fieldId="kyc-license-file"
                      file={form.kycLicenseFile}
                      onFile={(f) => setForm({ ...form, kycLicenseFile: f })}
                      required
                    />
                    <DocumentRow
                      label="TIN certificate"
                      hint="Tax Identification Number certificate"
                      fieldId="kyc-tin-file"
                      file={form.kycTinFile}
                      onFile={(f) => setForm({ ...form, kycTinFile: f })}
                      required
                    />
                  </>
                )}
              </div>
              <button
                type="submit"
                disabled={!documentsValid}
                className="self-start rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to settlement account
              </button>
            </div>
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-2.5 rounded-[14px] border border-border-default bg-surface p-5">
                <p className="text-[13px] font-semibold text-text-primary">Required by entity type</p>
                <div className="flex flex-col gap-2 text-[12.5px] text-text-body">
                  <div className="flex justify-between">
                    <span>Sole Proprietor</span>
                    <span className="text-text-muted">NIDA · TIN · registration</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Company</span>
                    <span className="text-text-muted">+ license · TIN certificate</span>
                  </div>
                  <div className="flex justify-between">
                    <span>School</span>
                    <span className="text-text-muted">Company set + signatories</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-[14px] border border-border-default bg-surface p-5">
                <p className="text-[13px] font-semibold text-text-primary">Beyond the BRS baseline</p>
                <p className="text-[12.5px] leading-[1.55] text-text-muted">
                  Memorandum &amp; Articles for companies, NIDA for every director, and a passport photo of
                  signatories are proposed enhancements, not BRS-mandated.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="flex flex-col gap-4 rounded-[14px] border border-border-default bg-surface p-[22px]">
              <p className="text-[15px] font-semibold text-text-primary">Settlement account</p>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <SelectField
                  label="Bank"
                  required
                  value={form.bankCode}
                  onChange={(v) => {
                    setForm({ ...form, bankCode: v });
                    setSettlementVerified(false);
                  }}
                >
                  {TANZANIA_BANKS.map((bank) => (
                    <option key={bank.swiftCode} value={bank.swiftCode}>
                      {formatBankLabel(bank)}
                    </option>
                  ))}
                </SelectField>
                <Field
                  label="Account number"
                  required
                  mono
                  value={form.accountNumber}
                  onChange={(v) => {
                    setForm({ ...form, accountNumber: v });
                    setSettlementVerified(false);
                  }}
                  touched={!!touched.accountNumber}
                  onTouch={() => touch('accountNumber')}
                  error={fieldErrors.accountNumber}
                />
                <Field
                  className="sm:col-span-2"
                  label="Account name"
                  required
                  value={form.accountName}
                  onChange={(v) => {
                    setForm({ ...form, accountName: v });
                    setSettlementVerified(false);
                  }}
                  touched={!!touched.accountName}
                  onTouch={() => touch('accountName')}
                  error={fieldErrors.accountName}
                />
              </div>

              {settlementVerified ? (
                <VerificationPanel
                  attempt={{
                    id: 'settlement',
                    result: 'MATCH',
                    verifiedName: form.accountName,
                    failureReason: null,
                    verifiedAt: new Date().toISOString(),
                  }}
                  fields={[
                    ['Account name', form.accountName],
                    ['Account number', form.accountNumber],
                    ['Bank', formatBankDisplay(form.bankCode)],
                  ]}
                />
              ) : settlementError ? (
                <div className="rounded-[10px] border border-danger bg-danger-bg px-4 py-2.5 text-[13px] text-danger-text">
                  {settlementError}
                </div>
              ) : (
                <div className="rounded-[10px] border border-warning-border bg-warning-bg px-4 py-2.5 text-[13px] text-warning-text-dark">
                  Not yet verified with CBS — you can continue, and an onboarding checker can re-run this before
                  approval.
                </div>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={!settlementValid || settlementVerifying}
                  onClick={() => void handleVerifySettlement()}
                  className="flex items-center gap-2 rounded-[10px] border border-[#131416] px-4 py-[10px] text-[13px] text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {settlementVerifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save &amp; verify with CBS
                </button>
                <button
                  type="submit"
                  disabled={!settlementValid}
                  className="rounded-[10px] bg-button-primary px-5 py-[11px] text-[13.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue to business profile
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-border-default bg-surface p-5">
              <p className="text-[13px] font-semibold text-text-primary">Two distinct CBS functions</p>
              <p className="text-[12.5px] leading-[1.55] text-text-body">
                First, account validation: number, ownership name-match and status confirmed before the account can
                be linked. Second, transaction posting: settled TIPS/TanQR transactions post to the correct CBS
                ledger accounts as part of the settlement cycle.
              </p>
              <p className="border-t border-border-hairline pt-3 text-[12px] leading-[1.5] text-text-muted">
                Any later change of settlement account re-runs this validation and requires maker-checker approval.
              </p>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div className="flex flex-col gap-4">
              <div className="rounded-[14px] border border-border-default bg-surface p-5">
                <p className="mb-1 text-[13px] font-semibold text-text-primary">Verification summary</p>
                <div className="flex flex-col">
                  <ChecklistRow
                    done={nidaStepValid}
                    title="Owner NIDA verified"
                    detail={nidaResult?.verifiedName ? `Matched · ${nidaResult.verifiedName}` : 'Matched against NIDA'}
                  />
                  <ChecklistRow
                    done={tinStepValid}
                    title="TIN verified against TRA"
                    detail={tinResult?.verifiedName ? `Matched · ${tinResult.verifiedName}` : 'Matched against TRA'}
                  />
                  <ChecklistRow
                    done={documentsValid}
                    title="KYC documents captured"
                    detail={documentsValid ? 'All required documents uploaded' : 'Incomplete'}
                  />
                  <ChecklistRow
                    done={settlementVerified}
                    title="Settlement account"
                    detail={settlementVerified ? 'CBS-validated' : 'Assigned · not yet CBS-validated'}
                    last
                  />
                </div>
              </div>
              <ReviewSection title="Business & owner details" onEdit={() => setStep(1)}>
                <ReviewRow
                  label="Type"
                  value={
                    onboardingType === 'SCHOOL'
                      ? 'School / Institution'
                      : entityType === 'COMPANY'
                        ? 'Company'
                        : 'Sole Proprietor'
                  }
                />
                <ReviewRow label="Legal name" value={form.legalName} />
                <ReviewRow label="Trading name" value={form.tradingName} />
                <ReviewRow label="Owner / signatory" value={form.ownerFullName} />
                <ReviewRow label="TIN" value={form.taxId || '—'} mono />
              </ReviewSection>
              <ReviewSection title="Settlement" onEdit={() => setStep(5)}>
                <ReviewRow label="Bank" value={formatBankDisplay(form.bankCode)} />
                <ReviewRow label="Account number" value={form.accountNumber} mono />
              </ReviewSection>
              <ReviewSection title="KYC documents" onEdit={() => setStep(4)}>
                <ReviewRow label="ID document" value={form.kycFile?.name ?? '—'} />
                {needsCompanyDocs && (
                  <>
                    <ReviewRow label="Business license" value={form.kycLicenseFile?.name ?? '—'} />
                    <ReviewRow label="TIN certificate" value={form.kycTinFile?.name ?? '—'} />
                  </>
                )}
              </ReviewSection>
            </div>
            <div className="flex flex-col gap-3.5">
              <div className="rounded-[14px] border border-border-default bg-surface p-5">
                <p className="mb-2 text-[13px] font-semibold text-text-primary">What happens after submit</p>
                <p className="text-[12.5px] leading-[1.5] text-text-muted">
                  You can close the browser once submitted. Approval or rejection arrives by SMS and email, and the
                  application reopens at the exact step a rejection reason points to.
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-[10px] bg-button-primary px-5 py-[13px] text-[13.5px] font-medium text-white hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit application for review'}
              </button>
            </div>
          </div>
        )}

        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex w-fit items-center gap-1.5 rounded-[10px] border border-border-input px-4 py-[10px] text-[13px] text-text-body hover:border-[#c9c9c3]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}
      </form>
    </div>
  );
}

function TrailRow({
  label,
  done,
  pending,
  at,
}: {
  label: string;
  done?: boolean;
  pending?: boolean;
  at: string;
}) {
  return (
    <div className="flex gap-2.5">
      <span
        className={cn(
          'mt-[5px] h-2 w-2 shrink-0 rounded-full',
          done ? 'bg-success-strong' : pending ? 'bg-track' : 'bg-danger',
        )}
      />
      <div>
        <p className={cn('text-[12.5px]', done ? 'text-text-primary' : 'text-text-disabled')}>{label}</p>
        <p className="font-mono text-[11.5px] text-text-muted">{at}</p>
      </div>
    </div>
  );
}
