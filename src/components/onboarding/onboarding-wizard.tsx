'use client';

import { FormEvent, ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Landmark,
  Pencil,
  Save,
  ShieldCheck,
  Store,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  assignSettlementAccount,
  createOnboardingApplication,
  submitOnboarding,
  updateOnboardingApplication,
  uploadOnboardingKycFile,
  type OnboardingApplication,
} from '@/lib/onboarding-api';
import { createSchoolOnboarding } from '@/lib/schools-api';
import { useTanzaniaLocations } from '@/hooks/use-tanzania-locations';
import { BankSelectField } from '@/components/onboarding/bank-select-field';
import { DEFAULT_BANK_SWIFT, formatBankDisplay } from '@/lib/tanzania-banks';
import { StepProgress, type StepProgressItem } from '@/components/onboarding/step-progress';

const WIZARD_STEPS = ['Type', 'Profile', 'Settlement', 'KYC', 'Review'] as const;
const STEP_ICONS = [Building2, FileText, Landmark, ShieldCheck, ClipboardCheck];

const NEXT_STEPS_TIMELINE = [
  'KYC document review by an onboarding checker',
  'Risk & AML screening',
  'Bank settlement account validation',
  'TIPS registration and QR / Lipa Namba issuance',
  'Final activation',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
          <Pencil className="mr-1 h-3 w-3" /> Edit
        </Button>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono' : 'font-medium'}>{value}</dd>
    </div>
  );
}

interface ValidatedFieldProps {
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
  pattern?: string;
  minLength?: number;
  className?: string;
}

