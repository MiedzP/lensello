/**
 * Thrown by a step to mean "correctly did nothing", as opposed to "failed".
 *
 * The distinction matters for the audit trail the brief asks for: a marketing
 * email withheld because a client has not consented is not a bug in the step,
 * and recording it as `failed` would make an operator go looking for a broken
 * integration that was never broken. The runner catches this specifically and
 * records the step as `skipped` with the reason in `output`, rather than
 * `error`.
 */
export class StepSkipped extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'StepSkipped';
  }
}

/**
 * Thrown by a step that has no way to do what it was asked, ever — not a
 * transient failure. `send_sms` (no adapter) and `add_tag` (no schema column)
 * both use this: the brief is explicit that an unconfigured capability must
 * fail visibly rather than silently no-op.
 */
export class StepUnsupported extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepUnsupported';
  }
}
