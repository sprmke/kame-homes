import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { GuestFormStepNavigation } from '@/features/guest/form/components/GuestFormStepNavigation';
import { ParkingLinkedStayConfirm } from '@/features/guest/marketing/parkings/components/ParkingLinkedStayConfirm';
import { ParkingStayChooser } from '@/features/guest/marketing/parkings/components/ParkingStayChooser';
import type { LinkableParkingBooking } from '@/features/guest/marketing/parkings/hooks/useLinkableParkingBookings';
import {
  parkingRegistrationSchema,
  type ParkingRegistrationValues,
} from '@/features/guest/marketing/parkings/lib/parkingRegistrationSchema';
import {
  clampParkingStep,
  getFieldsForParkingStep,
  isParkingStepComplete,
  PARKING_REGISTRATION_STEP_COUNT,
} from '@/features/guest/marketing/parkings/lib/parkingRegistrationSteps';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import {
  PARKING_REQUEST_FORM_STEPS,
  ParkingFlowStepper,
} from '@/components/parking/ParkingFlowStepper';
import { useAntiSpamFields } from '@/components/security/useAntiSpamFields';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { FORM_PLACEHOLDERS } from '@/lib/constants/formPlaceholders';
import { parkingFlowStep, parkingFlowTransition } from '@/lib/parking/parkingFlowMotion';
import { cn } from '@/lib/utils';
import {
  DATE_PICKER_DISPLAY_FORMAT,
  dateToString,
  getNextDay,
  stringToDate,
} from '@/utils/format/dates';
import { toCapitalCase } from '@/utils/text/formatters';

type RequestPhase = 'loading' | 'choose' | 'confirm' | 'manual';

interface ParkingRegistrationFormProps {
  defaultValues?: Partial<ParkingRegistrationValues>;
  towerLabel?: string | null;
  linkableBookings?: LinkableParkingBooking[];
  /** While true, delay stay-chooser vs manual so we don't flash the stepper. */
  isLinkableLoading?: boolean;
  /**
   * When set (from `?linkStay=` / session), auto-select that property stay once it
   * appears in linkableBookings — skips the chooser for host-shared deep links.
   */
  preferredLinkStayId?: string | null;
  onSubmit: (
    data: ParkingRegistrationValues,
    linkedPropertyBookingId: string | null,
    antiSpam?: { contact_time: string; formLoadedAt: string }
  ) => Promise<void>;
  /**
   * `'modal'` (default): rendered inside `ParkingBookingFormModal`'s own sheet
   * — the step nav stays a plain inline row. `'page'`: rendered as a standalone
   * route (`ParkingFormPage`) — the step nav floats via `ContextualActionBar`
   * on phone/tablet, same as the property booking form.
   */
  mobileVariant?: 'modal' | 'page';
  /** Reports unsaved edits so a host modal can guard its own close. */
  onDirtyChange?: (isDirty: boolean) => void;
}

function clearLinkedFields(form: ReturnType<typeof useForm<ParkingRegistrationValues>>) {
  form.setValue('guestName', '');
  form.setValue('email', '');
  form.setValue('phone', '');
  form.setValue('unitNumber', '');
  form.setValue('carPlateNumber', '');
  form.setValue('carBrandModel', '');
  form.setValue('carColor', '');
  form.setValue('vehicleType', undefined as unknown as ParkingRegistrationValues['vehicleType']);
}

function applyLinkedBooking(
  form: ReturnType<typeof useForm<ParkingRegistrationValues>>,
  linked: LinkableParkingBooking
) {
  if (linked.guestName) form.setValue('guestName', linked.guestName);
  if (linked.guestEmail) form.setValue('email', linked.guestEmail);
  if (linked.guestPhone) {
    form.setValue('phone', linked.guestPhone.replace(/[^\d]/g, '').slice(0, 11));
  }
  if (linked.towerAndUnitNumber) form.setValue('unitNumber', linked.towerAndUnitNumber);
  if (linked.carPlateNumber) form.setValue('carPlateNumber', linked.carPlateNumber);
  if (linked.carBrandModel) form.setValue('carBrandModel', linked.carBrandModel);
  if (linked.carColor) form.setValue('carColor', linked.carColor);
  // Property stays don't store vehicle type — default car when plate/brand present.
  if (linked.carPlateNumber || linked.carBrandModel) {
    form.setValue('vehicleType', 'car');
  }
}

