// Google Identity Services 型別宣告
declare namespace google.accounts.id {
  function initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    auto_select?: boolean;
    context?: string;
  }): void;

  function prompt(callback?: (notification: {
    isNotDisplayed: () => boolean;
    isSkippedMoment: () => boolean;
    getNotDisplayedReason: () => string;
    getSkippedReason: () => string;
  }) => void): void;

  function renderButton(
    parent: HTMLElement,
    options: {
      type?: string;
      theme?: string;
      size?: string;
      text?: string;
      width?: number;
    },
  ): void;

  function disableAutoSelect(): void;
}
