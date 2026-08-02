'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { SORTED_MCC_CODES, findMccByCode, formatMccLabel } from '@/lib/mcc-codes';
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

/** Masks a TIN as the user types: digits only, dashes auto-inserted as XXX-XXX-XXX. */
function formatTin(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean);
  return parts.join('-');
}

function isValidTin(value: string): boolean {
  return value.replace(/\D/g, '').length === 9;
}

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
        <h4 className="section-heading">{title}</h4>
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

function KycFileDropzone({
  id,
  label,
  file,
  dragging,
  onDraggingChange,
  onFile,
}: {
  id: string;
  label: string;
  file: File | null;
  dragging: boolean;
  onDraggingChange: (v: boolean) => void;
  onFile: (file: File | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          onDraggingChange(true);
        }}
        onDragLeave={() => onDraggingChange(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDraggingChange(false);
          const next = e.dataTransfer.files?.[0];
          if (next) onFile(next);
        }}
        className={cn(
          'dropzone flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center',
          dragging && 'is-dragging',
        )}
      >
        <UploadCloud className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm font-medium">Click to upload or drag and drop</p>
        <p className="text-xs text-muted-foreground">PDF, JPG or PNG</p>
        <input
          id={id}
          type="file"
          accept=".pdf,.jpg,.png"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onFile(null)}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const prevStepRef = useRef(0);

  useEffect(() => {
    setStepDirection(step >= prevStepRef.current ? 'forward' : 'backward');
    prevStepRef.current = step;
  }, [step]);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [onboardingType, setOnboardingType] = useState<'MERCHANT' | 'SCHOOL'>('MERCHANT');
  const [entityType, setEntityType] = useState<'SOLE_PROPRIETOR' | 'COMPANY'>('SOLE_PROPRIETOR');
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [tinTouched, setTinTouched] = useState(false);
  const [form, setForm] = useState({
    legalName: '',
    tradingName: '',
    businessType: '',
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
    kycTinFile: null as File | null,
    kycLicenseFile: null as File | null,
  });

  const mccOptions: ComboboxOption[] = SORTED_MCC_CODES.map((m) => ({
    value: m.code,
    label: formatMccLabel(m),
    keywords: m.code,
  }));

  const { regions, districts, wards, getPostcode } = useTanzaniaLocations(
    form.region || undefined,
    form.district || undefined,
  );

  const token = accessToken!;

  const stepItems: StepProgressItem[] = WIZARD_STEPS.map((label, i) => {
    const Icon = STEP_ICONS[i];
    return {
      key: label,
      label,
      icon: <Icon className="h-4 w-4" strokeWidth={2.25} />,
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
        if (onboardingType === 'MERCHANT' && !form.businessType) {
          throw new Error('Please select a Business Type to continue');
        }
        if (form.taxId && !isValidTin(form.taxId)) {
          setTinTouched(true);
          throw new Error('TIN must be 9 digits in the format XXX-XXX-XXX');
        }
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
        const needsFullKyc = onboardingType === 'SCHOOL' || entityType === 'COMPANY';
        if (!form.kycFile) {
          throw new Error('Please upload the KYC ID document to continue');
        }
        if (needsFullKyc && !form.kycTinFile) {
          throw new Error('Please upload the TIN certificate (KYC_TIN) to continue');
        }
        if (needsFullKyc && !form.kycLicenseFile) {
          throw new Error('Please upload the business/school license (KYC_LICENSE) to continue');
        }
        const id = await ensureApplication();
        await uploadOnboardingKycFile(token, id, form.kycFile, 'KYC_ID');
        if (needsFullKyc && form.kycTinFile) {
          await uploadOnboardingKycFile(token, id, form.kycTinFile, 'KYC_TIN');
        }
        if (needsFullKyc && form.kycLicenseFile) {
          await uploadOnboardingKycFile(token, id, form.kycLicenseFile, 'KYC_LICENSE');
        }
      }
      if (step === 4) {
        const id = await ensureApplication();
        await submitOnboarding(token, id);
        router.push(`/onboarding/${id}`);
        return;
      }
      setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Step failed');
    }
  }

  return (
    <div className="mx-auto w-full max-w-[var(--form-max-width)] space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/onboarding">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
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
          <CardContent
            key={step}
            className={cn(
              'space-y-4',
              stepDirection === 'forward' ? 'wizard-step-enter-forward' : 'wizard-step-enter-backward',
            )}
          >
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
                <div className="form-section">
                  <h3 className="section-heading">Business Identity</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label required>Legal Name</Label>
                      <Input required value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label required>Trading / Display Name</Label>
                      <Input required value={form.tradingName} onChange={(e) => setForm({ ...form, tradingName: e.target.value })} />
                    </div>
                    {onboardingType === 'MERCHANT' && (
                      <div className="sm:col-span-2">
                        <Label htmlFor="business-type" required>Business Type</Label>
                        <Combobox
                          id="business-type"
                          required
                          options={mccOptions}
                          value={form.businessType}
                          onChange={(code) => setForm({ ...form, businessType: code, mcc: code })}
                          placeholder="Search by business name or MCC code…"
                        />
                      </div>
                    )}
                    {onboardingType === 'MERCHANT' && (
                      <div>
                        <Label required>MCC</Label>
                        <Input
                          required
                          pattern="[0-9]{4}"
                          readOnly={!!form.businessType}
                          className={form.businessType ? 'field-derived' : undefined}
                          value={form.mcc}
                          onChange={(e) => setForm({ ...form, mcc: e.target.value })}
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="tin">TIN</Label>
                      <Input
                        id="tin"
                        inputMode="numeric"
                        placeholder="XXX-XXX-XXX"
                        maxLength={11}
                        value={form.taxId}
                        onChange={(e) => setForm({ ...form, taxId: formatTin(e.target.value) })}
                        onBlur={() => setTinTouched(true)}
                        aria-invalid={tinTouched && !!form.taxId && !isValidTin(form.taxId)}
                      />
                      {tinTouched && form.taxId && !isValidTin(form.taxId) && (
                        <p className="mt-1 text-sm text-destructive">
                          TIN must be 9 digits in the format XXX-XXX-XXX
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>VRN</Label>
                      <Input value={form.vrn} onChange={(e) => setForm({ ...form, vrn: e.target.value })} />
                    </div>
                    <div>
                      <Label required={onboardingType === 'SCHOOL'}>
                        {onboardingType === 'SCHOOL' ? 'School Registration No' : 'Business Registration No'}
                      </Label>
                      <Input required={onboardingType === 'SCHOOL'} value={form.companyRegistrationNo} onChange={(e) => setForm({ ...form, companyRegistrationNo: e.target.value })} />
                    </div>
                    {onboardingType === 'SCHOOL' && (
                      <div>
                        <Label>Principal / Head Name</Label>
                        <Input value={form.headName} onChange={(e) => setForm({ ...form, headName: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="section-heading">Location</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                        const postcode = ward ? getPostcode(ward) : '';
                        setForm({ ...form, ward, ...(postcode ? { postalCode: postcode } : {}) });
                      }}>
                        <option value="">Select ward</option>
                        {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="postcode" required>Postcode</Label>
                      <Input
                        id="postcode"
                        required
                        pattern="[0-9]{5}"
                        readOnly
                        className="field-derived"
                        placeholder="Select a ward"
                        value={form.postalCode}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="section-heading">Contact Details</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label required>Contact Mobile</Label>
                      <Input required value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                    </div>
                    <div>
                      <Label required>Contact Email</Label>
                      <Input required type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid max-w-md gap-3">
                <div>
                  <Label required>Account Number</Label>
                  <Input required minLength={10} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
                </div>
                <div>
                  <Label required>Account Name</Label>
                  <Input required value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
                </div>
                <BankSelectField
                  value={form.bankCode}
                  onChange={(swiftCode) => setForm({ ...form, bankCode: swiftCode })}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <KycFileDropzone
                  id="kyc-id-file"
                  label="KYC ID Document * (National ID / Passport)"
                  file={form.kycFile}
                  dragging={draggingField === 'kyc'}
                  onDraggingChange={(v) => setDraggingField(v ? 'kyc' : null)}
                  onFile={(file) => setForm({ ...form, kycFile: file })}
                />
                {(onboardingType === 'SCHOOL' || entityType === 'COMPANY') && (
                  <>
                    <KycFileDropzone
                      id="kyc-tin-file"
                      label="TIN Certificate * (KYC_TIN)"
                      file={form.kycTinFile}
                      dragging={draggingField === 'tin'}
                      onDraggingChange={(v) => setDraggingField(v ? 'tin' : null)}
                      onFile={(file) => setForm({ ...form, kycTinFile: file })}
                    />
                    <KycFileDropzone
                      id="kyc-license-file"
                      label={
                        onboardingType === 'SCHOOL'
                          ? 'School License / Registration Certificate * (KYC_LICENSE)'
                          : 'Business License * (KYC_LICENSE)'
                      }
                      file={form.kycLicenseFile}
                      dragging={draggingField === 'license'}
                      onDraggingChange={(v) => setDraggingField(v ? 'license' : null)}
                      onFile={(file) => setForm({ ...form, kycLicenseFile: file })}
                    />
                  </>
                )}
                <p className="text-sm text-muted-foreground">
                  {onboardingType === 'SCHOOL' || entityType === 'COMPANY'
                    ? 'Schools and companies must upload ID, TIN certificate, and license before submission.'
                    : 'National ID or passport required.'}
                </p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <ReviewSection title="Business Identity" onEdit={() => setStep(1)}>
                  <ReviewRow label="Type" value={onboardingType} />
                  <ReviewRow label="Legal Name" value={form.legalName} />
                  <ReviewRow label="Trading Name" value={form.tradingName} />
                  {onboardingType === 'MERCHANT' && (
                    <ReviewRow
                      label="Business Type"
                      value={
                        findMccByCode(form.businessType)
                          ? formatMccLabel(findMccByCode(form.businessType)!)
                          : '—'
                      }
                    />
                  )}
                  <ReviewRow label="TIN" value={form.taxId || '—'} />
                </ReviewSection>
                <ReviewSection title="Settlement" onEdit={() => setStep(2)}>
                  <ReviewRow label="Bank" value={formatBankDisplay(form.bankCode)} />
                  <ReviewRow label="Account Number" value={form.accountNumber} mono />
                </ReviewSection>
                <ReviewSection title="KYC" onEdit={() => setStep(3)}>
                  <ReviewRow label="KYC ID" value={form.kycFile?.name ?? '—'} />
                  {(onboardingType === 'SCHOOL' || entityType === 'COMPANY') && (
                    <>
                      <ReviewRow label="TIN certificate" value={form.kycTinFile?.name ?? '—'} />
                      <ReviewRow label="License" value={form.kycLicenseFile?.name ?? '—'} />
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
              <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
            {applicationId && step < 4 && (
              <Button type="button" variant="ghost" onClick={() => void saveDraft()}>
                <Save className="mr-1 h-4 w-4" /> Save Draft
              </Button>
            )}
          </div>
          <Button type="submit">
            {step === 4 ? 'Submit for Approval' : 'Next'}
            {step < 4 && <ArrowRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
