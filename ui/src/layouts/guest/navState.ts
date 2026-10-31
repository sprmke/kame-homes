export type GuestEnterVariant = 'default' | 'forward' | 'back' | 'success';

export type GuestNavState = {
  guestEnter?: GuestEnterVariant;
};

export function guestEnterClass(state: GuestNavState | null | undefined): string {
  switch (state?.guestEnter) {
    case 'forward':
      return 'guest-enter-forward';
    case 'back':
      return 'guest-enter-back';
    case 'success':
      return 'guest-enter-success';
    default:
      return 'guest-enter';
  }
}
