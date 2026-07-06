'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
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

const WIZARD_STEPS = ['Type', 'Profile', 'Settlement', 'KYC', 'Review'] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [onboardingType, setOnboardingType] = useState<'MERCHANT' | 'SCHOOL'>('MERCHANT');
  const [entityType, setEntityType] = useState<'SOLE_PROPRIETOR' | 'COMPANY'>('SOLE_PROPRIETOR');
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
  });

  const { regions, districts, wards, getPostcode } = useTanzaniaLocations(
    form.region || undefined,
    form.district || undefined,
  );

  const token = accessToken!;

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
        const id = await ensureApplication();
        if (form.kycFile) {
          await uploadOnboardingKycFile(token, id, form.kycFile, 'KYC_ID');
        }
        if (onboardingType === 'SCHOOL' || entityType === 'COMPANY') {
          if (form.kycFile) {
            await uploadOnboardingKycFile(token, id, form.kycFile, 'KYC_TIN');
          }
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/onboarding">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <PageHeader title="New Onboarding" description={`Step ${step + 1} of ${WIZARD_STEPS.length}: ${WIZARD_STEPS[step]}`} />
      </div>

      <ol className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              i === step ? 'border-[var(--brand-yellow)] bg-[var(--accent-muted)]' : i < step ? 'border-[var(--success-border)] bg-[var(--success-muted)]' : 'border-border text-muted-foreground'
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleNext}>
        <Card>
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
          <CardContent className="space-y-4">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-lg border p-4 text-left ${onboardingType === 'MERCHANT' ? 'border-[var(--brand-yellow)]' : 'border-border'}`}
                  onClick={() => setOnboardingType('MERCHANT')}
                >
                  <p className="font-medium">Merchant</p>
                  <p className="text-sm text-muted-foreground">Retail / business Lipa Namba onboarding</p>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border p-4 text-left ${onboardingType === 'SCHOOL' ? 'border-[var(--brand-yellow)]' : 'border-border'}`}
                  onClick={() => setOnboardingType('SCHOOL')}
                >
                  <p className="font-medium">School</p>
                  <p className="text-sm text-muted-foreground">School fee collection via TANQR</p>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Legal Name *</Label>
                  <Input required value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Trading / Display Name *</Label>
                  <Input required value={form.tradingName} onChange={(e) => setForm({ ...form, tradingName: e.target.value })} />
                </div>
                {onboardingType === 'MERCHANT' && (
                  <div>
                    <Label>MCC *</Label>
                    <Input required pattern="[0-9]{4}" value={form.mcc} onChange={(e) => setForm({ ...form, mcc: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label>TIN</Label>
                  <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                </div>
                <div>
                  <Label>VRN</Label>
                  <Input value={form.vrn} onChange={(e) => setForm({ ...form, vrn: e.target.value })} />
                </div>
                <div>
                  <Label>{onboardingType === 'SCHOOL' ? 'School Registration No *' : 'Business Registration No'}</Label>
                  <Input required={onboardingType === 'SCHOOL'} value={form.companyRegistrationNo} onChange={(e) => setForm({ ...form, companyRegistrationNo: e.target.value })} />
                </div>
                {onboardingType === 'SCHOOL' && (
                  <div>
                    <Label>Principal / Head Name</Label>
                    <Input value={form.headName} onChange={(e) => setForm({ ...form, headName: e.target.value })} />
                  </div>
                )}
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
                  <Label>Postcode *</Label>
                  <Input required pattern="[0-9]{5}" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
                </div>
                <div>
                  <Label>Contact Mobile *</Label>
                  <Input required value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                </div>
                <div>
                  <Label>Contact Email *</Label>
                  <Input required type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-3 max-w-md">
                <div>
                  <Label>Account Number *</Label>
                  <Input required minLength={10} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
                </div>
                <div>
                  <Label>Account Name *</Label>
                  <Input required value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
                </div>
                <BankSelectField
                  value={form.bankCode}
                  onChange={(swiftCode) => setForm({ ...form, bankCode: swiftCode })}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <Label>KYC ID Document *</Label>
                <Input type="file" accept=".pdf,.jpg,.png" required onChange={(e) => setForm({ ...form, kycFile: e.target.files?.[0] ?? null })} />
                <p className="text-sm text-muted-foreground">
                  {onboardingType === 'SCHOOL' || entityType === 'COMPANY'
                    ? 'TIN certificate and business license are also required — upload ID first, then add others from the detail page.'
                    : 'National ID or passport required.'}
                </p>
              </div>
            )}

            {step === 4 && (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Type</dt><dd>{onboardingType}</dd></div>
                <div><dt className="text-muted-foreground">Name</dt><dd>{form.legalName}</dd></div>
                <div><dt className="text-muted-foreground">Trading</dt><dd>{form.tradingName}</dd></div>
                <div><dt className="text-muted-foreground">TIN</dt><dd>{form.taxId || '—'}</dd></div>
                <div><dt className="text-muted-foreground">Bank</dt><dd>{formatBankDisplay(form.bankCode)}</dd></div>
                <div><dt className="text-muted-foreground">Account</dt><dd className="font-mono">{form.accountNumber}</dd></div>
                <div><dt className="text-muted-foreground">KYC</dt><dd>{form.kycFile?.name ?? '—'}</dd></div>
              </dl>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
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