function ValidatedField({
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
  pattern,
  minLength,
  className,
}: ValidatedFieldProps) {
  const showError = touched && !!error;
  const showValid = touched && !error && value.trim() !== '';
  return (
    <div className={className}>
      <Label>
        {label}
        {required && ' *'}
      </Label>
      <div className="relative">
        <Input
          type={type}
          required={required}
          pattern={pattern}
          minLength={minLength}
          value={value}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
          onBlur={readOnly ? undefined : onTouch}
          className={cn(
            'pr-9',
            readOnly && 'cursor-default bg-muted text-muted-foreground select-none',
            showError && 'border-[var(--destructive)] focus-visible:ring-[var(--destructive)]',
            showValid && !readOnly && 'border-[var(--success)] focus-visible:ring-[var(--success)]',
          )}
        />
        {showValid && !readOnly && (
          <CheckCircle2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--success)]" />
        )}
      </div>
      {showError && <p className="mt-1 text-xs text-[var(--destructive)]">{error}</p>}
      {hint && !showError && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function KycUploadField({
  label,
  hint,
  fieldId,
  file,
  onFile,
  dragging,
  setDragging,
}: {
  label: string;
  hint: string;
  fieldId: string;
  file: File | null;
  onFile: (f: File | null) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {file ? (
        <div className="flex items-center justify-between rounded-md border border-[var(--success-border)] bg-[var(--success-muted)] px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-[var(--success)]" />
            <span className="font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
            <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-11" onClick={() => onFile(null)}>
            Remove
          </Button>
        </div>
      ) : (
        <label
          htmlFor={fieldId}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={cn(
            'dropzone flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-6 text-center',
            dragging && 'is-dragging',
          )}
        >
          <UploadCloud className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-medium">Click to upload or drag and drop</p>
          <p className="text-xs text-muted-foreground">{hint} · PDF, JPG or PNG</p>
          <input
            id={fieldId}
            type="file"
            accept=".pdf,.jpg,.png"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [onboardingType, setOnboardingType] = useState<'MERCHANT' | 'SCHOOL'>('MERCHANT');
  const [entityType, setEntityType] = useState<'SOLE_PROPRIETOR' | 'COMPANY'>('SOLE_PROPRIETOR');
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submittedApp, setSubmittedApp] = useState<OnboardingApplication | null>(null);
  const [form, setForm] = useState({
    legalName: '',
    tradingName: '',
    mcc: '5814',
    region: '',
    district: '',
    ward: '',
    city: 'Dar es Salaam',
    postalCode: '',
    taxId: '',
    vrn: '',
    licenseNumber: '',
    companyRegistrationNo: '',
    contactPhone: '',
    contactEmail: '',
    headName: '',
    accountNumber: '',
    accountName: '',
    bankCode: DEFAULT_BANK_SWIFT,
    kycFile: null as File | null,
    kycLicenseFile: null as File | null,
    kycTinFile: null as File | null,
  });

  const { regions, districts, wards, getPostcode } = useTanzaniaLocations(
    form.region || undefined,
    form.district || undefined,
  );

  const token = accessToken!;

  const touch = (name: string) => setTouched((t) => ({ ...t, [name]: true }));

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail);
  const mccValid = /^[0-9]{4}$/.test(form.mcc);
  const postcodeValid = /^[0-9]{5}$/.test(form.postalCode);

  const fieldErrors = {
    legalName: form.legalName.trim() ? null : 'Legal name is required',
    tradingName: form.tradingName.trim() ? null : 'Trading name is required',
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

  const step1Valid =
    !fieldErrors.legalName &&
    !fieldErrors.tradingName &&
    !fieldErrors.mcc &&
    !fieldErrors.companyRegistrationNo &&
    !fieldErrors.postalCode &&
    !fieldErrors.contactPhone &&
    !fieldErrors.contactEmail;
  const step2Valid = !fieldErrors.accountNumber && !fieldErrors.accountName;
  const needsCompanyDocs = onboardingType === 'SCHOOL' || entityType === 'COMPANY';
  const step3Valid = needsCompanyDocs
    ? !!form.kycFile && !!form.kycLicenseFile && !!form.kycTinFile
    : !!form.kycFile;
  const currentStepValid =
    step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : true;

  const stepItems: StepProgressItem[] = WIZARD_STEPS.map((label, i) => {
    const Icon = STEP_ICONS[i];
    return {
      key: label,
      label,
      icon: <Icon className="h-4 w-4" />,
      state: i < step ? 'done' : i === step ? 'active' : 'upcoming',
    };
  });

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
      taxId: form.taxId || undefined,
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
            taxId: form.taxId || undefined,
            registrationNo: form.companyRegistrationNo || undefined,
            headName: form.headName || undefined,
            contactPhone: form.contactPhone,
            contactEmail: form.contactEmail,
          })
        : await createOnboardingApplication(token, body);

    setApplicationId(app.id);
    return app.id;
  }

  async function saveDraft() {
    setError(null);
    try {
      const id = await ensureApplication();
      await updateOnboardingApplication(token, id, {
        tradingName: form.tradingName,
        mcc: form.mcc,
        taxId: form.taxId || undefined,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
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
          taxId: form.taxId || undefined,
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
      if (step === 2) {
        const id = await ensureApplication();
        await assignSettlementAccount(token, id, {
          accountNumber: form.accountNumber,
          accountName: form.accountName,
          bankCode: form.bankCode,
        });
      }
      if (step === 3) {
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
      if (step === 4) {
        const id = await ensureApplication();
        const app = await submitOnboarding(token, id);
        setSubmittedApp(app);
        return;
      }
      setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Step failed');
    }
  }

  if (submittedApp) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-muted)]">
          <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Application Submitted</h2>
          <p className="mt-1 text-muted-foreground">
            Application{' '}
            <span className="font-mono font-medium text-foreground">{submittedApp.applicationNo}</span>{' '}
            has been sent for checker review.
          </p>
        </div>
        <Card className="text-left shadow-[var(--shadow-sm)]">
          <CardHeader>
            <CardTitle className="text-sm">What happens next</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {NEXT_STEPS_TIMELINE.map((item, i) => (
                <li key={item} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand-yellow)] text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-sm">{item}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <div className="flex justify-center gap-3">
          <Button variant="outline" className="h-11" onClick={() => router.push('/onboarding')}>
            Back to List
          </Button>
          <Button className="h-11" onClick={() => router.push(`/onboarding/${submittedApp.id}`)}>
            View Application
          </Button>
          <Button variant="outline" className="h-11" onClick={() => router.push('/merchants')}>
            Finish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/onboarding">
          <Button variant="ghost" size="icon" className="h-11 w-11"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <PageHeader title="New Onboarding" description={`Step ${step + 1} of ${WIZARD_STEPS.length}: ${WIZARD_STEPS[step]}`} />
      </div>

      <StepProgress steps={stepItems} />

      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleNext}>
        <Card className="shadow-[var(--shadow-md)]">
          <CardHeader>
            <CardTitle>{WIZARD_STEPS[step]}</CardTitle>
            <CardDescription>
              {step === 0 && 'Choose whether you are onboarding a merchant or a school.'}
              {step === 1 && 'Enter legal business details and Tanzania location.'}
              {step === 2 && 'Assign the CBS settlement account for fee credits.'}
              {step === 3 && 'Upload required KYC documents before submission.'}
              {step === 4 && 'Review and submit for checker approval.'}
            </CardDescription>
          </CardHeader>
          <CardContent key={step} className="wizard-step-enter space-y-4">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  className={cn(
                    'group relative flex flex-col items-start gap-3 rounded-lg border-2 p-5 text-left shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]',
                    onboardingType === 'MERCHANT'
                      ? 'border-[var(--brand-yellow)] bg-[var(--accent-muted)]'
                      : 'border-border bg-card hover:border-[var(--brand-yellow)]',
                  )}
                  onClick={() => setOnboardingType('MERCHANT')}
                >
                  {onboardingType === 'MERCHANT' && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-yellow)] text-[var(--brand-black)]">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-yellow)] text-[var(--brand-black)]">
                    <Store className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">Merchant</p>
                    <p className="text-sm text-muted-foreground">Retail / business Lipa Namba onboarding</p>
                  </div>
                </button>
                <button
                  type="button"
                  className={cn(
                    'group relative flex flex-col items-start gap-3 rounded-lg border-2 p-5 text-left shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]',
                    onboardingType === 'SCHOOL'
                      ? 'border-[var(--brand-yellow)] bg-[var(--accent-muted)]'
                      : 'border-border bg-card hover:border-[var(--brand-yellow)]',
                  )}
                  onClick={() => setOnboardingType('SCHOOL')}
                >
                  {onboardingType === 'SCHOOL' && (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-yellow)] text-[var(--brand-black)]">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-yellow)] text-[var(--brand-black)]">
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">School</p>
                    <p className="text-sm text-muted-foreground">School fee collection via TANQR</p>
                  </div>
                </button>
                {onboardingType === 'MERCHANT' && (
                  <div className="sm:col-span-2">
                    <Label>Business Type</Label>
                    <Select value={entityType} onChange={(e) => setEntityType(e.target.value as typeof entityType)}>
                      <option value="SOLE_PROPRIETOR">Sole Proprietor</option>
                      <option value="COMPANY">Company</option>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business Identity</h3>
                  <Separator className="mb-3 mt-1.5" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ValidatedField
                      className="sm:col-span-2"
                      label="Legal Name"
                      required
                      value={form.legalName}
                      onChange={(v) => setForm({ ...form, legalName: v })}
                      touched={!!touched.legalName}
                      onTouch={() => touch('legalName')}
                      error={fieldErrors.legalName}
                    />
                    <ValidatedField
                      className="sm:col-span-2"
                      label="Trading / Display Name"
                      required
                      value={form.tradingName}
                      onChange={(v) => setForm({ ...form, tradingName: v })}
                      touched={!!touched.tradingName}
                      onTouch={() => touch('tradingName')}
                      error={fieldErrors.tradingName}
                    />
                    {onboardingType === 'MERCHANT' && (
                      <ValidatedField
                        label="MCC"
                        required
                        pattern="[0-9]{4}"
                        value={form.mcc}
                        onChange={(v) => setForm({ ...form, mcc: v })}
                        touched={!!touched.mcc}
                        onTouch={() => touch('mcc')}
                        error={fieldErrors.mcc}
                      />
                    )}
                    <div>
                      <Label>TIN</Label>
                      <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                    </div>
                    <div>
                      <Label>VRN</Label>
                      <Input value={form.vrn} onChange={(e) => setForm({ ...form, vrn: e.target.value })} />
                    </div>
                    <ValidatedField
                      label={onboardingType === 'SCHOOL' ? 'School Registration No' : 'Business Registration No'}
                      required={onboardingType === 'SCHOOL'}
                      value={form.companyRegistrationNo}
                      onChange={(v) => setForm({ ...form, companyRegistrationNo: v })}
                      touched={!!touched.companyRegistrationNo}
                      onTouch={() => touch('companyRegistrationNo')}
                      error={fieldErrors.companyRegistrationNo}
                    />
                    {onboardingType === 'SCHOOL' && (
                      <div>
                        <Label>Principal / Head Name</Label>
                        <Input value={form.headName} onChange={(e) => setForm({ ...form, headName: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</h3>
                  <Separator className="mb-3 mt-1.5" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Region</Label>
                      <Select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value, district: '', ward: '' })}>
                        <option value="">Select region</option>
                        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>District</Label>
                      <Select value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value, ward: '' })}>
                        <option value="">Select district</option>
                        {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>Ward</Label>
                      <Select value={form.ward} onChange={(e) => {
                        const ward = e.target.value;
                        const postcode = ward ? (getPostcode(ward) ?? '') : '';
                        setForm({ ...form, ward, postalCode: postcode });
                        touch('postalCode');
                      }}>
                        <option value="">Select ward</option>
                        {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                      </Select>
                    </div>
                    <ValidatedField
                      label="Postcode"
                      required
                      readOnly
                      value={form.postalCode}
                      touched={!!touched.postalCode}
                      error={fieldErrors.postalCode}
                      hint="Auto-populated when you select a ward"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Details</h3>
                  <Separator className="mb-3 mt-1.5" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ValidatedField
                      label="Contact Mobile"
                      required
                      value={form.contactPhone}
                      onChange={(v) => setForm({ ...form, contactPhone: v })}
                      touched={!!touched.contactPhone}
                      onTouch={() => touch('contactPhone')}
                      error={fieldErrors.contactPhone}
                    />
                    <ValidatedField
                      label="Contact Email"
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
              </div>
            )}

            {step === 2 && (
              <div className="grid max-w-md gap-3">
                <ValidatedField
                  label="Account Number"
                  required
                  minLength={10}
                  value={form.accountNumber}
                  onChange={(v) => setForm({ ...form, accountNumber: v })}
                  touched={!!touched.accountNumber}
                  onTouch={() => touch('accountNumber')}
                  error={fieldErrors.accountNumber}
                />
                <ValidatedField
                  label="Account Name"
                  required
                  value={form.accountName}
                  onChange={(v) => setForm({ ...form, accountName: v })}
                  touched={!!touched.accountName}
                  onTouch={() => touch('accountName')}
                  error={fieldErrors.accountName}
                />
                <BankSelectField
                  value={form.bankCode}
                  onChange={(swiftCode) => setForm({ ...form, bankCode: swiftCode })}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <KycUploadField
                  label="ID Document *"
                  hint="National ID or passport"
                  fieldId="kyc-id-file"
                  file={form.kycFile}
                  onFile={(f) => setForm({ ...form, kycFile: f })}
                  dragging={dragging}
                  setDragging={setDragging}
                />
                {needsCompanyDocs && (
                  <>
                    <KycUploadField
                      label="Business License *"
                      hint="BRELA certificate or equivalent"
                      fieldId="kyc-license-file"
                      file={form.kycLicenseFile}
                      onFile={(f) => setForm({ ...form, kycLicenseFile: f })}
                      dragging={false}
                      setDragging={() => {}}
                    />
                    <KycUploadField
                      label="TIN Certificate *"
                      hint="Tax Identification Number certificate"
                      fieldId="kyc-tin-file"
                      file={form.kycTinFile}
                      onFile={(f) => setForm({ ...form, kycTinFile: f })}
                      dragging={false}
                      setDragging={() => {}}
                    />
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <ReviewSection title="Business Identity" onEdit={() => setStep(1)}>
                  <ReviewRow label="Type" value={onboardingType} />
                  <ReviewRow label="Legal Name" value={form.legalName} />
                  <ReviewRow label="Trading Name" value={form.tradingName} />
                  <ReviewRow label="TIN" value={form.taxId || '—'} />
                </ReviewSection>
                <ReviewSection title="Settlement" onEdit={() => setStep(2)}>
                  <ReviewRow label="Bank" value={formatBankDisplay(form.bankCode)} />
                  <ReviewRow label="Account Number" value={form.accountNumber} mono />
                </ReviewSection>
                <ReviewSection title="KYC Documents" onEdit={() => setStep(3)}>
                  <ReviewRow label="ID Document" value={form.kycFile?.name ?? '—'} />
                  {needsCompanyDocs && (
                    <>
                      <ReviewRow label="Business License" value={form.kycLicenseFile?.name ?? '—'} />
                      <ReviewRow label="TIN Certificate" value={form.kycTinFile?.name ?? '—'} />
                    </>
                  )}
                </ReviewSection>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" className="h-11" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
            {applicationId && step < 4 && (
              <Button type="button" variant="ghost" className="h-11" onClick={() => void saveDraft()}>
                <Save className="mr-1 h-4 w-4" /> Save Draft
              </Button>
            )}
          </div>
          <Button type="submit" className="h-11" disabled={!currentStepValid}>
            {step === 4 ? 'Submit Application' : 'Next'}
            {step < 4 && <ArrowRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