export function ParkingRegistrationForm({
  defaultValues,
  towerLabel,
  linkableBookings = [],
  isLinkableLoading = false,
  preferredLinkStayId = null,
  onSubmit,
  mobileVariant = 'modal',
  onDirtyChange,
}: ParkingRegistrationFormProps) {
  const reduceMotion = useReducedMotion();
  const antiSpamFields = useAntiSpamFields();
  const [phase, setPhase] = useState<RequestPhase>(() =>
    isLinkableLoading ? 'loading' : linkableBookings.length > 0 ? 'choose' : 'manual'
  );
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkedBookingId, setLinkedBookingId] = useState<string | null>(null);
  const [autoLinkAttempted, setAutoLinkAttempted] = useState(false);

  const form = useForm<ParkingRegistrationValues>({
    resolver: zodResolver(parkingRegistrationSchema),
    defaultValues: {
      guestName: '',
      email: '',
      phone: '',
      unitNumber: '',
      checkInDate: '',
      checkOutDate: '',
      vehicleType: undefined,
      carPlateNumber: '',
      carBrandModel: '',
      carColor: '',
      notes: '',
      ...defaultValues,
    },
    mode: 'all',
  });

  // Route guard only on the standalone page; the modal host guards its own close.
  const isFormDirty = form.formState.isDirty && !isSubmitting;
  useUnsavedChangesGuard({ isDirty: isFormDirty, enabled: mobileVariant === 'page' });
  useEffect(() => {
    onDirtyChange?.(isFormDirty);
  }, [isFormDirty, onDirtyChange]);

  const canProceed = isParkingStepComplete(currentStep, form.getValues());
  const linkedBooking =
    linkedBookingId != null
      ? (linkableBookings.find((booking) => booking.id === linkedBookingId) ?? null)
      : null;

  useEffect(() => {
    if (isLinkableLoading) {
      setPhase((prev) =>
        prev === 'manual' || prev === 'confirm' || prev === 'choose' ? prev : 'loading'
      );
      return;
    }
    setPhase((prev) => {
      if (prev === 'loading') {
        return linkableBookings.length > 0 ? 'choose' : 'manual';
      }
      return prev;
    });
  }, [isLinkableLoading, linkableBookings.length]);

  const handleSelectStay = (bookingId: string) => {
    const linked = linkableBookings.find((booking) => booking.id === bookingId);
    if (!linked) return;
    setLinkedBookingId(bookingId);
    applyLinkedBooking(form, linked);

    const phone = (linked.guestPhone ?? '').replace(/[^\d]/g, '').slice(0, 11);
    const incomplete =
      !linked.guestName?.trim() ||
      !linked.guestEmail?.trim() ||
      phone.length < 10 ||
      !linked.towerAndUnitNumber?.trim() ||
      !linked.carPlateNumber?.trim() ||
      !linked.carBrandModel?.trim() ||
      !linked.carColor?.trim() ||
      !form.getValues('checkInDate') ||
      !form.getValues('checkOutDate');

    if (incomplete) {
      setCurrentStep(1);
      setPhase('manual');
      return;
    }

    setPhase('confirm');
  };

  // Host-shared deep link: once linkable stays load, auto-select preferred stay once.
  useEffect(() => {
    if (autoLinkAttempted || isLinkableLoading) return;
    const preferred = preferredLinkStayId?.trim() ?? '';
    if (!preferred) {
      setAutoLinkAttempted(true);
      return;
    }
    const match = linkableBookings.find((booking) => booking.id === preferred);
    setAutoLinkAttempted(true);
    if (match) {
      handleSelectStay(match.id);
    }
    // handleSelectStay closes over linkableBookings/form — intentional one-shot after load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after linkable load
  }, [autoLinkAttempted, isLinkableLoading, preferredLinkStayId, linkableBookings]);

  const handleSelectManual = () => {
    setLinkedBookingId(null);
    clearLinkedFields(form);
    setCurrentStep(1);
    setPhase('manual');
  };

  const handleConfirmBack = () => {
    setLinkedBookingId(null);
    clearLinkedFields(form);
    setPhase('choose');
  };

  const handleEditDetails = () => {
    setCurrentStep(1);
    setPhase('manual');
  };

  const handleNextStep = async () => {
    if (!canProceed) {
      await form.trigger(getFieldsForParkingStep(currentStep));
      toast.error('Please complete all required fields before continuing.');
      return;
    }
    setCurrentStep((step) => clampParkingStep(step + 1) as 1 | 2 | 3);
  };

  const handleBackStep = () => {
    if (currentStep === 1 && linkableBookings.length > 0) {
      handleConfirmBack();
      return;
    }
    setCurrentStep((step) => clampParkingStep(step - 1) as 1 | 2 | 3);
  };

  const handleFinalSubmit = form.handleSubmit(
    async (values) => {
      setIsSubmitting(true);
      try {
        await onSubmit(values, linkedBookingId, antiSpamFields.getFields());
      } finally {
        setIsSubmitting(false);
      }
    },
    () => {
      toast.error('Please complete all required fields before submitting.');
    }
  );

  if (phase === 'loading') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading stays">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-[4.25rem] w-full rounded-xl" />
        <Skeleton className="h-[4.25rem] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className={cn(
          'space-y-6',
          mobileVariant === 'page' && phase === 'manual' && bottomTabBarOffsetClassName()
        )}
        noValidate
      >
        {antiSpamFields.field}
        <AnimatePresence mode="wait" initial={false}>
          {phase === 'choose' ? (
            <motion.div
              key="choose"
              initial={reduceMotion ? false : parkingFlowStep.initial}
              animate={parkingFlowStep.animate}
              exit={reduceMotion ? undefined : parkingFlowStep.exit}
              transition={parkingFlowTransition(reduceMotion, 0.28)}
            >
              <ParkingStayChooser
                bookings={linkableBookings}
                onSelectStay={handleSelectStay}
                onSelectManual={handleSelectManual}
              />
            </motion.div>
          ) : null}

          {phase === 'confirm' && linkedBooking ? (
            <motion.div
              key="confirm"
              initial={reduceMotion ? false : parkingFlowStep.initial}
              animate={parkingFlowStep.animate}
              exit={reduceMotion ? undefined : parkingFlowStep.exit}
              transition={parkingFlowTransition(reduceMotion, 0.28)}
            >
              <ParkingLinkedStayConfirm
                booking={linkedBooking}
                form={form}
                isSubmitting={isSubmitting}
                onBack={handleConfirmBack}
                onEditDetails={handleEditDetails}
                onSubmit={() => void handleFinalSubmit()}
              />
            </motion.div>
          ) : null}

          {phase === 'manual' ? (
            <motion.div
              key="manual"
              initial={reduceMotion ? false : parkingFlowStep.initial}
              animate={parkingFlowStep.animate}
              exit={reduceMotion ? undefined : parkingFlowStep.exit}
              transition={parkingFlowTransition(reduceMotion, 0.28)}
              className="space-y-6"
            >
              <ParkingFlowStepper
                steps={PARKING_REQUEST_FORM_STEPS}
                activeIndex={currentStep - 1}
              />

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={reduceMotion ? false : parkingFlowStep.initial}
                  animate={parkingFlowStep.animate}
                  exit={reduceMotion ? undefined : parkingFlowStep.exit}
                  transition={parkingFlowTransition(reduceMotion, 0.28)}
                  className="space-y-5"
                >
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="guestName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Guest name <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="min-h-[44px]"
                                placeholder={FORM_PLACEHOLDERS.fullName}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:[&>*]:min-w-0">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Email <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="min-h-[44px]"
                                  type="email"
                                  placeholder={FORM_PLACEHOLDERS.email}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Phone <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="min-h-[44px]"
                                  type="tel"
                                  inputMode="numeric"
                                  placeholder={FORM_PLACEHOLDERS.phone}
                                  {...field}
                                  value={field.value || ''}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/[^\d]/g, '');
                                    field.onChange(value.slice(0, 11));
                                    form.trigger('phone');
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <div
                        className={
                          towerLabel
                            ? 'grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:[&>*]:min-w-0'
                            : undefined
                        }
                      >
                        {towerLabel ? (
                          <FormItem className="min-w-0">
                            <FormLabel>Tower</FormLabel>
                            <FormControl>
                              <Input
                                className="min-h-[44px]"
                                value={towerLabel}
                                readOnly
                                disabled
                              />
                            </FormControl>
                          </FormItem>
                        ) : null}

                        <FormField
                          control={form.control}
                          name="unitNumber"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Unit <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="min-h-[44px]"
                                  placeholder={FORM_PLACEHOLDERS.unitNumber}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:[&>*]:min-w-0">
                        <FormField
                          control={form.control}
                          name="checkInDate"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Check-in <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <DatePicker
                                  date={field.value ? stringToDate(field.value) : undefined}
                                  rangeEnd={
                                    form.watch('checkOutDate')
                                      ? stringToDate(form.watch('checkOutDate'))
                                      : undefined
                                  }
                                  onSelect={(date) => {
                                    if (!date) return;
                                    const dateStr = dateToString(date);
                                    field.onChange(dateStr);
                                    form.setValue('checkOutDate', getNextDay(dateStr));
                                  }}
                                  disabled={(date) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return date < today;
                                  }}
                                  minDate={new Date()}
                                  placeholder={DATE_PICKER_DISPLAY_FORMAT}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="checkOutDate"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Check-out <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <DatePicker
                                  date={field.value ? stringToDate(field.value) : undefined}
                                  rangeEnd={
                                    form.watch('checkInDate')
                                      ? stringToDate(form.watch('checkInDate'))
                                      : undefined
                                  }
                                  onSelect={(date) => {
                                    if (date) field.onChange(dateToString(date));
                                  }}
                                  disabled={(date) => {
                                    const checkInDate = form.watch('checkInDate');
                                    if (checkInDate) {
                                      return date <= stringToDate(checkInDate);
                                    }
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    return date < today;
                                  }}
                                  minDate={
                                    form.watch('checkInDate')
                                      ? stringToDate(getNextDay(form.watch('checkInDate')))
                                      : new Date()
                                  }
                                  placeholder={DATE_PICKER_DISPLAY_FORMAT}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:[&>*]:min-w-0">
                        <FormField
                          control={form.control}
                          name="vehicleType"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Vehicle type <span className="text-destructive">*</span>
                              </FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="min-h-[44px]">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="car">Car</SelectItem>
                                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="carPlateNumber"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Plate <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="min-h-[44px]"
                                  placeholder="Ex. ABC 1234"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:[&>*]:min-w-0">
                        <FormField
                          control={form.control}
                          name="carBrandModel"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Brand / model <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="min-h-[44px]"
                                  placeholder="Ex. Toyota Fortuner"
                                  {...field}
                                  onChange={(e) => field.onChange(toCapitalCase(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="carColor"
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Color <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="min-h-[44px]"
                                  placeholder="Ex. White"
                                  {...field}
                                  onChange={(e) => field.onChange(toCapitalCase(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Optional parking notes"
                                rows={3}
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <GuestFormStepNavigation
                bare
                mobileVariant={mobileVariant === 'page' ? 'floating' : 'inline'}
                currentStep={currentStep}
                stepCount={PARKING_REGISTRATION_STEP_COUNT}
                isSubmitting={isSubmitting}
                canProceed={canProceed}
                submitReady
                submitLabel="Submit request"
                onBack={handleBackStep}
                onNext={handleNextStep}
                onSubmit={() => void handleFinalSubmit()}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </form>
    </Form>
  );
}
