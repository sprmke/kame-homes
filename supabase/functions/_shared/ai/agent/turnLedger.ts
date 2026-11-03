/**
 * Turn-level ledger for the agent loop.
 *
 * Escalation used to be recomputed per model round, so a model could spread two writes over two
 * rounds and have both auto-run. The ledger counts writes across the whole turn and remembers
 * whether guest-written text was read, so a later write is always judged against everything
 * the turn has already done.
 */

export type LedgerProposal<T = unknown> = { toolName: string; result: T };

export class TurnLedger<T = unknown> {
  private writeCalls = 0;
  private untrusted = false;
  private readonly proposalList: Array<LedgerProposal<T>> = [];

  /** True once any tool returned guest-written text this turn. Never resets within a turn. */
  get untrustedContentRead(): boolean {
    return this.untrusted;
  }

  get totalWriteCalls(): number {
    return this.writeCalls;
  }

  get proposals(): ReadonlyArray<LedgerProposal<T>> {
    return this.proposalList;
  }

  markUntrustedRead(): void {
    this.untrusted = true;
  }

  /**
   * Register the calls of a round about to run and return whether its writes must be escalated
   * to host confirmation. Escalate when:
   *   - guest-written text was read earlier in the turn (injected instructions never auto-run),
   *   - this round plus earlier rounds hold more than one write,
   *   - a write shares a round with any other call.
   */
  planRound(toolNames: readonly string[], isWrite: (toolName: string) => boolean): boolean {
    const roundWrites = toolNames.filter(isWrite).length;
    const escalate =
      this.untrusted ||
      this.writeCalls + roundWrites > 1 ||
      (toolNames.length >= 2 && roundWrites >= 1);
    this.writeCalls += roundWrites;
    return escalate;
  }

  /** Keep every proposal in call order; the first becomes the card, the rest are surfaced. */
  addProposal(proposal: LedgerProposal<T>): void {
    this.proposalList.push(proposal);
  }
}
